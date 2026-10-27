import {
  BookmarkSimpleIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  RepeatIcon,
  TrashIcon,
  TrophyIcon,
} from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Sheet, SheetActions, useDialogs } from '../components/Sheet';
import { Button, Empty, Field, Header, IconButton, inputClass, Page, Stat } from '../components/ui';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { db } from '../db/db';
import type { Exercise, Workout } from '../db/types';
import { detectPRs, doneSetCount, PR_LABELS, setLabels, workoutVolume, type PRKind } from '../lib/calc';
import { formatDateTime, formatMonth, fromLocalInput, toLocalInput } from '../lib/dates';
import { goBackOr } from '../lib/nav';
import { describeSet } from '../lib/sets';
import { formatDuration, formatNumber, kgToDisplay } from '../lib/units';
import { useExerciseMap } from '../state/exercises';
import { useWorkoutInsights } from '../state/insights';
import { useSettings } from '../state/settings';
import { useStartWorkout } from '../state/useStartWorkout';
import { cleanForSave, exerciseIdsOf, saveWorkoutAsRoutine } from '../state/workout';
import { RenameSheet } from './WorkoutPage';

const EMPTY: Workout[] = [];

export function useFinishedWorkouts(): Workout[] | undefined {
  return useLiveQuery(async () => (await db.workouts.orderBy('startedAt').reverse().toArray()).filter((w) => !!w.endedAt), []);
}

function useAllPRs(workouts: Workout[], exMap: Map<string, Exercise>) {
  return useMemo(() => detectPRs(workouts, (id) => exMap.get(id)?.type), [workouts, exMap]);
}

function prCount(w: Workout, prs: Map<string, PRKind[]>): number {
  return w.exercises.reduce((n, we) => n + we.sets.filter((s) => prs.has(s.id)).length, 0);
}

// ---------- Liste ----------

