import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { db } from '../db/db';
import type { Routine } from '../db/types';
import { relativeDay } from '../lib/dates';
import { exportBackupFile } from '../lib/exporter';
import { formatClock } from '../lib/units';
import { useNow } from '../lib/useNow';
import { useExerciseMap } from '../state/exercises';
import { useSettings } from '../state/settings';
import { useStartWorkout } from '../state/useStartWorkout';
import { useActiveWorkout } from '../state/workout';
import { useDialogs } from '../components/Sheet';
import { Button, Empty, Header, Page, SectionTitle } from '../components/ui';

const BACKUP_DAYS = 14;

export function TrainPage() {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const active = useActiveWorkout();
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), []);
  const lastDone = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.workouts.where('routineId').above('').each((w) => {
      if (w.endedAt && w.routineId && (m.get(w.routineId) ?? 0) < w.startedAt) m.set(w.routineId, w.startedAt);
    });
    return m;
  }, []);
  const workoutCount = useLiveQuery(() => db.workouts.count(), []) ?? 0;
  const settings = useSettings();
  const exMap = useExerciseMap();
  const now = useNow(active ? 1000 : 60000);
  const { toast } = useDialogs();

  const backupDue =
    workoutCount > 0 && (!settings.lastBackupAt || now - settings.lastBackupAt > BACKUP_DAYS * 86400000);

  return (
    <>
      <Header title="Træn" />
      <Page>
        {backupDue && (
          <div className="mt-4 flex items-center gap-3 rounded-card border border-line px-4 py-3">
            <p className="flex-1 text-[15px] text-muted">
              {settings.lastBackupAt ? `Seneste backup ${relativeDay(settings.lastBackupAt, now)}.` : 'Du har ikke taget en backup endnu.'}
            </p>
            <Button
              size="sm"
              onClick={async () => {
                const r = await exportBackupFile();
                if (r !== 'cancelled') toast({ message: 'Backup gemt' });
              }}
            >
              Tag backup
            </Button>
          </div>
        )}

        {active ? (
          <div className="mt-4 rounded-card bg-surface p-4">
            <p className="text-[15px] text-muted">Træning i gang</p>
            <p className="mt-0.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-xl font-semibold">{active.name}</span>
              <span className="tnum text-xl font-semibold">{formatClock((now - active.startedAt) / 1000)}</span>
            </p>
            <Button tone="primary" size="lg" block className="mt-3" onClick={() => navigate('/workout')}>
              Fortsæt træning
            </Button>
          </div>
        ) : (
          <Button tone="primary" size="lg" block className="mt-4" onClick={() => void start()}>
            Start tom træning
          </Button>
        )}

        <SectionTitle
          right={
            <Button tone="ghost" size="sm" onClick={() => navigate('/routines/new')}>
              <PlusIcon size={18} weight="bold" />
              Ny rutine
            </Button>
          }
        >
          Rutiner
        </SectionTitle>

        {routines && routines.length === 0 && (
          <Empty text="Ingen rutiner endnu." action={<Button onClick={() => navigate('/routines/new')}>Opret rutine</Button>} />
        )}
        <ul className="flex flex-col gap-2">
          {routines?.map((r) => (
            <li key={r.id}>
              <RoutineCard
                routine={r}
                names={r.exercises.map((e) => exMap.get(e.exerciseId)?.name ?? '').filter(Boolean)}
                last={lastDone?.get(r.id)}
                now={now}
                onStart={() => void start({ routine: r })}
              />
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}

function RoutineCard({
  routine,
  names,
  last,
  now,
  onStart,
}: {
  routine: Routine;
  names: string[];
  last?: number;
  now: number;
  onStart: () => void;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-card bg-surface">
      <Link to={`/routines/${routine.id}`} className="min-w-0 flex-1 px-4 py-3 active:bg-surface-2">
        <span className="block text-[17px] font-semibold">{routine.name}</span>
        <span className="mt-0.5 line-clamp-2 text-[14px] text-muted">{names.join(', ') || 'Ingen øvelser'}</span>
        <span className="mt-1 block text-[13px] text-faint">{last ? `Sidst lavet ${relativeDay(last, now)}` : 'Ikke lavet endnu'}</span>
      </Link>
      <button
        type="button"
        onClick={onStart}
        aria-label={`Start ${routine.name}`}
        className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-line text-[14px] font-semibold text-accent active:bg-surface-2"
      >
        <PlayIcon size={24} weight="fill" />
        Start
      </button>
    </div>
  );
}
