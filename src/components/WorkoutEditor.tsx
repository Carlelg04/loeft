import {
  ArrowDownIcon,
  ArrowsLeftRightIcon,
  ArrowUpIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  FireIcon,
  HourglassMediumIcon,
  NotePencilIcon,
  PlusIcon,
  TimerIcon,
  TrashIcon,
  TrophyIcon,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router';
import {
  SET_TYPE_LABELS,
  type Exercise,
  type ExerciseType,
  type SetType,
  type Settings,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../db/types';
import { matchPrevious, PR_LABELS, setLabels, type PRKind } from '../lib/calc';
import { vibrate } from '../lib/feedback';
import { describeSet, placeholderFor, resolveForDone, type Placeholder, type SetField } from '../lib/sets';
import { displayToKg, formatNumber, formatRest, kgToDisplay, parseDecimal, parseInteger } from '../lib/units';
import type { WorkoutInsights } from '../state/insights';
import { startRest } from '../state/restTimer';
import { newSet, newWorkoutExercise } from '../state/workout';
import { ExercisePicker } from './ExercisePicker';
import { REST_OPTIONS } from './ExerciseForm';
import { NumInput } from './NumInput';
import { Sheet, SheetActions, useDialogs } from './Sheet';
import { Button, IconButton } from './ui';

export type WorkoutUpdate = (fn: (w: Workout) => void) => void | Promise<void>;

// ---------- Kolonner pr. øvelsestype ----------

interface ColDef {
  field: SetField;
  head: string;
  label: string;
  decimal: boolean;
  get: (s: WorkoutSet) => number | undefined;
  toStore: (n: number | undefined) => number | undefined;
  format: (n: number) => string;
  parse: (s: string) => number | undefined;
  placeholder: (ph: Placeholder) => string;
}

function columnsFor(type: ExerciseType, unit: 'kg' | 'lb'): ColDef[] {
  const wFormat = (n: number) => formatNumber(n, unit === 'lb' ? 1 : 2, false);
  const kg = (head: string, label: string): ColDef => ({
    field: 'kg',
    head,
    label,
    decimal: true,
    get: (s) => (s.kg === undefined ? undefined : kgToDisplay(s.kg, unit)),
    toStore: (n) => (n === undefined || n < 0 ? undefined : displayToKg(n, unit)),
    format: wFormat,
    parse: parseDecimal,
    placeholder: (ph) => (ph.kg === undefined ? '' : wFormat(kgToDisplay(ph.kg, unit))),
  });
  const reps: ColDef = {
    field: 'reps',
    head: 'Reps',
    label: 'Reps',
    decimal: false,
    get: (s) => s.reps,
    toStore: (n) => (n === undefined || n < 0 ? undefined : Math.round(n)),
    format: (n) => String(n),
    parse: parseInteger,
    placeholder: (ph) => (ph.reps === undefined ? '' : ph.repsMax ? `${ph.reps}-${ph.repsMax}` : String(ph.reps)),
  };
  switch (type) {
    case 'weight_reps':
      return [kg(unit, `Vægt i ${unit}`), reps];
    case 'bodyweight_reps':
      return [kg(`+${unit}`, `Ekstra vægt i ${unit}`), reps];
    case 'assisted_bodyweight':
      return [kg(`−${unit}`, `Hjælp i ${unit}`), reps];
    case 'duration':
      return [
        {
          field: 'durationSec',
          head: 'Sek',
          label: 'Sekunder',
          decimal: false,
          get: (s) => s.durationSec,
          toStore: (n) => (n === undefined || n <= 0 ? undefined : Math.round(n)),
          format: (n) => String(n),
          parse: parseInteger,
          placeholder: (ph) => (ph.durationSec === undefined ? '' : String(ph.durationSec)),
        },
      ];
    case 'distance_duration':
      return [
        {
          field: 'distanceM',
          head: 'Meter',
          label: 'Meter',
          decimal: false,
          get: (s) => s.distanceM,
          toStore: (n) => (n === undefined || n <= 0 ? undefined : Math.round(n)),
          format: (n) => String(n),
          parse: parseInteger,
          placeholder: (ph) => (ph.distanceM === undefined ? '' : String(ph.distanceM)),
        },
        {
          field: 'durationSec',
          head: 'Min',
          label: 'Minutter',
          decimal: true,
          get: (s) => (s.durationSec === undefined ? undefined : s.durationSec / 60),
          toStore: (n) => (n === undefined || n <= 0 ? undefined : Math.round(n * 60)),
          format: (n) => formatNumber(n, 2, false),
          parse: parseDecimal,
          placeholder: (ph) => (ph.durationSec === undefined ? '' : formatNumber(ph.durationSec / 60, 2, false)),
        },
      ];
  }
}

const GRID_2 = 'grid-cols-[2.5rem_minmax(0,1fr)_4.75rem_4rem_3.25rem]';
const GRID_1 = 'grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_3.25rem]';

// ---------- Sæt-række ----------

const SWIPE_DELETE_PX = 96;

function SetRow({
  set,
  label,
  prevText,
  prKinds,
  cols,
  grid,
  ph,
  onPatch,
  onToggle,
  onDelete,
  onTypeTap,
  registerInput,
  onEnter,
}: {
  set: WorkoutSet;
  label: string;
  prevText: string;
  prKinds?: PRKind[];
  cols: ColDef[];
  grid: string;
  ph: Placeholder;
  onPatch: (patch: Partial<WorkoutSet>) => void;
  onToggle: () => void;
  onDelete: () => void;
  onTypeTap: () => void;
  registerInput: (field: SetField, el: HTMLInputElement | null) => void;
  onEnter: (colIndex: number) => void;
}) {
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; swiping: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const [pressKey, setPressKey] = useState(0);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('input')) return;
    drag.current = { x: e.clientX, y: e.clientY, swiping: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const ddx = e.clientX - d.x;
    const ddy = e.clientY - d.y;
    if (!d.swiping) {
      if (ddx < -12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
        d.swiping = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(ddy) > 12) {
        drag.current = null;
        return;
      } else return;
    }
    setDx(Math.min(0, ddx));
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.swiping) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 50);
    if (dx < -SWIPE_DELETE_PX) onDelete();
    setDx(0);
  };

  const typeColor =
    set.type === 'warmup' ? 'text-muted' : set.type === 'failure' ? 'text-danger' : set.type === 'drop' ? 'text-accent' : 'text-text';

  return (
    <div className="relative overflow-hidden" data-testid="set-row" data-done={set.done}>
      <div
        className="absolute inset-0 flex items-center justify-end bg-danger px-5 font-semibold text-bg"
        aria-hidden
        style={{ opacity: dx < 0 ? 1 : 0 }}
      >
        Slet
      </div>
      <div
        className={`relative grid ${grid} min-h-14 items-center gap-1.5 px-2 transition-colors ${set.done ? 'bg-accent-soft' : 'bg-surface'}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <button
          type="button"
          onClick={onTypeTap}
          aria-label={`Sæt ${label}, ${SET_TYPE_LABELS[set.type]}. Skift type`}
          className={`tnum flex h-11 items-center justify-center rounded-[8px] text-[17px] font-semibold active:bg-surface-2 ${typeColor}`}
        >
          {label}
        </button>
        <div className="tnum flex min-w-0 items-center gap-1 text-[15px] text-muted">
          {prKinds && (
            <TrophyIcon size={16} weight="fill" className="shrink-0 text-pr" aria-label={prKinds.map((k) => PR_LABELS[k]).join(', ')} />
          )}
          <span className="truncate">{prevText}</span>
        </div>
        {cols.map((c, i) => (
          <NumInput
            key={c.field}
            label={`${c.label}, sæt ${label}`}
            value={c.get(set)}
            format={c.format}
            parse={c.parse}
            decimal={c.decimal}
            placeholder={c.placeholder(ph)}
            onCommit={(n) => onPatch({ [c.field]: c.toStore(n) })}
            onEnter={() => onEnter(i)}
            inputRef={(el) => registerInput(c.field, el)}
            className={set.done ? 'bg-transparent' : ''}
          />
        ))}
        <button
          type="button"
          key={pressKey}
          onClick={() => {
            setPressKey((k) => k + 1);
            onToggle();
          }}
          aria-label={`Sæt ${label} færdigt`}
          aria-pressed={set.done}
          className={`${pressKey ? 'anim-press' : ''} flex h-12 items-center justify-center rounded-ctl ${
            set.done ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
          }`}
        >
          <CheckIcon size={24} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// ---------- Øvelseskort ----------

function ExerciseCard({
  we,
  index,
  count,
  exercise,
  prevSets,
  prs,
  settings,
  mode,
  update,
  onReplace,
}: {
  we: WorkoutExercise;
  index: number;
  count: number;
  exercise: Exercise | undefined;
  prevSets: WorkoutSet[] | undefined;
  prs: Map<string, PRKind[]>;
  settings: Settings;
  mode: 'active' | 'edit';
  update: WorkoutUpdate;
  onReplace: (index: number) => void;
}) {
  const { toast } = useDialogs();
  const type: ExerciseType = exercise?.type ?? 'weight_reps';
  const cols = useMemo(() => columnsFor(type, settings.unit), [type, settings.unit]);
  const grid = cols.length === 2 ? GRID_2 : GRID_1;
  const labels = setLabels(we.sets);
  const prevMatch = matchPrevious(we.sets, prevSets);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [menu, setMenu] = useState(false);
  const [restPicker, setRestPicker] = useState(false);
  const [typeFor, setTypeFor] = useState<WorkoutSet | null>(null);
  const [showNotes, setShowNotes] = useState(!!we.notes);

  const updateEx = (fn: (e: WorkoutExercise) => void) =>
    update((w) => {
      const e = w.exercises[index];
      if (e) fn(e);
    });
  const patchSet = (id: string, patch: Partial<WorkoutSet>) =>
    update((w) => {
      for (const e of w.exercises) {
        const s = e.sets.find((x) => x.id === id);
        if (s) Object.assign(s, patch);
      }
    });

  const focusField = (setId: string, field: SetField) => inputs.current.get(`${setId}:${field}`)?.focus();

  /** Gem det, der står i et aktivt felt, før sættet læses. Ellers kan en lige rettet værdi gå tabt. */
  const toggle = async (s: WorkoutSet) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    let missing: SetField | null = null;
    let completed = false;
    await update((w) => {
      for (const e of w.exercises) {
        const cur = e.sets.find((x) => x.id === s.id);
        if (!cur) continue;
        if (cur.done) {
          cur.done = false;
          cur.doneAt = undefined;
          return;
        }
        const res = resolveForDone(cur, matchPrevious(e.sets, prevSets)[e.sets.indexOf(cur)], type);
        if (!res.ok) {
          missing = res.missing;
          return;
        }
        Object.assign(cur, res.patch, { done: true, doneAt: Date.now() });
        completed = true;
      }
    });
    if (missing) focusField(s.id, missing);
    if (!completed) return;
    if (settings.vibrate) vibrate(12);
    if (mode === 'active') void startRest(we.exerciseId, we.restSec);
  };

  const removeSet = (s: WorkoutSet, i: number) => {
    const removed = { ...s };
    void update((w) => {
      for (const e of w.exercises) e.sets = e.sets.filter((x) => x.id !== s.id);
    });
    toast({
      message: `Sæt ${labels[i]} slettet`,
      actionLabel: 'Fortryd',
      onAction: () =>
        updateEx((e) => {
          if (!e.sets.some((x) => x.id === removed.id)) e.sets.splice(Math.min(i, e.sets.length), 0, removed);
        }),
    });
  };

  const addSet = () => {
    updateEx((e) => {
      const last = [...e.sets].reverse().find((x) => x.type !== 'warmup');
      const hypothetical = [...e.sets, newSet()];
      const prevForNew = matchPrevious(hypothetical, prevSets)[hypothetical.length - 1];
      const base: Partial<WorkoutSet> =
        prevForNew || !last
          ? {}
          : {
              targetKg: last.kg ?? last.targetKg,
              targetReps: last.reps ?? last.targetReps,
              targetDurationSec: last.durationSec ?? last.targetDurationSec,
              targetDistanceM: last.distanceM ?? last.targetDistanceM,
            };
      e.sets.push(newSet(base));
    });
  };

  const removeExercise = () => {
    setMenu(false);
    const removed = structuredClone(we);
    void update((w) => {
      w.exercises.splice(index, 1);
    });
    toast({
      message: `${exercise?.name ?? 'Øvelsen'} fjernet`,
      actionLabel: 'Fortryd',
      onAction: () =>
        update((w) => {
          w.exercises.splice(Math.min(index, w.exercises.length), 0, removed);
        }),
    });
  };

  const move = (delta: number) => {
    setMenu(false);
    void update((w) => {
      const j = index + delta;
      if (j < 0 || j >= w.exercises.length) return;
      const [e] = w.exercises.splice(index, 1);
      w.exercises.splice(j, 0, e);
    });
  };

  /** Maskine optaget: kortet foldes sammen og lægger sig nederst. Intet nyt gemmes for øvelsen. */
  const markOccupied = () => {
    setMenu(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    void update((w) => {
      const [e] = w.exercises.splice(index, 1);
      if (!e) return;
      e.skipped = true;
      w.exercises.push(e);
    });
    toast({ message: `${exercise?.name ?? 'Øvelsen'} er flyttet nederst` });
  };

  const onEnter = (setIndex: number, colIndex: number) => {
    const s = we.sets[setIndex];
    if (colIndex < cols.length - 1) return focusField(s.id, cols[colIndex + 1].field);
    const next = we.sets[setIndex + 1];
    if (next) focusField(next.id, cols[0].field);
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  if (we.skipped) {
    const last = prevSets?.filter((s) => s.done && s.type !== 'warmup') ?? [];
    const target = we.sets.find((s) => s.type !== 'warmup' && (s.targetKg !== undefined || s.targetReps !== undefined));
    const doneCount = we.sets.filter((s) => s.done).length;
    const info = last.length
      ? `Sidste gang: ${last.map((s) => describeSet(s, type, settings.unit)).join(', ')}`
      : target
        ? `Mål: ${describeSet({ kg: target.targetKg, reps: target.targetReps }, type, settings.unit)}`
        : 'Ingen tidligere data';
    return (
      <section
        className="rounded-card border border-dashed border-line bg-bg"
        aria-label={exercise?.name}
        data-testid="exercise-card"
        data-skipped="true"
      >
        <div className="flex items-center gap-3 py-3 pr-3 pl-4">
          <HourglassMediumIcon size={22} className="shrink-0 text-faint" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{exercise?.name ?? 'Ukendt øvelse'}</div>
            <div className="text-[14px] text-muted">
              Maskine optaget{doneCount ? `. ${doneCount} sæt gemt` : ''}
            </div>
            <div className="tnum text-[14px] text-faint">{info}</div>
          </div>
          <Button size="sm" onClick={() => updateEx((e) => delete e.skipped)}>
            Ledig nu
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card bg-surface" aria-label={exercise?.name} data-testid="exercise-card">
      <div className="flex items-start gap-1 pt-1 pr-1 pl-3">
        <div className="min-w-0 flex-1 py-2">
          <Link to={`/exercises/${we.exerciseId}`} className="block text-[17px] leading-snug font-semibold">
            {exercise?.name ?? 'Ukendt øvelse'}
          </Link>
          <button
            type="button"
            onClick={() => setRestPicker(true)}
            className="mt-1 -ml-1 inline-flex min-h-8 items-center gap-1 rounded-[8px] px-1 text-[14px] text-muted active:bg-surface-2"
          >
            <TimerIcon size={16} />
            Pause {formatRest(we.restSec)}
          </button>
        </div>
        <IconButton label={`Flere valg for ${exercise?.name ?? 'øvelsen'}`} onClick={() => setMenu(true)}>
          <DotsThreeVerticalIcon size={24} weight="bold" />
        </IconButton>
      </div>

      {(showNotes || we.notes) && (
        <div className="px-3 pb-2">
          <NotesField value={we.notes ?? ''} onCommit={(v) => updateEx((e) => (e.notes = v || undefined))} />
        </div>
      )}

      <div className={`grid ${grid} items-end gap-1.5 px-2 pb-1 text-[13px] font-medium text-faint`} aria-hidden>
        <span className="text-center">Sæt</span>
        <span>Forrige</span>
        {cols.map((c) => (
          <span key={c.field} className="text-center">
            {c.head}
          </span>
        ))}
        <span className="flex justify-center">
          <CheckIcon size={16} weight="bold" />
        </span>
      </div>

      {we.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          label={labels[i]}
          prevText={prevMatch[i] ? describeSet(prevMatch[i]!, type, settings.unit) : ''}
          prKinds={prs.get(s.id)}
          cols={cols}
          grid={grid}
          ph={placeholderFor(s, prevMatch[i])}
          onPatch={(p) => patchSet(s.id, p)}
          onToggle={() => void toggle(s)}
          onDelete={() => removeSet(s, i)}
          onTypeTap={() => setTypeFor(s)}
          registerInput={(field, el) => {
            const k = `${s.id}:${field}`;
            if (el) inputs.current.set(k, el);
            else inputs.current.delete(k);
          }}
          onEnter={(col) => onEnter(i, col)}
        />
      ))}

      <button
        type="button"
        onClick={addSet}
        className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-line text-[15px] font-semibold text-muted active:bg-surface-2"
      >
        <PlusIcon size={18} weight="bold" />
        Tilføj sæt
      </button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={exercise?.name}>
        <SheetActions
          items={[
            {
              label: 'Maskine optaget',
              icon: <HourglassMediumIcon size={22} />,
              onClick: markOccupied,
              hidden: mode !== 'active',
            },
            {
              label: 'Tilføj opvarmningssæt',
              icon: <FireIcon size={22} />,
              onClick: () => {
                setMenu(false);
                updateEx((e) => e.sets.unshift(newSet({ type: 'warmup' })));
              },
            },
            {
              label: showNotes || we.notes ? 'Skjul note' : 'Tilføj note',
              icon: <NotePencilIcon size={22} />,
              onClick: () => {
                setMenu(false);
                if (we.notes) updateEx((e) => (e.notes = undefined));
                setShowNotes((v) => !(v || !!we.notes));
              },
            },
            { label: 'Pausetid', icon: <TimerIcon size={22} />, onClick: () => (setMenu(false), setRestPicker(true)) },
            { label: 'Erstat øvelse', icon: <ArrowsLeftRightIcon size={22} />, onClick: () => (setMenu(false), onReplace(index)) },
            { label: 'Flyt op', icon: <ArrowUpIcon size={22} />, onClick: () => move(-1), hidden: index === 0 },
            { label: 'Flyt ned', icon: <ArrowDownIcon size={22} />, onClick: () => move(1), hidden: index === count - 1 },
            { label: 'Fjern øvelse', icon: <TrashIcon size={22} />, onClick: removeExercise, tone: 'danger' },
          ]}
        />
      </Sheet>

      <Sheet open={restPicker} onClose={() => setRestPicker(false)} title="Pausetid">
        <div className="grid grid-cols-3 gap-2">
          {REST_OPTIONS.map((sec) => (
            <Button
              key={sec}
              tone={sec === we.restSec ? 'primary' : 'secondary'}
              size="lg"
              className="tnum"
              onClick={() => {
                setRestPicker(false);
                updateEx((e) => (e.restSec = sec));
              }}
            >
              {formatRest(sec)}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!typeFor} onClose={() => setTypeFor(null)} title="Sættype">
        <SheetActions
          items={[
            ...(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => ({
              label: `${SET_TYPE_LABELS[t]}${typeFor?.type === t ? ' (valgt)' : ''}`,
              onClick: () => {
                if (typeFor) patchSet(typeFor.id, { type: t });
                setTypeFor(null);
              },
            })),
            {
              label: 'Slet sæt',
              icon: <TrashIcon size={22} />,
              tone: 'danger' as const,
              onClick: () => {
                const s = typeFor;
                setTypeFor(null);
                if (s) removeSet(s, we.sets.findIndex((x) => x.id === s.id));
              },
            },
          ]}
        />
      </Sheet>
    </section>
  );
}

function NotesField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <textarea
      aria-label="Note"
      placeholder="Note, fx sædehøjde eller greb"
      value={text}
      rows={Math.min(4, Math.max(1, text.split('\n').length))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text.trim())}
      className="w-full resize-none rounded-[8px] bg-surface-2 px-3 py-2 text-[16px] text-text outline-none focus:ring-2 focus:ring-accent"
    />
  );
}

// ---------- Hele træningen ----------

export function WorkoutEditor({
  workout,
  update,
  mode,
  insights,
  settings,
  exMap,
}: {
  workout: Workout;
  update: WorkoutUpdate;
  mode: 'active' | 'edit';
  insights: WorkoutInsights;
  settings: Settings;
  exMap: Map<string, Exercise>;
}) {
  const [picker, setPicker] = useState<{ replace?: number } | null>(null);

  const onPick = (ids: string[]) => {
    const replace = picker?.replace;
    setPicker(null);
    if (replace !== undefined) {
      const ex = exMap.get(ids[0]);
      if (!ex) return;
      void update((w) => {
        const we = w.exercises[replace];
        if (!we) return;
        we.exerciseId = ex.id;
        we.restSec = ex.defaultRestSec ?? we.restSec;
        we.sets = we.sets.map((s) => (s.done ? { ...s, targetKg: undefined, targetReps: undefined } : newSet({ type: s.type })));
      });
      return;
    }
    void update((w) => {
      for (const id of ids) {
        const ex = exMap.get(id);
        if (ex) w.exercises.push(newWorkoutExercise(ex, settings.defaultRestSec));
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {workout.exercises.map((we, i) => (
        <ExerciseCard
          key={`${we.exerciseId}-${i}`}
          we={we}
          index={i}
          count={workout.exercises.length}
          exercise={exMap.get(we.exerciseId)}
          prevSets={insights.prevByExercise.get(we.exerciseId)?.sets}
          prs={insights.prs}
          settings={settings}
          mode={mode}
          update={update}
          onReplace={(index) => setPicker({ replace: index })}
        />
      ))}
      {workout.exercises.length === 0 && (
        <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-muted">
          Ingen øvelser endnu. Tilføj den første.
        </p>
      )}
      <Button tone="secondary" size="lg" block onClick={() => setPicker({})}>
        <PlusIcon size={20} weight="bold" />
        Tilføj øvelse
      </Button>
      <ExercisePicker
        open={!!picker}
        multi={picker?.replace === undefined}
        title={picker?.replace !== undefined ? 'Erstat øvelse' : 'Tilføj øvelser'}
        onClose={() => setPicker(null)}
        onPick={onPick}
      />
    </div>
  );
}
