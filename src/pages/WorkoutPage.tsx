import { PencilSimpleIcon, TrophyIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../db/db';
import type { Exercise, Workout } from '../db/types';
import { doneSetCount, matchPrevious, PR_LABELS, workoutVolume, type PRKind } from '../lib/calc';
import { fromLocalInput, toLocalInput } from '../lib/dates';
import { resolveForDone } from '../lib/sets';
import { formatClock, formatDuration, formatNumber, formatWeight, kgToDisplay } from '../lib/units';
import { useNow } from '../lib/useNow';
import { useExerciseMap } from '../state/exercises';
import { useWorkoutInsights, type WorkoutInsights } from '../state/insights';
import { useSettings } from '../state/settings';
import {
  cleanForSave,
  discardWorkout,
  finishWorkout,
  mutateWorkout,
  routineDiffers,
  updateRoutineFromWorkout,
  useActiveWorkout,
} from '../state/workout';
import { Sheet, useDialogs } from '../components/Sheet';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Button, Empty, Field, Header, inputClass, Page, Stat } from '../components/ui';

const LONG_WORKOUT_MS = 3 * 3600000;

export function WorkoutPage() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const insights = useWorkoutInsights(active, settings, exMap);
  const now = useNow(1000, !!active);
  const { confirm } = useDialogs();
  const [renaming, setRenaming] = useState(false);
  const [finishing, setFinishing] = useState<{ workout: Workout; occupied: string[] } | null>(null);

  if (active === undefined) return null;
  if (active === null) {
    return (
      <>
        <Header title="Træning" back="/" />
        <Page>
          <div className="mt-6">
            <Empty text="Ingen træning i gang." action={<Button onClick={() => navigate('/')}>Til Træn</Button>} />
          </div>
        </Page>
      </>
    );
  }

  const update = (fn: (w: Workout) => void) => mutateWorkout(active.id, fn);
  const typeOf = (id: string) => exMap.get(id)?.type;
  const volume = workoutVolume(active, typeOf);

  const onFinish = async () => {
    // Gem et felt, der stadig har fokus, og læs træningen frisk fra databasen bagefter.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const fresh = (await db.workouts.get(active.id)) ?? active;
    // Øvelser med maskine optaget tæller ikke som ufærdige.
    const undone = fresh.exercises
      .filter((we) => !we.skipped)
      .flatMap((we) => we.sets.filter((s) => !s.done).map((s) => ({ we, s })));
    let w = fresh;
    if (undone.length) {
      const fillable = undone.filter(({ we, s }) => {
        const prev = matchPrevious(we.sets, insights.prevByExercise.get(we.exerciseId)?.sets)[we.sets.indexOf(s)];
        return resolveForDone(s, prev, exMap.get(we.exerciseId)?.type ?? 'weight_reps').ok;
      });
      const n = undone.length;
      const choice = await confirm({
        title: n === 1 ? '1 sæt er ikke markeret som færdigt' : `${n} sæt er ikke markeret som færdige`,
        message: 'Fjern dem, eller markér dem som færdige med de viste værdier?',
        actions: [
          { label: 'Fjern dem', value: 'remove', tone: 'primary' as const },
          ...(fillable.length ? [{ label: 'Markér som færdige', value: 'complete', tone: 'secondary' as const }] : []),
        ],
      });
      if (!choice) return;
      if (choice === 'complete') {
        const at = Date.now();
        w = structuredClone(fresh);
        for (const we of w.exercises) {
          if (we.skipped) continue;
          const prevSets = insights.prevByExercise.get(we.exerciseId)?.sets;
          const matched = matchPrevious(we.sets, prevSets);
          we.sets.forEach((s, i) => {
            if (s.done) return;
            const r = resolveForDone(s, matched[i], exMap.get(we.exerciseId)?.type ?? 'weight_reps');
            if (r.ok) Object.assign(s, r.patch, { done: true, doneAt: at });
          });
        }
      }
    }
    const cleaned = cleanForSave(w);
    if (!cleaned.exercises.length) {
      const c = await confirm({
        title: 'Ingen færdige sæt',
        message: 'Der er intet at gemme. Kassér træningen?',
        actions: [{ label: 'Kassér træning', value: true, tone: 'danger' }],
      });
      if (c) {
        await discardWorkout(active.id);
        navigate('/', { replace: true });
      }
      return;
    }
    const occupied = w.exercises.filter((we) => we.skipped).map((we) => exMap.get(we.exerciseId)?.name ?? 'Ukendt øvelse');
    setFinishing({ workout: cleaned, occupied });
  };

  const onDiscard = async () => {
    const c = await confirm({
      title: 'Kassér træningen?',
      message: 'Alle sæt i denne træning slettes.',
      actions: [{ label: 'Kassér træning', value: true, tone: 'danger' }],
    });
    if (!c) return;
    await discardWorkout(active.id);
    navigate('/', { replace: true });
  };

  return (
    <>
      <Header
        back="/"
        title={
          <button type="button" onClick={() => setRenaming(true)} className="flex max-w-full items-center gap-1.5 text-left">
            <span className="truncate text-[19px] font-semibold">{active.name}</span>
            <PencilSimpleIcon size={16} className="shrink-0 text-faint" />
          </button>
        }
        right={
          <Button tone="primary" size="sm" className="mr-1" onClick={() => void onFinish()}>
            Afslut
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-3 px-4 pb-2">
          <Stat label="Varighed" value={formatClock((now - active.startedAt) / 1000)} />
          <Stat label={`Volumen (${settings.unit})`} value={formatNumber(kgToDisplay(volume, settings.unit), 0)} />
          <Stat label="Sæt" value={doneSetCount(active)} />
        </div>
      </Header>
      <Page className="px-2">
        <div className="mt-3">
          <WorkoutEditor workout={active} update={update} mode="active" insights={insights} settings={settings} exMap={exMap} />
        </div>
        <div className="mt-6 flex flex-col gap-2 px-2">
          <Button tone="primary" size="lg" block onClick={() => void onFinish()}>
            Afslut træning
          </Button>
          <Button tone="danger" size="lg" block onClick={() => void onDiscard()}>
            Kassér træning
          </Button>
        </div>
      </Page>

      <RenameSheet
        key={active.name}
        open={renaming}
        name={active.name}
        onClose={() => setRenaming(false)}
        onSave={(name) => {
          setRenaming(false);
          void update((w) => (w.name = name));
        }}
      />

      {finishing && (
        <FinishSheet
          workout={finishing.workout}
          occupied={finishing.occupied}
          insights={insights}
          exMap={exMap}
          unit={settings.unit}
          onClose={() => setFinishing(null)}
          onSaved={async (saved) => {
            setFinishing(null);
            await finishWorkout(saved);
            navigate(`/history/${saved.id}?saved=1`, { replace: true });
            const routine = saved.routineId ? await db.routines.get(saved.routineId) : undefined;
            if (routine && routineDiffers(routine, saved)) {
              const c = await confirm({
                title: `Opdatér rutinen ${routine.name}?`,
                message: 'Dagens sæt og vægte bliver udgangspunktet næste gang. Øvelser du sprang over, bliver i rutinen.',
                actions: [{ label: 'Opdatér rutine', value: true, tone: 'primary' }],
                cancelLabel: 'Behold rutinen',
              });
              if (c) await updateRoutineFromWorkout(routine, saved);
            }
          }}
        />
      )}
    </>
  );
}

