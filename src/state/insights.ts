import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Exercise, Settings, Workout, WorkoutExercise } from '../db/types';
import { detectPRs, findPreviousExercise, type PRKind } from '../lib/calc';
import { exerciseIdsOf } from './workout';

const EMPTY: Workout[] = [];

/** Afsluttede træninger før denne, som indeholder mindst én af dens øvelser. */
export function useWorkoutHistory(workout: Workout | null | undefined): Workout[] {
  const ids = workout ? exerciseIdsOf(workout.exercises) : [];
  const key = ids.join('|');
  const id = workout?.id;
  const startedAt = workout?.startedAt ?? 0;
  return (
    useLiveQuery(async () => {
      if (!key) return EMPTY;
      const list = await db.workouts.where('exerciseIds').anyOf(key.split('|')).distinct().toArray();
      return list.filter((w) => w.endedAt && w.id !== id && w.startedAt < startedAt);
    }, [key, id, startedAt]) ?? EMPTY
  );
}

export interface WorkoutInsights {
  history: Workout[];
  prevByExercise: Map<string, WorkoutExercise | undefined>;
  prs: Map<string, PRKind[]>;
}

export function useWorkoutInsights(
  workout: Workout | null | undefined,
  settings: Settings,
  exMap: Map<string, Exercise>,
): WorkoutInsights {
  const history = useWorkoutHistory(workout);
  const ids = workout ? exerciseIdsOf(workout.exercises).join('|') : '';
  const prevByExercise = useMemo(() => {
    const m = new Map<string, WorkoutExercise | undefined>();
    if (!workout) return m;
    const ctx = { workoutId: workout.id, startedAt: workout.startedAt, routineId: workout.routineId };
    for (const id of ids.split('|').filter(Boolean)) m.set(id, findPreviousExercise(history, id, ctx, settings.previousFrom));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, ids, workout?.id, workout?.startedAt, workout?.routineId, settings.previousFrom]);
  const prs = useMemo(
    () => (workout ? detectPRs([...history, workout], (id) => exMap.get(id)?.type) : new Map<string, PRKind[]>()),
    [history, workout, exMap],
  );
  return { history, prevByExercise, prs };
}

/** Senest brugte øvelser, nyeste først. */
export function useRecentExerciseIds(limit = 8): string[] {
  return (
    useLiveQuery(
      async () => {
        const ws = await db.workouts.orderBy('startedAt').reverse().limit(30).toArray();
        const out: string[] = [];
        for (const w of ws) for (const e of w.exercises) if (!out.includes(e.exerciseId)) out.push(e.exerciseId);
        return out.slice(0, limit);
      },
      [limit],
    ) ?? []
  );
}
