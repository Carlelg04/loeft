import { ArchiveIcon, DotsThreeVerticalIcon, PencilSimpleIcon, PlusIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ExerciseForm } from '../components/ExerciseForm';
import { createExercise, ExerciseRow, exerciseSubtitle, FilterBar, useExerciseFilter } from '../components/ExercisePicker';
import { Sheet, SheetActions, useDialogs } from '../components/Sheet';
import { Empty, Header, IconButton, Page, Segmented } from '../components/ui';
import { db } from '../db/db';
import { EXERCISE_TYPE_LABELS, MUSCLE_LABELS, type Exercise, type Workout } from '../db/types';
import { estimate1RM, exerciseRecords, exerciseVolume, isWorkingSet, PR_LABELS, setLabels, type RecordEntry } from '../lib/calc';
import { formatDate, formatDateTime } from '../lib/dates';
import { goBackOr } from '../lib/nav';
import { describeSet } from '../lib/sets';
import { formatClock, formatNumber, formatWeight, kgToDisplay } from '../lib/units';
import { useExercises } from '../state/exercises';
import { useRecentExerciseIds } from '../state/insights';
import { useSettings } from '../state/settings';

const LineChart = lazy(() => import('../components/LineChart'));

// ---------- Liste ----------

export function ExercisesPage() {
  const navigate = useNavigate();
  const all = useExercises() ?? [];
  const f = useExerciseFilter(all);
  const recentIds = useRecentExerciseIds(5);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const recent = recentIds.map((id) => byId.get(id)).filter((e): e is Exercise => !!e && !e.archived);

  return (
    <>
      <Header
        title="Øvelser"
        right={
          <IconButton label="Ny øvelse" onClick={() => navigate('/exercises/new')}>
            <PlusIcon size={24} weight="bold" />
          </IconButton>
        }
      >
        <div className="px-4 pb-2">
          <FilterBar f={f} />
        </div>
      </Header>
      <Page>
        {!f.filtering && recent.length > 0 && (
          <>
            <h2 className="mt-4 text-[14px] font-semibold text-muted">Senest brugt</h2>
            {recent.map((e) => (
              <ExerciseRow key={e.id} e={e} onClick={() => navigate(`/exercises/${e.id}`)} />
            ))}
            <h2 className="mt-6 text-[14px] font-semibold text-muted">Alle øvelser ({f.results.length})</h2>
          </>
        )}
        <div className={f.filtering || !recent.length ? 'mt-2' : ''}>
          {f.results.map((e) => (
            <ExerciseRow key={e.id} e={e} onClick={() => navigate(`/exercises/${e.id}`)} />
          ))}
        </div>
        {f.results.length === 0 && <p className="py-8 text-center text-muted">Ingen øvelser matcher.</p>}
      </Page>
    </>
  );
}

// ---------- Detaljer ----------

type Metric = 'e1rm' | 'heaviest' | 'volume' | 'reps' | 'assist' | 'duration' | 'distance';

function metricsFor(ex: Exercise): { value: Metric; label: string }[] {
  switch (ex.type) {
    case 'weight_reps':
      return [
        { value: 'e1rm', label: '1RM' },
        { value: 'heaviest', label: 'Tungeste' },
        { value: 'volume', label: 'Volumen' },
      ];
    case 'bodyweight_reps':
      return [
        { value: 'reps', label: 'Reps' },
        { value: 'heaviest', label: 'Ekstra vægt' },
      ];
    case 'assisted_bodyweight':
      return [
        { value: 'reps', label: 'Reps' },
        { value: 'assist', label: 'Hjælp' },
      ];
    case 'duration':
      return [{ value: 'duration', label: 'Tid' }];
    case 'distance_duration':
      return [{ value: 'distance', label: 'Distance' }];
  }
}

function metricValue(ex: Exercise, w: Workout, m: Metric): number | undefined {
  const sets = w.exercises.filter((e) => e.exerciseId === ex.id).flatMap((e) => e.sets.filter((s) => s.done && isWorkingSet(s)));
  if (!sets.length) return undefined;
  const max = (vals: (number | undefined)[]) => {
    const v = vals.filter((x): x is number => x !== undefined && x > 0);
    return v.length ? Math.max(...v) : undefined;
  };
  switch (m) {
    case 'e1rm':
      return max(sets.map((s) => estimate1RM(s.kg, s.reps)));
    case 'heaviest':
      return max(sets.map((s) => (s.reps ? s.kg : undefined)));
    case 'volume':
      return w.exercises.filter((e) => e.exerciseId === ex.id).reduce((n, e) => n + exerciseVolume(e, ex.type), 0) || undefined;
    case 'reps':
      return max(sets.map((s) => s.reps));
    case 'assist': {
      const v = sets.filter((s) => s.reps).map((s) => s.kg ?? 0);
      return v.length ? Math.min(...v) : undefined;
    }
    case 'duration':
      return max(sets.map((s) => s.durationSec));
    case 'distance':
      return max(sets.map((s) => s.distanceM));
  }
}

