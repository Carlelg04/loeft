import { SCHEMA_VERSION, type LoeftDB } from '../db/db';
import { DEFAULT_SETTINGS, type Exercise, type Routine, type Settings, type Workout } from '../db/types';

export interface BackupFile {
  app: 'loeft';
  schemaVersion: number;
  exportedAt: number;
  data: {
    exercises: Exercise[];
    routines: Routine[];
    workouts: Workout[];
    settings?: Partial<Settings>;
  };
}

export async function createBackup(db: LoeftDB, now = Date.now()): Promise<BackupFile> {
  return db.transaction('r', db.exercises, db.routines, db.workouts, db.kv, async () => {
    const settings = (await db.kv.get('settings'))?.value as Settings | undefined;
    return {
      app: 'loeft' as const,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now,
      data: {
        exercises: await db.exercises.toArray(),
        routines: await db.routines.toArray(),
        workouts: await db.workouts.toArray(),
        settings,
      },
    };
  });
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `loeft-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export async function importBackup(db: LoeftDB, backup: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, db.workouts, db.kv, async () => {
    if (mode === 'replace') {
      await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear()]);
      await db.kv.delete('restTimer');
      const current = (await db.kv.get('settings'))?.value as Settings | undefined;
      await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...current, ...backup.data.settings } });
    }
    await db.exercises.bulkPut(backup.data.exercises);
    await db.routines.bulkPut(backup.data.routines);
    await db.workouts.bulkPut(backup.data.workouts);
  });
}

// ---------- CSV ----------

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoLocal(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function workoutsToCSV(workouts: Workout[], exerciseById: Map<string, Exercise>): string {
  const header = [
    'start_time',
    'end_time',
    'workout',
    'exercise',
    'set_index',
    'set_type',
    'weight_kg',
    'reps',
    'duration_seconds',
    'distance_m',
    'rpe',
    'exercise_notes',
    'workout_notes',
  ];
  const rows = [header.join(',')];
  const sorted = workouts.filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    for (const we of w.exercises) {
      const name = exerciseById.get(we.exerciseId)?.name ?? we.exerciseId;
      we.sets.forEach((s, i) => {
        if (!s.done) return;
        rows.push(
          [
            isoLocal(w.startedAt),
            w.endedAt ? isoLocal(w.endedAt) : '',
            w.name,
            name,
            i,
            s.type,
            s.kg,
            s.reps,
            s.durationSec,
            s.distanceM,
            s.rpe,
            we.notes,
            w.notes,
          ]
            .map(csvCell)
            .join(','),
        );
      });
    }
  }
  return rows.join('\n') + '\n';
}
