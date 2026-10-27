import type { Exercise, ExerciseType, Muscle, SetType, Workout, WorkoutExercise, WorkoutSet } from '../db/types';

const EPS = 1e-6;

export function isWorkingSet(s: { type: SetType }): boolean {
  return s.type !== 'warmup';
}

/** Estimeret 1RM efter Epley. Ved 1 rep er 1RM lig med vægten. Kun 1-12 reps. */
export function estimate1RM(kg: number | undefined, reps: number | undefined): number | undefined {
  if (!kg || !reps || kg <= 0 || reps < 1 || reps > 12) return undefined;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

/** Volumen for ét sæt. Opvarmning og ufærdige sæt tæller ikke. Kropsvægt tæller kun ekstra kg. */
export function setVolume(s: WorkoutSet, type: ExerciseType | undefined): number {
  if (!s.done || s.type === 'warmup') return 0;
  if (type === 'weight_reps' || type === 'bodyweight_reps') return (s.kg ?? 0) * (s.reps ?? 0);
  return 0;
}

export function exerciseVolume(we: WorkoutExercise, type: ExerciseType | undefined): number {
  return we.sets.reduce((sum, s) => sum + setVolume(s, type), 0);
}

export function workoutVolume(w: Workout, typeOf: (id: string) => ExerciseType | undefined): number {
  return w.exercises.reduce((sum, we) => sum + exerciseVolume(we, typeOf(we.exerciseId)), 0);
}

export function doneSetCount(w: Workout): number {
  return w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0);
}

// ---------- Rekorder ----------

export type PRKind =
  | 'heaviest'
  | 'e1rm'
  | 'setVolume'
  | 'mostReps'
  | 'leastAssist'
  | 'longestDuration'
  | 'longestDistance';

export const PR_LABELS: Record<PRKind, string> = {
  heaviest: 'Tungeste vægt',
  e1rm: 'Bedste 1RM (estimeret)',
  setVolume: 'Største sæt-volumen',
  mostReps: 'Flest reps',
  leastAssist: 'Mindst hjælp',
  longestDuration: 'Længste tid',
  longestDistance: 'Længste distance',
};

export const PR_KINDS_BY_TYPE: Record<ExerciseType, PRKind[]> = {
  weight_reps: ['heaviest', 'e1rm', 'setVolume'],
  bodyweight_reps: ['mostReps', 'heaviest'],
  assisted_bodyweight: ['mostReps', 'leastAssist'],
  duration: ['longestDuration'],
  distance_duration: ['longestDistance'],
};

/** Værdi for en rekordtype, hvor højere altid er bedre. */
export function prValue(s: WorkoutSet, kind: PRKind): number | undefined {
  const reps = s.reps ?? 0;
  switch (kind) {
    case 'heaviest':
      return reps >= 1 && s.kg && s.kg > 0 ? s.kg : undefined;
    case 'e1rm':
      return estimate1RM(s.kg, s.reps);
    case 'setVolume':
      return reps >= 1 && s.kg && s.kg > 0 ? s.kg * reps : undefined;
    case 'mostReps':
      return reps >= 1 ? reps : undefined;
    case 'leastAssist':
      return reps >= 1 ? -(s.kg ?? 0) : undefined;
    case 'longestDuration':
      return s.durationSec && s.durationSec > 0 ? s.durationSec : undefined;
    case 'longestDistance':
      return s.distanceM && s.distanceM > 0 ? s.distanceM : undefined;
  }
}

/**
 * Finder rekorder i kronologisk rækkefølge. Første gang en øvelse laves, er det udgangspunktet
 * og ikke en rekord. Et sæt er en rekord, når det slår alt før det, også tidligere sæt i samme træning.
 */
export function detectPRs(
  workouts: Workout[],
  typeOf: (id: string) => ExerciseType | undefined,
): Map<string, PRKind[]> {
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  const best = new Map<string, Partial<Record<PRKind, number>>>();
  const seen = new Set<string>();
  const bySet = new Map<string, PRKind[]>();

  for (const w of sorted) {
    const seenNow = new Set<string>();
    for (const we of w.exercises) {
      const type = typeOf(we.exerciseId);
      if (!type) continue;
      const kinds = PR_KINDS_BY_TYPE[type];
      const b = best.get(we.exerciseId) ?? {};
      const hasHistory = seen.has(we.exerciseId);
      for (const s of we.sets) {
        if (!s.done || !isWorkingSet(s)) continue;
        seenNow.add(we.exerciseId);
        const hits: PRKind[] = [];
        for (const k of kinds) {
          const v = prValue(s, k);
          if (v === undefined) continue;
          const prev = b[k];
          if (prev === undefined || v > prev + EPS) {
            if (hasHistory && prev !== undefined) hits.push(k);
            b[k] = v;
          }
        }
        if (hits.length) bySet.set(s.id, hits);
      }
      best.set(we.exerciseId, b);
    }
    for (const id of seenNow) seen.add(id);
  }
  return bySet;
}

export interface RecordEntry {
  kind: PRKind | 'sessionVolume';
  value: number;
  set?: WorkoutSet;
  workoutId: string;
  date: number;
}

