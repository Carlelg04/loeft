import type { ExerciseType, WorkoutSet } from '../db/types';
import { formatClock, formatNumber, formatWeight } from './units';

export type SetField = 'kg' | 'reps' | 'durationSec' | 'distanceM';

export interface Placeholder {
  kg?: number;
  reps?: number;
  repsMax?: number;
  durationSec?: number;
  distanceM?: number;
}

/** Rutinens mål vinder over sidste gang. */
export function placeholderFor(set: WorkoutSet, prev: WorkoutSet | undefined): Placeholder {
  return {
    kg: set.targetKg ?? prev?.kg,
    reps: set.targetReps ?? prev?.reps,
    repsMax: set.targetRepsMax,
    durationSec: set.targetDurationSec ?? prev?.durationSec,
    distanceM: set.targetDistanceM ?? prev?.distanceM,
  };
}

export type ResolveResult = { ok: true; patch: Partial<WorkoutSet> } | { ok: false; missing: SetField };

/** Værdier til et sæt, der markeres færdigt. Tomme felter tager placeholder-værdien. */
export function resolveForDone(set: WorkoutSet, prev: WorkoutSet | undefined, type: ExerciseType): ResolveResult {
  const ph = placeholderFor(set, prev);
  const kg = set.kg ?? ph.kg;
  const reps = set.reps ?? ph.reps;
  const durationSec = set.durationSec ?? ph.durationSec;
  const distanceM = set.distanceM ?? ph.distanceM;
  switch (type) {
    case 'weight_reps':
      if (kg === undefined) return { ok: false, missing: 'kg' };
      if (!reps) return { ok: false, missing: 'reps' };
      return { ok: true, patch: { kg, reps } };
    case 'bodyweight_reps':
    case 'assisted_bodyweight':
      if (!reps) return { ok: false, missing: 'reps' };
      return { ok: true, patch: { kg, reps } };
    case 'duration':
      if (!durationSec) return { ok: false, missing: 'durationSec' };
      return { ok: true, patch: { durationSec } };
    case 'distance_duration':
      if (!distanceM && !durationSec) return { ok: false, missing: 'distanceM' };
      return { ok: true, patch: { distanceM, durationSec } };
  }
}

/** Kort tekst til "Forrige"-kolonnen og historikken, fx "55 x 5", "−25 x 9", "1:30". */
export function describeSet(s: Pick<WorkoutSet, 'kg' | 'reps' | 'durationSec' | 'distanceM'>, type: ExerciseType, unit: 'kg' | 'lb'): string {
  const w = s.kg !== undefined ? formatWeight(s.kg, unit) : undefined;
  switch (type) {
    case 'weight_reps':
      return `${w ?? '?'} x ${s.reps ?? '?'}`;
    case 'bodyweight_reps':
      return s.kg ? `+${w} x ${s.reps ?? '?'}` : `${s.reps ?? '?'} reps`;
    case 'assisted_bodyweight':
      return s.kg ? `−${w} x ${s.reps ?? '?'}` : `${s.reps ?? '?'} reps`;
    case 'duration':
      return s.durationSec ? formatClock(s.durationSec) : '?';
    case 'distance_duration': {
      const parts: string[] = [];
      if (s.distanceM) parts.push(`${formatNumber(s.distanceM, 0)} m`);
      if (s.durationSec) parts.push(formatClock(s.durationSec));
      return parts.join(', ') || '?';
    }
  }
}
