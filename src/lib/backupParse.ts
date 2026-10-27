import { z } from 'zod';
import { SCHEMA_VERSION } from '../db/db';
import {
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  MUSCLE_LABELS,
  SET_TYPE_LABELS,
  type Equipment,
  type ExerciseType,
  type Muscle,
  type SetType,
  type Workout,
} from '../db/types';
import type { BackupFile } from './backup';

// Validering af backup-filer. Ligger for sig selv, så zod kun hentes, når der importeres.
const keys = <K extends string>(r: Record<K, unknown>) => Object.keys(r) as [K, ...K[]];

const muscle = z.enum(keys<Muscle>(MUSCLE_LABELS));
const equipment = z.enum(keys<Equipment>(EQUIPMENT_LABELS));
const exerciseType = z.enum(keys<ExerciseType>(EXERCISE_TYPE_LABELS));
const setType = z.enum(keys<SetType>(SET_TYPE_LABELS));
const num = z.number();

const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  type: exerciseType,
  primaryMuscle: muscle,
  secondaryMuscles: z.array(muscle).default([]),
  equipment,
  isCustom: z.boolean(),
  defaultRestSec: num.optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
});

const routineSetSchema = z.object({
  type: setType,
  targetKg: num.optional(),
  targetReps: num.optional(),
  targetRepsMax: num.optional(),
  targetDurationSec: num.optional(),
  targetDistanceM: num.optional(),
});

const routineSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  notes: z.string().optional(),
  order: num,
  updatedAt: num,
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      restSec: num,
      notes: z.string().optional(),
      sets: z.array(routineSetSchema),
    }),
  ),
});

const workoutSetSchema = routineSetSchema.extend({
  id: z.string().min(1),
  kg: num.optional(),
  reps: num.optional(),
  durationSec: num.optional(),
  distanceM: num.optional(),
  rpe: num.optional(),
  done: z.boolean(),
  doneAt: num.optional(),
});

const workoutSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  routineId: z.string().optional(),
  startedAt: num,
  endedAt: num.optional(),
  notes: z.string().optional(),
  exerciseIds: z.array(z.string()).optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      restSec: num,
      notes: z.string().optional(),
      sets: z.array(workoutSetSchema),
      skipped: z.boolean().optional(),
    }),
  ),
});

const settingsSchema = z.object({
  unit: z.enum(['kg', 'lb']),
  defaultRestSec: num,
  previousFrom: z.enum(['any_workout', 'same_routine']),
  sound: z.boolean(),
  vibrate: z.boolean(),
  keepAwake: z.boolean(),
  theme: z.enum(['dark', 'light', 'system']),
  barKg: num,
  plates: z.array(num),
  lastBackupAt: num.optional(),
});

const backupSchema = z.object({
  app: z.literal('loeft'),
  schemaVersion: z.number().int().min(1),
  exportedAt: num,
  data: z.object({
    exercises: z.array(exerciseSchema),
    routines: z.array(routineSchema),
    workouts: z.array(workoutSchema),
    settings: settingsSchema.partial().optional(),
  }),
});

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Validerer og migrerer en backup. Ældre versioner løftes op til den nuværende. */
export function parseBackup(raw: unknown): ParseResult {
  if (raw && typeof raw === 'object' && 'schemaVersion' in raw) {
    const v = (raw as { schemaVersion: unknown }).schemaVersion;
    if (typeof v === 'number' && v > SCHEMA_VERSION) {
      return { ok: false, error: 'Backuppen er fra en nyere version af appen. Opdatér appen først.' };
    }
  }
  const res = backupSchema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    const where = issue?.path.map(String).join('.') || 'filen';
    return { ok: false, error: `Filen er ikke en gyldig backup (${where}: ${issue?.message ?? 'ukendt fejl'}).` };
  }
  const b = res.data;
  // Migrationer for kommende skemaversioner lægges her, i rækkefølge.
  const workouts: Workout[] = b.data.workouts.map((w) => ({
    ...w,
    exerciseIds: Array.from(new Set(w.exercises.map((e) => e.exerciseId))),
  }));
  return {
    ok: true,
    backup: {
      app: 'loeft',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: b.exportedAt,
      data: { exercises: b.data.exercises, routines: b.data.routines, workouts, settings: b.data.settings },
    },
  };
}

