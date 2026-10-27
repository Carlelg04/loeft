import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise, Routine, RoutineExercise, RoutineSet, Workout, WorkoutExercise, WorkoutSet } from '../db/types';
import { uid } from '../lib/id';

export async function getActiveWorkout(): Promise<Workout | null> {
  return (
    (await db.workouts
      .orderBy('startedAt')
      .reverse()
      .filter((w) => !w.endedAt)
      .first()) ?? null
  );
}

/** undefined mens der indlæses, null hvis ingen træning er i gang. */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(getActiveWorkout, []);
}

export function defaultWorkoutName(t: number): string {
  const h = new Date(t).getHours();
  if (h < 5) return 'Nattræning';
  if (h < 10) return 'Morgentræning';
  if (h < 12) return 'Formiddagstræning';
  if (h < 17) return 'Eftermiddagstræning';
  return 'Aftentræning';
}

export function newSet(partial: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: uid(), type: 'normal', done: false, ...partial };
}

function setFromTarget(rs: RoutineSet): WorkoutSet {
  return newSet({
    type: rs.type,
    targetKg: rs.targetKg,
    targetReps: rs.targetReps,
    targetRepsMax: rs.targetRepsMax,
    targetDurationSec: rs.targetDurationSec,
    targetDistanceM: rs.targetDistanceM,
  });
}

export function exerciseIdsOf(exercises: { exerciseId: string }[]): string[] {
  return Array.from(new Set(exercises.map((e) => e.exerciseId)));
}

export async function startWorkout(opts: { routine?: Routine; from?: Workout } = {}): Promise<Workout> {
  const now = Date.now();
  let exercises: WorkoutExercise[] = [];
  let name = defaultWorkoutName(now);
  let routineId: string | undefined;
  if (opts.routine) {
    name = opts.routine.name;
    routineId = opts.routine.id;
    exercises = opts.routine.exercises.map((re) => ({
      exerciseId: re.exerciseId,
      restSec: re.restSec,
      notes: re.notes,
      sets: re.sets.map(setFromTarget),
    }));
  } else if (opts.from) {
    name = opts.from.name;
    routineId = opts.from.routineId;
    exercises = opts.from.exercises.map((we) => ({
      exerciseId: we.exerciseId,
      restSec: we.restSec,
      notes: we.notes,
      sets: we.sets
        .filter((s) => s.done)
        .map((s) =>
          newSet({
            type: s.type,
            targetKg: s.kg,
            targetReps: s.reps,
            targetDurationSec: s.durationSec,
            targetDistanceM: s.distanceM,
          }),
        ),
    }));
  }
  const w: Workout = { id: uid(), name, routineId, startedAt: now, exercises, exerciseIds: exerciseIdsOf(exercises) };
  await db.workouts.add(w);
  await db.kv.delete('restTimer');
  return w;
}

/** Læs, ændr og gem i én transaktion, så hurtige ændringer ikke overskriver hinanden. */
export async function mutateWorkout(id: string, fn: (w: Workout) => void): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    fn(w);
    w.exerciseIds = exerciseIdsOf(w.exercises);
    await db.workouts.put(w);
  });
}

export async function discardWorkout(id: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.kv, async () => {
    await db.workouts.delete(id);
    await db.kv.delete('restTimer');
  });
}

/** Fjerner ufærdige sæt, tomme øvelser og markeringen "maskine optaget". */
export function cleanForSave(w: Workout): Workout {
  const exercises = w.exercises
    .map(({ skipped: _skipped, ...we }) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
    .filter((we) => we.sets.length > 0);
  return { ...w, exercises, exerciseIds: exerciseIdsOf(exercises) };
}

export async function finishWorkout(w: Workout): Promise<void> {
  const cleaned = cleanForSave(w);
  await db.transaction('rw', db.workouts, db.kv, async () => {
    await db.workouts.put({ ...cleaned, endedAt: cleaned.endedAt ?? Date.now() });
    await db.kv.delete('restTimer');
  });
}

export function newWorkoutExercise(ex: Exercise, defaultRestSec: number): WorkoutExercise {
  return { exerciseId: ex.id, restSec: ex.defaultRestSec ?? defaultRestSec, sets: [newSet()] };
}

// ---------- Rutiner ----------

/**
 * Rutinen, som den ville se ud med dagens sæt. Øvelser jeg lavede, får dagens sæt og vægte.
 * Øvelser jeg sprang over, bliver stående. Nye øvelser kommer sidst. Intervaller (8-10) bevares.
 */
export function routineExercisesFromWorkout(routine: Routine | undefined, w: Workout): RoutineExercise[] {
  const performed = w.exercises.filter((we) => we.sets.some((s) => s.done));
  const toRoutine = (we: WorkoutExercise, orig: RoutineExercise | undefined): RoutineExercise => ({
    exerciseId: we.exerciseId,
    restSec: we.restSec,
    notes: orig ? orig.notes : undefined,
    sets: we.sets
      .filter((s) => s.done)
      .map((s, i): RoutineSet => {
        const o = orig?.sets[i];
        const range = o?.targetRepsMax !== undefined && o.type === s.type;
        return clean({
          type: s.type,
          targetKg: s.kg,
          targetReps: range ? o!.targetReps : s.reps,
          targetRepsMax: range ? o!.targetRepsMax : undefined,
          targetDurationSec: s.durationSec,
          targetDistanceM: s.distanceM,
        });
      }),
  });
  if (!routine) return performed.map((we) => toRoutine(we, undefined));
  const used = new Set<number>();
  const result = routine.exercises.map((re) => {
    const idx = performed.findIndex((we, i) => !used.has(i) && we.exerciseId === re.exerciseId);
    if (idx === -1) return re;
    used.add(idx);
    return toRoutine(performed[idx], re);
  });
  performed.forEach((we, i) => {
    if (!used.has(i)) result.push(toRoutine(we, undefined));
  });
  return result;
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function normRoutineExercises(list: RoutineExercise[]): string {
  return JSON.stringify(
    list.map((re) => ({ e: re.exerciseId, r: re.restSec, s: re.sets.map((s) => clean({ ...s })) })),
  );
}

export function routineDiffers(routine: Routine, w: Workout): boolean {
  return normRoutineExercises(routine.exercises) !== normRoutineExercises(routineExercisesFromWorkout(routine, w));
}

export async function updateRoutineFromWorkout(routine: Routine, w: Workout): Promise<void> {
  await db.routines.put({ ...routine, exercises: routineExercisesFromWorkout(routine, w), updatedAt: Date.now() });
}

export async function saveWorkoutAsRoutine(w: Workout, name: string): Promise<Routine> {
  const count = await db.routines.count();
  const r: Routine = {
    id: uid(),
    name,
    order: count,
    updatedAt: Date.now(),
    exercises: routineExercisesFromWorkout(undefined, w),
  };
  await db.routines.add(r);
  return r;
}