const PERIODS = [
  { value: '90', label: '3 mdr' },
  { value: '365', label: '1 år' },
  { value: 'all', label: 'Alt' },
] as const;

export function ExerciseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirm, toast } = useDialogs();
  const settings = useSettings();
  const exercise = useLiveQuery(() => db.exercises.get(id), [id]);
  const workouts = useLiveQuery(
    async () =>
      (await db.workouts.where('exerciseIds').equals(id).toArray())
        .filter((w) => w.endedAt)
        .sort((a, b) => b.startedAt - a.startedAt),
    [id],
  );
  const [tab, setTab] = useState<'history' | 'records' | 'chart'>('history');
  const [metric, setMetric] = useState<Metric | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('365');
  const [menu, setMenu] = useState(false);

  const unit = settings.unit;
  const metrics = exercise ? metricsFor(exercise) : [];
  const activeMetric = metric ?? metrics[0]?.value ?? 'e1rm';

  const chart = useMemo(() => {
    if (!exercise || !workouts) return { xs: [] as number[], ys: [] as number[] };
    const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400000;
    const pts = [...workouts]
      .reverse()
      .filter((w) => w.startedAt >= since)
      .map((w) => [w.startedAt / 1000, metricValue(exercise, w, activeMetric)] as const)
      .filter((p): p is readonly [number, number] => p[1] !== undefined);
    return { xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]) };
  }, [exercise, workouts, activeMetric, period]);

  const formatMetric = useCallback(
    (v: number) => {
      if (activeMetric === 'reps') return formatNumber(v, 0);
      if (activeMetric === 'duration') return formatClock(v);
      if (activeMetric === 'distance') return `${formatNumber(v, 0)} m`;
      if (activeMetric === 'volume') return formatNumber(kgToDisplay(v, unit), 0);
      if (activeMetric === 'e1rm') return `${formatNumber(kgToDisplay(v, unit), 1)} ${unit}`;
      return `${formatWeight(v, unit)} ${unit}`;
    },
    [activeMetric, unit],
  );

  if (exercise === undefined) return <Header back />;
  if (!exercise) {
    return (
      <>
        <Header back="/exercises" title="Øvelse" />
        <Page>
          <div className="mt-6">
            <Empty text="Øvelsen findes ikke længere." />
          </div>
        </Page>
      </>
    );
  }

  const hasHistory = (workouts?.length ?? 0) > 0;

  const archive = async () => {
    setMenu(false);
    await db.exercises.update(exercise.id, { archived: !exercise.archived });
    toast({ message: exercise.archived ? 'Øvelsen er tilbage i listen' : 'Øvelsen er skjult fra listen' });
  };
  const remove = async () => {
    setMenu(false);
    const c = await confirm({
      title: `Slet ${exercise.name}?`,
      actions: [{ label: 'Slet øvelse', value: true, tone: 'danger' }],
    });
    if (!c) return;
    await db.exercises.delete(exercise.id);
    navigate('/exercises', { replace: true });
  };

  return (
    <>
      <Header
        back
        title={exercise.name}
        right={
          <IconButton label="Flere valg" onClick={() => setMenu(true)}>
            <DotsThreeVerticalIcon size={24} weight="bold" />
          </IconButton>
        }
      />
      <Page>
        <p className="mt-4 text-muted">
          {exerciseSubtitle(exercise)}. {EXERCISE_TYPE_LABELS[exercise.type]}.
          {exercise.secondaryMuscles.length > 0 && ` Også ${exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(', ')}.`}
        </p>
        {exercise.notes && <p className="mt-2 whitespace-pre-line">{exercise.notes}</p>}
        {exercise.archived && <p className="mt-2 text-[15px] text-faint">Skjult fra øvelseslisten.</p>}

        <div className="mt-4">
          <Segmented
            label="Visning"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'history', label: 'Historik' },
              { value: 'records', label: 'Rekorder' },
              { value: 'chart', label: 'Graf' },
            ]}
          />
        </div>

        {!hasHistory && workouts && (
          <div className="mt-4">
            <Empty text="Du har ikke lavet øvelsen endnu." />
          </div>
        )}

        {hasHistory && tab === 'history' && (
          <ul className="mt-4 flex flex-col gap-2">
            {workouts!.map((w) => (
              <li key={w.id} className="rounded-card bg-surface px-4 py-3">
                <Link to={`/history/${w.id}`} className="block">
                  <span className="font-semibold">{w.name}</span>
                  <span className="block text-[14px] text-muted">{formatDateTime(w.startedAt)}</span>
                </Link>
                {w.exercises
                  .filter((e) => e.exerciseId === exercise.id)
                  .map((e, i) => {
                    const labels = setLabels(e.sets);
                    return (
                      <ul key={i} className="tnum mt-2 flex flex-col gap-0.5 text-[15px]">
                        {e.notes && <li className="text-[14px] text-muted">{e.notes}</li>}
                        {e.sets.map((s, j) => (
                          <li key={s.id} className="flex gap-3">
                            <span className={`w-5 text-center font-semibold ${s.type === 'warmup' ? 'text-muted' : ''}`}>{labels[j]}</span>
                            <span>{describeSet(s, exercise.type, unit)}</span>
                            {exercise.type === 'weight_reps' && s.type !== 'warmup' && estimate1RM(s.kg, s.reps) ? (
                              <span className="text-faint">1RM {formatNumber(kgToDisplay(estimate1RM(s.kg, s.reps)!, unit), 1)}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    );
                  })}
              </li>
            ))}
          </ul>
        )}

        {hasHistory && tab === 'records' && <Records records={exerciseRecords(exercise, workouts!)} exercise={exercise} unit={unit} />}

        {hasHistory && tab === 'chart' && (
          <div className="mt-4 flex flex-col gap-3">
            {metrics.length > 1 && (
              <Segmented label="Mål" value={activeMetric} onChange={(v) => setMetric(v)} options={metrics} />
            )}
            <Segmented label="Periode" value={period} onChange={setPeriod} options={[...PERIODS]} />
            <div className="rounded-card bg-surface p-3">
              {chart.xs.length === 0 ? (
                <p className="py-10 text-center text-muted">Ingen data i perioden.</p>
              ) : (
                <Suspense fallback={<div style={{ height: 250 }} />}>
                  <LineChart xs={chart.xs} ys={chart.ys} format={formatMetric} />
                </Suspense>
              )}
            </div>
          </div>
        )}
      </Page>

      <Sheet open={menu} onClose={() => setMenu(false)} title={exercise.name}>
        <SheetActions
          items={[
            { label: 'Redigér', icon: <PencilSimpleIcon size={22} />, onClick: () => navigate(`/exercises/${exercise.id}/edit`) },
            {
              label: exercise.archived ? 'Vis i øvelseslisten igen' : 'Skjul fra øvelseslisten',
              icon: <ArchiveIcon size={22} />,
              onClick: () => void archive(),
            },
            {
              label: 'Slet øvelse',
              icon: <TrashIcon size={22} />,
              onClick: () => void remove(),
              tone: 'danger',
              hidden: hasHistory || !workouts,
            },
          ]}
        />
      </Sheet>
    </>
  );
}

function Records({ records, exercise, unit }: { records: RecordEntry[]; exercise: Exercise; unit: 'kg' | 'lb' }) {
  const fmt = (r: RecordEntry) => {
    switch (r.kind) {
      case 'heaviest':
        return `${formatWeight(r.value, unit)} ${unit}`;
      case 'e1rm':
        return `${formatNumber(kgToDisplay(r.value, unit), 1)} ${unit}`;
      case 'setVolume':
      case 'sessionVolume':
        return `${formatNumber(kgToDisplay(r.value, unit), 0)} ${unit}`;
      case 'mostReps':
        return `${r.value} reps`;
      case 'leastAssist':
        return `${formatWeight(-r.value, unit)} ${unit} hjælp`;
      case 'longestDuration':
        return formatClock(r.value);
      case 'longestDistance':
        return `${formatNumber(r.value, 0)} m`;
    }
  };
  const label = (r: RecordEntry) => (r.kind === 'sessionVolume' ? 'Største volumen på én træning' : PR_LABELS[r.kind]);
  return (
    <ul className="mt-4 flex flex-col overflow-hidden rounded-card bg-surface">
      {records.map((r) => (
        <li key={r.kind} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <TrophyIcon size={20} weight="fill" className="shrink-0 text-pr" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] text-muted">{label(r)}</div>
            <div className="text-[13px] text-faint">
              {formatDate(r.date)}
              {r.set && r.kind !== 'heaviest' && r.kind !== 'mostReps' ? `, ${describeSet(r.set, exercise.type, unit)}` : ''}
            </div>
          </div>
          <div className="tnum text-right text-[17px] font-semibold">{fmt(r)}</div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Opret og redigér ----------

export function ExerciseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const all = useExercises();
  const existing = id ? all?.find((e) => e.id === id) : undefined;
  if (!all || (id && !existing)) return <Header back />;
  return (
    <>
      <Header back title={id ? 'Redigér øvelse' : 'Ny øvelse'} />
      <Page>
        <div className="mt-4">
          <ExerciseForm
            initial={existing}
            existingNames={all.map((e) => e.name)}
            onSave={async (d) => {
              if (existing) {
                await db.exercises.put({ ...existing, ...d });
                goBackOr(navigate, `/exercises/${existing.id}`);
              } else {
                const ex = await createExercise(d);
                navigate(`/exercises/${ex.id}`, { replace: true });
              }
            }}
          />
        </div>
      </Page>
    </>
  );
}
