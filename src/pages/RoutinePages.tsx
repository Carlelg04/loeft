import {
  CopyIcon,
  DotsSixVerticalIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  PlusIcon,
  TimerIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ExercisePicker } from '../components/ExercisePicker';
import { REST_OPTIONS } from '../components/ExerciseForm';
import { NumInput } from '../components/NumInput';
import { useReorder } from '../components/reorder';
import { Sheet, SheetActions, useDialogs } from '../components/Sheet';
import { Button, Empty, Field, Header, IconButton, inputClass, Page } from '../components/ui';
import { db } from '../db/db';
import { SET_TYPE_LABELS, type ExerciseType, type Routine, type RoutineExercise, type RoutineSet, type SetType } from '../db/types';
import { setLabels } from '../lib/calc';
import { uid } from '../lib/id';
import { goBackOr } from '../lib/nav';
import { describeSet } from '../lib/sets';
import { displayToKg, formatNumber, formatRest, formatWeight, kgToDisplay, parseDecimal, parseInteger } from '../lib/units';
import { useExerciseMap } from '../state/exercises';
import { useSettings } from '../state/settings';
import { useStartWorkout } from '../state/useStartWorkout';

function describeTarget(s: RoutineSet, type: ExerciseType, unit: 'kg' | 'lb'): string {
  if (type === 'duration' || type === 'distance_duration') {
    if (!s.targetDurationSec && !s.targetDistanceM) return 'Intet mål';
    return describeSet({ durationSec: s.targetDurationSec, distanceM: s.targetDistanceM }, type, unit);
  }
  const reps = s.targetRepsMax
    ? `${s.targetReps ?? '?'}-${s.targetRepsMax}`
    : s.targetReps !== undefined
      ? String(s.targetReps)
      : undefined;
  if (s.targetKg === undefined) return reps ? `${reps} reps` : 'Intet mål';
  const prefix = type === 'bodyweight_reps' ? '+' : type === 'assisted_bodyweight' ? '−' : '';
  return `${prefix}${formatWeight(s.targetKg, unit)} ${unit} x ${reps ?? '?'}`;
}

// ---------- Vis rutine ----------

