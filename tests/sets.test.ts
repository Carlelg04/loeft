import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../src/db/types';
import { describeSet, placeholderFor, resolveForDone } from '../src/lib/sets';

const s = (p: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: 'x', type: 'normal', done: false, ...p });

describe('ét tryk pr. sæt', () => {
  it('tomme felter tager rutinens mål', () => {
    expect(resolveForDone(s({ targetKg: 55, targetReps: 5 }), undefined, 'weight_reps')).toEqual({ ok: true, patch: { kg: 55, reps: 5 } });
  });
  it('uden mål bruges sidste gang', () => {
    const prev = s({ kg: 60, reps: 8, done: true });
    expect(resolveForDone(s(), prev, 'weight_reps')).toEqual({ ok: true, patch: { kg: 60, reps: 8 } });
  });
  it('mål vinder over sidste gang, indtastet vinder over alt', () => {
    const prev = s({ kg: 50, reps: 10, done: true });
    expect(placeholderFor(s({ targetKg: 55 }), prev)).toMatchObject({ kg: 55, reps: 10 });
    expect(resolveForDone(s({ kg: 57.5, targetKg: 55 }), prev, 'weight_reps')).toEqual({ ok: true, patch: { kg: 57.5, reps: 10 } });
  });
  it('siger hvilket felt der mangler', () => {
    expect(resolveForDone(s({ targetReps: 7 }), undefined, 'weight_reps')).toEqual({ ok: false, missing: 'kg' });
    expect(resolveForDone(s({ kg: 60 }), undefined, 'weight_reps')).toEqual({ ok: false, missing: 'reps' });
  });
  it('kropsvægt kræver kun reps', () => {
    expect(resolveForDone(s({ targetReps: 9 }), undefined, 'assisted_bodyweight')).toEqual({ ok: true, patch: { kg: undefined, reps: 9 } });
  });
});

describe('beskrivelse', () => {
  it('skriver sæt kort', () => {
    expect(describeSet({ kg: 62.5, reps: 7 }, 'weight_reps', 'kg')).toBe('62,5 x 7');
    expect(describeSet({ kg: 25, reps: 9 }, 'assisted_bodyweight', 'kg')).toBe('−25 x 9');
    expect(describeSet({ reps: 12 }, 'bodyweight_reps', 'kg')).toBe('12 reps');
    expect(describeSet({ durationSec: 90 }, 'duration', 'kg')).toBe('1:30');
    expect(describeSet({ distanceM: 2000, durationSec: 450 }, 'distance_duration', 'kg')).toBe('2.000 m, 7:30');
  });
});
