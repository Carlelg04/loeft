import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../src/db/seed';
import { searchExercises } from '../src/lib/search';

const top = (q: string) => searchExercises(q, SEED_EXERCISES)[0]?.name;

describe('søgning', () => {
  it('finder på navn og alias', () => {
    expect(top('bænkpres')).toBe('Bench Press (Barbell)');
    expect(top('hammer')).toBe('Hammer Curl');
    expect(top('pullover')).toBe('HS Pullover');
  });
  it('tåler stavefejl', () => {
    expect(searchExercises('lateraise', SEED_EXERCISES).map((e) => e.name)).toContain('Lateral Raise (Dumbbell)');
    expect(top('dedlift')).toBe('Deadlift (Barbell)');
  });
  it('tom søgning giver alt alfabetisk', () => {
    expect(searchExercises('', SEED_EXERCISES).length).toBe(SEED_EXERCISES.length);
  });
  it('har unikke id-er i startdata', () => {
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length);
  });
});