export function RoutineViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const routine = useLiveQuery(() => db.routines.get(id), [id]);
  const exMap = useExerciseMap();
  const settings = useSettings();
  const start = useStartWorkout();
  const { confirm } = useDialogs();
  const [menu, setMenu] = useState(false);

  if (routine === undefined) return <Header back="/" />;
  if (!routine) {
    return (
      <>
        <Header back="/" title="Rutine" />
        <Page>
          <div className="mt-6">
            <Empty text="Rutinen findes ikke længere." />
          </div>
        </Page>
      </>
    );
  }

  const duplicate = async () => {
    setMenu(false);
    const count = await db.routines.count();
    const copy: Routine = { ...structuredClone(routine), id: uid(), name: `${routine.name} (kopi)`, order: count, updatedAt: Date.now() };
    await db.routines.add(copy);
    navigate(`/routines/${copy.id}`, { replace: true });
  };

  const remove = async () => {
    setMenu(false);
    const c = await confirm({
      title: `Slet ${routine.name}?`,
      message: 'Rutinen slettes. Dine tidligere træninger bevares.',
      actions: [{ label: 'Slet rutine', value: true, tone: 'danger' }],
    });
    if (!c) return;
    await db.routines.delete(routine.id);
    navigate('/', { replace: true });
  };

  return (
    <>
      <Header
        back="/"
        title={routine.name}
        right={
          <IconButton label="Flere valg" onClick={() => setMenu(true)}>
            <DotsThreeVerticalIcon size={24} weight="bold" />
          </IconButton>
        }
      />
      <Page>
        {routine.notes && <p className="mt-4 whitespace-pre-line text-muted">{routine.notes}</p>}
        <ol className="mt-4 flex flex-col gap-2">
          {routine.exercises.map((re, i) => {
            const ex = exMap.get(re.exerciseId);
            const labels = setLabels(re.sets);
            return (
              <li key={`${re.exerciseId}-${i}`} className="rounded-card bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{ex?.name ?? 'Ukendt øvelse'}</span>
                  <span className="shrink-0 text-[14px] text-faint">Pause {formatRest(re.restSec)}</span>
                </div>
                {re.notes && <p className="mt-1 text-[14px] text-muted">{re.notes}</p>}
                <ul className="tnum mt-2 flex flex-col gap-0.5 text-[15px]">
                  {re.sets.map((s, j) => (
                    <li key={j} className="flex gap-3">
                      <span className={`w-5 text-center font-semibold ${s.type === 'warmup' ? 'text-muted' : ''}`}>{labels[j]}</span>
                      <span className="text-muted">{describeTarget(s, ex?.type ?? 'weight_reps', settings.unit)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
        {routine.exercises.length === 0 && (
          <div className="mt-4">
            <Empty text="Rutinen har ingen øvelser." action={<Button onClick={() => navigate(`/routines/${routine.id}/edit`)}>Redigér rutine</Button>} />
          </div>
        )}
        <div className="sticky bottom-[var(--chrome-h,0px)] -mx-4 mt-6 bg-bg px-4 pt-2 pb-3">
          <Button tone="primary" size="lg" block onClick={() => void start({ routine })}>
            Start rutine
          </Button>
        </div>
      </Page>
      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
        <SheetActions
          items={[
            { label: 'Redigér', icon: <PencilSimpleIcon size={22} />, onClick: () => navigate(`/routines/${routine.id}/edit`) },
            { label: 'Duplikér', icon: <CopyIcon size={22} />, onClick: () => void duplicate() },
            { label: 'Slet rutine', icon: <TrashIcon size={22} />, onClick: () => void remove(), tone: 'danger' },
          ]}
        />
      </Sheet>
    </>
  );
}

// ---------- Redigér rutine ----------

export function RoutineEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { confirm } = useDialogs();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const [draft, setDraft] = useState<Routine | null>(null);
  // Ændringer lægges synkront i en ref, så Gem altid ser det seneste, også et felt der lige er forladt.
  const draftRef = useRef<Routine | null>(null);
  const original = useRef<string>('');
  const [picker, setPicker] = useState(false);
  const [restFor, setRestFor] = useState<number | null>(null);
  const [typeFor, setTypeFor] = useState<{ ex: number; set: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r: Routine =
        (id ? await db.routines.get(id) : undefined) ??
        ({ id: uid(), name: '', order: await db.routines.count(), updatedAt: Date.now(), exercises: [] } as Routine);
      if (cancelled) return;
      original.current = JSON.stringify(r);
      draftRef.current = r;
      setDraft(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const reorder = useReorder(draft?.exercises.length ?? 0, (from, to) =>
    edit((r) => {
      const [e] = r.exercises.splice(from, 1);
      r.exercises.splice(to, 0, e);
    }),
  );

  if (!draft) return <Header back />;

  function edit(fn: (r: Routine) => void) {
    if (!draftRef.current) return;
    const next = structuredClone(draftRef.current);
    fn(next);
    draftRef.current = next;
    setDraft(next);
  }
  const editEx = (i: number, fn: (re: RoutineExercise) => void) => edit((r) => fn(r.exercises[i]));

  const leave = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (JSON.stringify(draftRef.current) !== original.current) {
      const c = await confirm({
        title: 'Kassér ændringer?',
        message: 'Dine ændringer i rutinen bliver ikke gemt.',
        actions: [{ label: 'Kassér ændringer', value: true, tone: 'danger' }],
        cancelLabel: 'Fortsæt med at redigere',
      });
      if (!c) return;
    }
    goBackOr(navigate, id ? `/routines/${id}` : '/');
  };

  const save = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const cur = draftRef.current;
    if (!cur) return;
    const r = { ...cur, name: cur.name.trim() || 'Ny rutine', updatedAt: Date.now() };
    await db.routines.put(r);
    original.current = JSON.stringify(r);
    if (isNew) navigate(`/routines/${r.id}`, { replace: true });
    else goBackOr(navigate, `/routines/${r.id}`);
  };

  const wFormat = (n: number) => formatNumber(n, settings.unit === 'lb' ? 1 : 2, false);

  return (
    <>
      <Header
        title={isNew ? 'Ny rutine' : 'Redigér rutine'}
        right={
          <Button tone="ghost" size="sm" onClick={() => void leave()}>
            Annullér
          </Button>
        }
      />
      <Page>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Navn">
            <input
              className={inputClass}
              value={draft.name}
              placeholder="Fx Push day"
              onChange={(e) => edit((r) => (r.name = e.target.value))}
              autoComplete="off"
            />
          </Field>
          <Field label="Note">
            <textarea
              className={`${inputClass} min-h-16 py-2`}
              value={draft.notes ?? ''}
              onChange={(e) => edit((r) => (r.notes = e.target.value || undefined))}
            />
          </Field>
        </div>

        <h2 className="mt-6 mb-2 text-[15px] font-semibold text-muted">Øvelser</h2>
        <ol className="flex flex-col gap-2">
          {draft.exercises.map((re, i) => {
            const ex = exMap.get(re.exerciseId);
            const labels = setLabels(re.sets);
            const twoCols = !ex || ['weight_reps', 'bodyweight_reps', 'assisted_bodyweight'].includes(ex.type);
            return (
              <li key={`${re.exerciseId}-${i}`} ref={reorder.register(i)} style={reorder.itemStyle(i)} className="rounded-card bg-surface">
                <div className="flex items-center gap-1 pt-1 pr-1">
                  <button
                    type="button"
                    aria-label={`Træk for at flytte ${ex?.name ?? 'øvelsen'}`}
                    className="flex size-12 shrink-0 cursor-grab items-center justify-center text-faint"
                    {...reorder.handleProps(i)}
                  >
                    <DotsSixVerticalIcon size={22} weight="bold" />
                  </button>
                  <span className="min-w-0 flex-1 font-semibold">{ex?.name ?? 'Ukendt øvelse'}</span>
                  <Button tone="ghost" size="sm" onClick={() => setRestFor(i)} className="tnum text-muted">
                    <TimerIcon size={16} />
                    {formatRest(re.restSec)}
                  </Button>
                  <IconButton
                    label={`Fjern ${ex?.name ?? 'øvelsen'}`}
                    onClick={() => edit((r) => r.exercises.splice(i, 1))}
                    className="text-muted"
                  >
                    <TrashIcon size={20} />
                  </IconButton>
                </div>
                <div className="px-3">
                  <input
                    aria-label="Note til øvelsen"
                    placeholder="Note"
                    className="min-h-10 w-full rounded-[8px] bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
                    value={re.notes ?? ''}
                    onChange={(e) => editEx(i, (x) => (x.notes = e.target.value || undefined))}
                  />
                </div>
                {twoCols ? (
                  <div className="mt-2 grid grid-cols-[2.5rem_1fr_1fr_1fr_2.75rem] items-center gap-1.5 px-2 text-[13px] font-medium text-faint">
                    <span className="text-center">Sæt</span>
                    <span className="text-center">{settings.unit}</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">Til reps</span>
                    <span />
                  </div>
                ) : (
                  <p className="mt-2 px-3 text-[13px] text-faint">Mål for tid og distance sættes under træningen.</p>
                )}
                {re.sets.map((s, j) => (
                  <div key={j} className={`grid ${twoCols ? 'grid-cols-[2.5rem_1fr_1fr_1fr_2.75rem]' : 'grid-cols-[2.5rem_1fr_2.75rem]'} min-h-13 items-center gap-1.5 px-2`}>
                    <button
                      type="button"
                      onClick={() => setTypeFor({ ex: i, set: j })}
                      aria-label={`Sæt ${labels[j]}, ${SET_TYPE_LABELS[s.type]}. Skift type`}
                      className={`h-11 rounded-[8px] font-semibold active:bg-surface-2 ${s.type === 'warmup' ? 'text-muted' : s.type === 'failure' ? 'text-danger' : s.type === 'drop' ? 'text-accent' : ''}`}
                    >
                      {labels[j]}
                    </button>
                    {twoCols ? (
                      <>
                        <NumInput
                          label={`Mål i ${settings.unit}, sæt ${labels[j]}`}
                          decimal
                          value={s.targetKg === undefined ? undefined : kgToDisplay(s.targetKg, settings.unit)}
                          format={wFormat}
                          parse={parseDecimal}
                          onCommit={(n) => editEx(i, (x) => (x.sets[j].targetKg = n === undefined ? undefined : displayToKg(n, settings.unit)))}
                        />
                        <NumInput
                          label={`Mål reps, sæt ${labels[j]}`}
                          value={s.targetReps}
                          format={String}
                          parse={parseInteger}
                          onCommit={(n) => editEx(i, (x) => (x.sets[j].targetReps = n))}
                        />
                        <NumInput
                          label={`Højst reps, sæt ${labels[j]}`}
                          value={s.targetRepsMax}
                          placeholder="valgfri"
                          format={String}
                          parse={parseInteger}
                          className="placeholder:text-[13px] placeholder:font-normal"
                          onCommit={(n) => editEx(i, (x) => (x.sets[j].targetRepsMax = n && n > (x.sets[j].targetReps ?? 0) ? n : undefined))}
                        />
                      </>
                    ) : (
                      <span className="text-[15px] text-muted">{SET_TYPE_LABELS[s.type]}</span>
                    )}
                    <IconButton label={`Slet sæt ${labels[j]}`} className="size-11 text-faint" onClick={() => editEx(i, (x) => x.sets.splice(j, 1))}>
                      <XIcon size={18} />
                    </IconButton>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    editEx(i, (x) => {
                      const last = x.sets[x.sets.length - 1];
                      x.sets.push(last ? { ...last, type: last.type === 'warmup' ? 'normal' : last.type } : { type: 'normal' });
                    })
                  }
                  className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 border-t border-line text-[15px] font-semibold text-muted"
                >
                  <PlusIcon size={18} weight="bold" />
                  Tilføj sæt
                </button>
              </li>
            );
          })}
        </ol>
        <Button tone="secondary" size="lg" block className="mt-3" onClick={() => setPicker(true)}>
          <PlusIcon size={20} weight="bold" />
          Tilføj øvelse
        </Button>
        <div className="sticky bottom-[var(--chrome-h,0px)] -mx-4 mt-6 bg-bg px-4 pt-2 pb-3">
          <Button tone="primary" size="lg" block onClick={() => void save()}>
            Gem rutine
          </Button>
        </div>
      </Page>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ids) => {
          setPicker(false);
          edit((r) => {
            for (const exId of ids) {
              const ex = exMap.get(exId);
              r.exercises.push({ exerciseId: exId, restSec: ex?.defaultRestSec ?? settings.defaultRestSec, sets: [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }] });
            }
          });
        }}
      />

      <Sheet open={restFor !== null} onClose={() => setRestFor(null)} title="Pausetid">
        <div className="grid grid-cols-3 gap-2">
          {REST_OPTIONS.map((sec) => (
            <Button
              key={sec}
              size="lg"
              className="tnum"
              tone={restFor !== null && draft.exercises[restFor]?.restSec === sec ? 'primary' : 'secondary'}
              onClick={() => {
                if (restFor !== null) editEx(restFor, (x) => (x.restSec = sec));
                setRestFor(null);
              }}
            >
              {formatRest(sec)}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!typeFor} onClose={() => setTypeFor(null)} title="Sættype">
        <SheetActions
          items={(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => ({
            label: SET_TYPE_LABELS[t],
            onClick: () => {
              if (typeFor) editEx(typeFor.ex, (x) => (x.sets[typeFor.set].type = t));
              setTypeFor(null);
            },
          }))}
        />
      </Sheet>
    </>
  );
}
