import { describe, expect, it } from 'vitest';
import type { ExerciseType, Workout, WorkoutSet } from '../src/db/types';
import {
  detectPRs,
  estimate1RM,
  findPreviousExercise,
  matchPrevious,
  setLabels,
  setVolume,
  weekStreak,
  weeklyBuckets,
  workoutVolume,
} from '../src/lib/calc';

let n = 0;
const set = (p: Partial<WorkoutSet>): WorkoutSet => ({ id: `s${++n}`, type: 'normal', done: true, ...p });
const types: Record<string, ExerciseType> = { bench: 'weight_reps', pull: 'assisted_bodyweight', dip: 'bodyweight_reps' };
const typeOf = (id: string) => types[id];
function workout(id: string, startedAt: number, exercises: [string, WorkoutSet[]][], extra: Partial<Workout> = {}): Workout {
  return {
    id,
    name: id,
    startedAt,
    endedAt: startedAt + 3600000,
    exerciseIds: exercises.map(([e]) => e),
    exercises: exercises.map(([exerciseId, sets]) => ({ exerciseId, restSec: 120, sets })),
    ...extra,
  };
}

describe('estimate1RM', () => {
  it('bruger Epley', () => expect(estimate1RM(100, 5)).toBeCloseTo(116.667, 2));
  it('1 rep er lig med vægten', () => expect(estimate1RM(100, 1)).toBe(100));
  it('ignorerer over 12 reps og tomme værdier', () => {
    expect(estimate1RM(60, 15)).toBeUndefined();
    expect(estimate1RM(undefined, 5)).toBeUndefined();
    expect(estimate1RM(60, 0)).toBeUndefined();
  });
});

describe('volumen', () => {
  it('opvarmning og ufærdige sæt tæller ikke', () => {
    expect(setVolume(set({ kg: 60, reps: 5 }), 'weight_reps')).toBe(300);
    expect(setVolume(set({ kg: 40, reps: 8, type: 'warmup' }), 'weight_reps')).toBe(0);
    expect(setVolume(set({ kg: 60, reps: 5, done: false }), 'weight_reps')).toBe(0);
  });
  it('assisteret kropsvægt giver ingen volumen', () => {
    expect(setVolume(set({ kg: 25, reps: 9 }), 'assisted_bodyweight')).toBe(0);
  });
  it('summerer en træning', () => {
    const w = workout('a', 0, [
      ['bench', [set({ kg: 60, reps: 5 }), set({ kg: 50, reps: 8 }), set({ kg: 20, reps: 10, type: 'warmup' })]],
      ['dip', [set({ reps: 10 }), set({ kg: 10, reps: 6 })]],
    ]);
    expect(workoutVolume(w, typeOf)).toBe(300 + 400 + 60);
  });
});

