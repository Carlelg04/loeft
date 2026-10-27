import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Exercise } from '../db/types';

const EMPTY: Exercise[] = [];

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.toArray(), []);
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises() ?? EMPTY;
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}