export function HistoryPage() {
  const navigate = useNavigate();
  const workouts = useFinishedWorkouts();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const prs = useAllPRs(workouts ?? EMPTY, exMap);
  const typeOf = (id: string) => exMap.get(id)?.type;

  const groups = useMemo(() => {
    const out: { month: string; items: Workout[] }[] = [];
    for (const w of workouts ?? EMPTY) {
      const month = formatMonth(w.startedAt);
      const last = out[out.length - 1];
      if (last?.month === month) last.items.push(w);
      else out.push({ month, items: [w] });
    }
    return out;
  }, [workouts]);

  return (
    <>
      <Header title="Historik" />
      <Page>
        {workouts && workouts.length === 0 && (
          <div className="mt-6">
            <Empty text="Ingen træninger endnu." action={<Button onClick={() => navigate('/')}>Start en træning</Button>} />
          </div>
        )}
        {groups.map((g) => (
          <section key={g.month}>
            <h2 className="mt-6 mb-2 text-[15px] font-semibold text-muted">{g.month}</h2>
            <ul className="flex flex-col gap-2">
              {g.items.map((w) => {
                const n = prCount(w, prs);
                return (
                  <li key={w.id}>
                    <Link to={`/history/${w.id}`} className="block rounded-card bg-surface px-4 py-3 active:bg-surface-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[17px] font-semibold">{w.name}</span>
                        {n > 0 && (
                          <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-pr">
                            <TrophyIcon size={16} weight="fill" />
                            {n}
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] text-muted">{formatDateTime(w.startedAt)}</div>
                      <div className="tnum mt-2 flex gap-4 text-[14px]">
                        <span>{formatDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</span>
                        <span>
                          {formatNumber(kgToDisplay(workoutVolume(w, typeOf), settings.unit), 0)} {settings.unit}
                        </span>
                        <span>{doneSetCount(w)} sæt</span>
                      </div>
                      <ul className="mt-2 text-[14px] text-muted">
                        {w.exercises.slice(0, 4).map((we, i) => (
                          <li key={i} className="truncate">
                            {we.sets.length} x {exMap.get(we.exerciseId)?.name ?? 'Ukendt øvelse'}
                          </li>
                        ))}
                        {w.exercises.length > 4 && <li className="text-faint">og {w.exercises.length - 4} mere</li>}
                      </ul>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </Page>
    </>
  );
}

// ---------- Detaljer ----------

export function WorkoutDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const start = useStartWorkout();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const workout = useLiveQuery(() => db.workouts.get(id), [id]);
  const insights = useWorkoutInsights(workout ?? null, settings, exMap);
  const [menu, setMenu] = useState(false);
  const [saveAs, setSaveAs] = useState(false);
  const saved = params.get('saved') === '1';

  if (workout === undefined) return <Header back="/history" />;
  if (!workout) {
    return (
      <>
        <Header back="/history" title="Træning" />
        <Page>
          <div className="mt-6">
            <Empty text="Træningen findes ikke længere." />
          </div>
        </Page>
      </>
    );
  }

  const typeOf = (id: string) => exMap.get(id)?.type;
  const records = prCount(workout, insights.prs);

  const remove = async () => {
    setMenu(false);
    const c = await confirm({
      title: 'Slet træningen?',
      message: `${workout.name} fra ${formatDateTime(workout.startedAt)} slettes for altid.`,
      actions: [{ label: 'Slet træning', value: true, tone: 'danger' }],
    });
    if (!c) return;
    await db.workouts.delete(workout.id);
    navigate('/history', { replace: true });
  };

  return (
    <>
      <Header
        back={saved ? '/' : '/history'}
        title={workout.name}
        right={
          <IconButton label="Flere valg" onClick={() => setMenu(true)}>
            <DotsThreeVerticalIcon size={24} weight="bold" />
          </IconButton>
        }
      />
      <Page>
        {saved && (
          <div className="mt-4 rounded-card bg-accent-soft px-4 py-3">
            <p className="font-semibold">Træning gemt.</p>
            {records > 0 && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[15px]">
                <TrophyIcon size={16} weight="fill" className="text-pr" />
                {records === 1 ? '1 ny rekord' : `${records} nye rekorder`}
              </p>
            )}
          </div>
        )}
        <p className="mt-4 text-muted">{formatDateTime(workout.startedAt)}</p>
        <div className="mt-3 grid grid-cols-4 gap-3 rounded-card bg-surface p-3">
          <Stat label="Varighed" value={formatDuration((workout.endedAt ?? workout.startedAt) - workout.startedAt)} />
          <Stat label="Volumen" value={`${formatNumber(kgToDisplay(workoutVolume(workout, typeOf), settings.unit), 0)} ${settings.unit}`} />
          <Stat label="Sæt" value={doneSetCount(workout)} />
          <Stat label="Rekorder" value={records} />
        </div>
        {workout.notes && <p className="mt-4 whitespace-pre-line">{workout.notes}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {workout.exercises.map((we, i) => {
            const ex = exMap.get(we.exerciseId);
            const labels = setLabels(we.sets);
            return (
              <section key={i} className="rounded-card bg-surface px-4 py-3">
                <Link to={`/exercises/${we.exerciseId}`} className="font-semibold">
                  {ex?.name ?? 'Ukendt øvelse'}
                </Link>
                {we.notes && <p className="mt-1 text-[14px] text-muted">{we.notes}</p>}
                <ul className="tnum mt-2 flex flex-col gap-1 text-[15px]">
                  {we.sets.map((s, j) => {
                    const kinds = insights.prs.get(s.id);
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <span className={`w-5 text-center font-semibold ${s.type === 'warmup' ? 'text-muted' : s.type === 'failure' ? 'text-danger' : ''}`}>
                          {labels[j]}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">
                          {describeSet(s, ex?.type ?? 'weight_reps', settings.unit)}
                          {ex?.type === 'weight_reps' && <span className="text-muted"> {settings.unit}</span>}
                        </span>
                        {kinds && (
                          <span className="flex min-w-0 items-center gap-1 text-[13px] text-pr">
                            <TrophyIcon size={14} weight="fill" className="shrink-0" />
                            <span className="truncate">{kinds.map((k) => PR_LABELS[k]).join(', ')}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="mt-6">
          <Button tone="secondary" size="lg" block onClick={() => void start({ from: workout })}>
            <RepeatIcon size={20} weight="bold" />
            Gentag træningen
          </Button>
        </div>
      </Page>

      <Sheet open={menu} onClose={() => setMenu(false)} title={workout.name}>
        <SheetActions
          items={[
            { label: 'Redigér', icon: <PencilSimpleIcon size={22} />, onClick: () => navigate(`/history/${workout.id}/edit`) },
            { label: 'Gentag træningen', icon: <RepeatIcon size={22} />, onClick: () => (setMenu(false), void start({ from: workout })) },
            { label: 'Gem som rutine', icon: <BookmarkSimpleIcon size={22} />, onClick: () => (setMenu(false), setSaveAs(true)) },
            { label: 'Slet træning', icon: <TrashIcon size={22} />, onClick: () => void remove(), tone: 'danger' },
          ]}
        />
      </Sheet>
      <RenameSheet
        key={workout.name}
        open={saveAs}
        name={workout.name}
        title="Navn på rutinen"
        onClose={() => setSaveAs(false)}
        onSave={async (name) => {
          setSaveAs(false);
          const r = await saveWorkoutAsRoutine(workout, name);
          toast({ message: `Rutinen ${r.name} er oprettet` });
          navigate(`/routines/${r.id}`);
        }}
      />
    </>
  );
}

// ---------- Redigér gammel træning ----------

export function WorkoutEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirm } = useDialogs();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const [draft, setDraftState] = useState<Workout | null>(null);
  const draftRef = useRef<Workout | null>(null);
  const original = useRef('');
  const insights = useWorkoutInsights(draft, settings, exMap);

  useEffect(() => {
    void db.workouts.get(id).then((w) => {
      if (!w) return;
      original.current = JSON.stringify(w);
      draftRef.current = w;
      setDraftState(w);
    });
  }, [id]);

  if (!draft) return <Header back />;

  const update = (fn: (w: Workout) => void) => {
    if (!draftRef.current) return;
    const next = structuredClone(draftRef.current);
    fn(next);
    next.exerciseIds = exerciseIdsOf(next.exercises);
    draftRef.current = next;
    setDraftState(next);
  };

  const leave = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (JSON.stringify(draftRef.current) !== original.current) {
      const c = await confirm({
        title: 'Kassér ændringer?',
        actions: [{ label: 'Kassér ændringer', value: true, tone: 'danger' }],
        cancelLabel: 'Fortsæt med at redigere',
      });
      if (!c) return;
    }
    goBackOr(navigate, `/history/${id}`);
  };

  const save = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const w = draftRef.current;
    if (!w) return;
    const cleaned = cleanForSave(w);
    if (!cleaned.exercises.length) {
      const c = await confirm({
        title: 'Ingen færdige sæt tilbage',
        message: 'Uden færdige sæt er der intet at gemme. Slet træningen i stedet?',
        actions: [{ label: 'Slet træning', value: true, tone: 'danger' }],
      });
      if (!c) return;
      await db.workouts.delete(w.id);
      navigate('/history', { replace: true });
      return;
    }
    await db.workouts.put(cleaned);
    goBackOr(navigate, `/history/${id}`);
  };

  return (
    <>
      <Header
        title="Redigér træning"
        right={
          <>
            <Button tone="ghost" size="sm" onClick={() => void leave()}>
              Annullér
            </Button>
            <Button tone="primary" size="sm" className="mr-1" onClick={() => void save()}>
              Gem
            </Button>
          </>
        }
      />
      <Page className="px-2">
        <div className="mt-4 flex flex-col gap-3 px-2">
          <Field label="Navn">
            <input className={inputClass} value={draft.name} onChange={(e) => update((w) => (w.name = e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start">
              <input
                type="datetime-local"
                className={inputClass}
                value={toLocalInput(draft.startedAt)}
                onChange={(e) => {
                  const t = fromLocalInput(e.target.value);
                  if (t) update((w) => {
                    const len = (w.endedAt ?? t) - w.startedAt;
                    w.startedAt = t;
                    w.endedAt = t + Math.max(0, len);
                  });
                }}
              />
            </Field>
            <Field label="Slut">
              <input
                type="datetime-local"
                className={inputClass}
                value={toLocalInput(draft.endedAt ?? draft.startedAt)}
                onChange={(e) => {
                  const t = fromLocalInput(e.target.value);
                  if (t && t > draft.startedAt) update((w) => (w.endedAt = t));
                }}
              />
            </Field>
          </div>
          <Field label="Note">
            <textarea
              className={`${inputClass} min-h-16 py-2`}
              value={draft.notes ?? ''}
              onChange={(e) => update((w) => (w.notes = e.target.value || undefined))}
            />
          </Field>
        </div>
        <div className="mt-4">
          <WorkoutEditor workout={draft} update={update} mode="edit" insights={insights} settings={settings} exMap={exMap} />
        </div>
      </Page>
    </>
  );
}