describe('detectPRs', () => {
  it('første gang er udgangspunkt, ikke rekord', () => {
    const s = set({ kg: 55, reps: 5 });
    const prs = detectPRs([workout('a', 1, [['bench', [s]]])], typeOf);
    expect(prs.size).toBe(0);
  });

  it('finder tungeste vægt, 1RM og sæt-volumen', () => {
    const a = workout('a', 1, [['bench', [set({ kg: 55, reps: 5 })]]]);
    const heavier = set({ kg: 57.5, reps: 5 });
    const b = workout('b', 2, [['bench', [heavier]]]);
    const prs = detectPRs([b, a], typeOf);
    expect(prs.get(heavier.id)).toEqual(['heaviest', 'e1rm', 'setVolume']);
  });

  it('flere reps på samme vægt giver 1RM og volumen, men ikke tungeste', () => {
    const a = workout('a', 1, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const more = set({ kg: 60, reps: 6 });
    const prs = detectPRs([a, workout('b', 2, [['bench', [more]]])], typeOf);
    expect(prs.get(more.id)).toEqual(['e1rm', 'setVolume']);
  });

  it('opvarmning og ufærdige sæt er aldrig rekorder', () => {
    const a = workout('a', 1, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const warm = set({ kg: 100, reps: 5, type: 'warmup' });
    const undone = set({ kg: 100, reps: 5, done: false });
    const prs = detectPRs([a, workout('b', 2, [['bench', [warm, undone]]])], typeOf);
    expect(prs.size).toBe(0);
  });

  it('mindre hjælp på assisteret pull-up er en rekord', () => {
    const a = workout('a', 1, [['pull', [set({ kg: 25, reps: 9 })]]]);
    const less = set({ kg: 20, reps: 9 });
    const prs = detectPRs([a, workout('b', 2, [['pull', [less]]])], typeOf);
    expect(prs.get(less.id)).toEqual(['leastAssist']);
  });

  it('kun det første af to ens sæt i samme træning er rekord', () => {
    const a = workout('a', 1, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const s1 = set({ kg: 62.5, reps: 5 });
    const s2 = set({ kg: 62.5, reps: 5 });
    const prs = detectPRs([a, workout('b', 2, [['bench', [s1, s2]]])], typeOf);
    expect(prs.has(s1.id)).toBe(true);
    expect(prs.has(s2.id)).toBe(false);
  });
});

describe('forrige', () => {
  const older = workout('old', 1, [['bench', [set({ kg: 50, reps: 8 })]]], { routineId: 'r1' });
  const newer = workout('new', 2, [['bench', [set({ kg: 40, reps: 10 })]]], { routineId: 'r2' });
  const active = { workoutId: 'cur', startedAt: 3, routineId: 'r1' };

  it('vælger seneste afsluttede træning', () => {
    expect(findPreviousExercise([older, newer], 'bench', active, 'any_workout')?.sets[0].kg).toBe(40);
  });
  it('kan vælge samme rutine', () => {
    expect(findPreviousExercise([older, newer], 'bench', active, 'same_routine')?.sets[0].kg).toBe(50);
  });
  it('ignorerer den aktive træning og senere træninger', () => {
    const later = workout('later', 10, [['bench', [set({ kg: 99, reps: 1 })]]]);
    expect(findPreviousExercise([older, later], 'bench', active, 'any_workout')?.sets[0].kg).toBe(50);
  });
  it('matcher opvarmning med opvarmning', () => {
    const prev = [set({ kg: 20, reps: 10, type: 'warmup' }), set({ kg: 60, reps: 5 }), set({ kg: 55, reps: 6 })];
    const cur = [set({ type: 'warmup', done: false }), set({ done: false }), set({ done: false }), set({ done: false })];
    const m = matchPrevious(cur, prev);
    expect(m.map((s) => s?.kg)).toEqual([20, 60, 55, undefined]);
  });
  it('nummererer uden opvarmning', () => {
    expect(setLabels([{ type: 'warmup' }, { type: 'normal' }, { type: 'failure' }, { type: 'normal' }])).toEqual(['O', '1', 'F', '3']);
  });
});

describe('uger', () => {
  const day = 86400000;
  const now = new Date(2026, 9, 28, 12).getTime(); // onsdag
  it('tæller træninger og volumen pr. uge', () => {
    const w1 = workout('a', now - day, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const w2 = workout('b', now - 8 * day, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const b = weeklyBuckets([w1, w2], typeOf, 4, now);
    expect(b.map((x) => x.workouts)).toEqual([0, 0, 1, 1]);
    expect(b[3].volume).toBe(300);
  });
  it('streak tæller sidste uge med, selvom denne uge er tom', () => {
    const lastWeek = workout('a', now - 7 * day, [['bench', [set({ kg: 60, reps: 5 })]]]);
    const twoWeeks = workout('b', now - 14 * day, [['bench', [set({ kg: 60, reps: 5 })]]]);
    expect(weekStreak([lastWeek, twoWeeks], now)).toBe(2);
    expect(weekStreak([twoWeeks], now)).toBe(0);
  });
});