/** Bedste værdi pr. rekordtype for én øvelse, plus største samlede volumen på én træning. */
export function exerciseRecords(exercise: Exercise, workouts: Workout[]): RecordEntry[] {
  const kinds = PR_KINDS_BY_TYPE[exercise.type];
  const out = new Map<string, RecordEntry>();
  for (const w of workouts) {
    if (!w.endedAt) continue;
    let session = 0;
    for (const we of w.exercises) {
      if (we.exerciseId !== exercise.id) continue;
      session += exerciseVolume(we, exercise.type);
      for (const s of we.sets) {
        if (!s.done || !isWorkingSet(s)) continue;
        for (const k of kinds) {
          const v = prValue(s, k);
          if (v === undefined) continue;
          const cur = out.get(k);
          if (!cur || v > cur.value + EPS) out.set(k, { kind: k, value: v, set: s, workoutId: w.id, date: w.startedAt });
        }
      }
    }
    if (session > 0) {
      const cur = out.get('sessionVolume');
      if (!cur || session > cur.value + EPS) out.set('sessionVolume', { kind: 'sessionVolume', value: session, workoutId: w.id, date: w.startedAt });
    }
  }
  const order: (PRKind | 'sessionVolume')[] = [...kinds, 'sessionVolume'];
  return order.map((k) => out.get(k)).filter((e): e is RecordEntry => !!e);
}

// ---------- Forrige ----------

export interface PreviousContext {
  workoutId: string;
  startedAt: number;
  routineId?: string;
}

/** Seneste afsluttede træning før denne, hvor øvelsen har mindst ét færdigt sæt. */
export function findPreviousExercise(
  workouts: Workout[],
  exerciseId: string,
  ctx: PreviousContext,
  previousFrom: 'any_workout' | 'same_routine',
): WorkoutExercise | undefined {
  const candidates = workouts
    .filter((w) => w.endedAt && w.id !== ctx.workoutId && w.startedAt < ctx.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  const pick = (list: Workout[]) => {
    for (const w of list) {
      const we = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
      if (we) return we;
    }
    return undefined;
  };
  if (previousFrom === 'same_routine' && ctx.routineId) {
    const same = pick(candidates.filter((w) => w.routineId === ctx.routineId));
    if (same) return same;
  }
  return pick(candidates);
}

/** Parrer hvert sæt med sættet på samme plads sidst. Opvarmning matches med opvarmning. */
export function matchPrevious(current: WorkoutSet[], previous: WorkoutSet[] | undefined): (WorkoutSet | undefined)[] {
  if (!previous) return current.map(() => undefined);
  const prevWarm = previous.filter((s) => s.done && s.type === 'warmup');
  const prevWork = previous.filter((s) => s.done && s.type !== 'warmup');
  let wi = 0;
  let ni = 0;
  return current.map((s) => (s.type === 'warmup' ? prevWarm[wi++] : prevWork[ni++]));
}

/** Nummer til visning: opvarmningssæt tælles ikke med. */
export function setLabels(sets: WorkoutSet[] | { type: SetType }[]): string[] {
  let n = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return 'O';
    n += 1;
    if (s.type === 'failure') return 'F';
    if (s.type === 'drop') return 'D';
    return String(n);
  });
}

// ---------- Statistik ----------

const DAY = 86400000;

/** Mandag kl. 00:00 lokal tid i ugen for t. */
export function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // mandag = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export interface WeekBucket {
  weekStart: number;
  workouts: number;
  volume: number;
}

export function weeklyBuckets(
  workouts: Workout[],
  typeOf: (id: string) => ExerciseType | undefined,
  weeks: number,
  now = Date.now(),
): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - i * 7);
    buckets.push({ weekStart: d.getTime(), workouts: 0, volume: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const i = index.get(startOfWeek(w.startedAt));
    if (i === undefined) continue;
    buckets[i].workouts += 1;
    buckets[i].volume += workoutVolume(w, typeOf);
  }
  return buckets;
}

/** Antal uger i træk med mindst én træning. Indeværende uge tæller med, hvis den har en træning. */
export function weekStreak(workouts: Workout[], now = Date.now()): number {
  const weeks = new Set(workouts.filter((w) => w.endedAt).map((w) => startOfWeek(w.startedAt)));
  let cursor = startOfWeek(now);
  if (!weeks.has(cursor)) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - 7);
    cursor = d.getTime();
  }
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    const d = new Date(cursor);
    d.setDate(d.getDate() - 7);
    cursor = d.getTime();
  }
  return streak;
}

/** Færdige arbejdssæt pr. muskelgruppe. Primær muskel tæller 1, sekundær 0,5. */
export function setsPerMuscle(
  workouts: Workout[],
  exerciseById: Map<string, Exercise>,
  sinceDays: number,
  now = Date.now(),
): Map<Muscle, number> {
  const since = now - sinceDays * DAY;
  const out = new Map<Muscle, number>();
  const add = (m: Muscle, n: number) => out.set(m, (out.get(m) ?? 0) + n);
  for (const w of workouts) {
    if (!w.endedAt || w.startedAt < since) continue;
    for (const we of w.exercises) {
      const ex = exerciseById.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && isWorkingSet(s)).length;
      if (!n) continue;
      add(ex.primaryMuscle, n);
      for (const m of ex.secondaryMuscles) add(m, n * 0.5);
    }
  }
  return out;
}