export function RenameSheet({
  open,
  name,
  title = 'Navn på træningen',
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  title?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value.trim());
        }}
        className="flex flex-col gap-3"
      >
        <input
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Navn"
          autoComplete="off"
        />
        <Button type="submit" tone="primary" size="lg" block disabled={!value.trim()}>
          Gem navn
        </Button>
      </form>
    </Sheet>
  );
}

function FinishSheet({
  workout,
  occupied,
  insights,
  exMap,
  unit,
  onClose,
  onSaved,
}: {
  workout: Workout;
  occupied: string[];
  insights: WorkoutInsights;
  exMap: Map<string, Exercise>;
  unit: 'kg' | 'lb';
  onClose: () => void;
  onSaved: (w: Workout) => void;
}) {
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [endedAt, setEndedAt] = useState(() => Date.now());
  const duration = endedAt - workout.startedAt;
  const long = duration > LONG_WORKOUT_MS;
  const typeOf = (id: string) => exMap.get(id)?.type;
  const records = workout.exercises.flatMap((we) =>
    we.sets
      .filter((s) => insights.prs.has(s.id))
      .map((s) => ({ exercise: exMap.get(we.exerciseId)?.name ?? '', kinds: insights.prs.get(s.id) as PRKind[], kg: s.kg, reps: s.reps })),
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Afslut træning"
      footer={
        <Button
          tone="primary"
          size="lg"
          block
          disabled={!name.trim() || endedAt <= workout.startedAt}
          onClick={() => onSaved({ ...workout, name: name.trim(), notes: notes.trim() || undefined, endedAt })}
        >
          Gem træning
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3 rounded-card bg-surface-2 p-3">
        <Stat label="Varighed" value={formatDuration(duration)} />
        <Stat label={`Volumen (${unit})`} value={formatNumber(kgToDisplay(workoutVolume(workout, typeOf), unit), 0)} />
        <Stat label="Sæt" value={doneSetCount(workout)} />
      </div>

      {long && (
        <div className="mt-3 rounded-card border border-line p-3">
          <p className="text-[15px] text-muted">
            Træningen har kørt i {formatDuration(duration)}. Har du glemt at afslutte? Ret sluttidspunktet her.
          </p>
          <input
            type="datetime-local"
            aria-label="Sluttidspunkt"
            className={`${inputClass} mt-2`}
            value={toLocalInput(endedAt)}
            min={toLocalInput(workout.startedAt)}
            onChange={(e) => {
              const t = fromLocalInput(e.target.value);
              if (t) setEndedAt(t);
            }}
          />
        </div>
      )}

      {occupied.length > 0 && (
        <p className="mt-3 text-[15px] text-muted">
          Maskine optaget: {occupied.join(', ')}. Sidste data bruges igen næste gang.
        </p>
      )}

      {records.length > 0 && (
        <div className="mt-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrophyIcon size={20} weight="fill" className="text-pr" />
            {records.length === 1 ? '1 ny rekord' : `${records.length} nye rekorder`}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {records.map((r, i) => (
              <li key={i} className="text-[15px]">
                <span className="font-medium">{r.exercise}</span>
                <span className="text-muted">
                  {r.kg !== undefined ? ` ${formatWeight(r.kg, unit)} ${unit} x ${r.reps ?? ''}` : ''}. {r.kinds.map((k) => PR_LABELS[k]).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <Field label="Navn">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Note">
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hvordan gik det?"
          />
        </Field>
      </div>
    </Sheet>
  );
}
