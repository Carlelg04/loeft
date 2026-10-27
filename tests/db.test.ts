import { beforeEach, describe, expect, it } from 'vitest';
import { LoeftDB } from '../src/db/db';
import type { Routine, Workout } from '../src/db/types';
import { createBackup, importBackup, workoutsToCSV } from '../src/lib/backup';
import { parseBackup } from '../src/lib/backupParse';
import { cleanForSave, routineDiffers, routineExercisesFromWorkout } from '../src/state/workout';

let db: LoeftDB;
let i = 0;
beforeEach(async () => {
  db = new LoeftDB(`test-${++i}`);
  await db.open();
});

describe('startdata', () => {
  it('lægger øvelser, rutiner og indstillinger ind', async () => {
    expect(await db.exercises.count()).toBeGreaterThan(70);
    const routines = await db.routines.orderBy('order').toArray();
    expect(routines.map((r) => r.name)).toEqual(['Push day', 'Pull day']);
    expect(routines[0].exercises).toHaveLength(11);
    expect(routines[1].exercises).toHaveLength(9);
    const target = (r: number, id: string) => routines[r].exercises.find((e) => e.exerciseId === id)?.sets[0];
    expect(target(0, 'ex-triceps-pushdown')).toMatchObject({ targetKg: 60, targetReps: 7 });
    expect(target(1, 'ex-hs-low-row')).toMatchObject({ targetKg: 45, targetReps: 6 });
    expect(target(1, 'ex-lat-high-row')).toMatchObject({ targetKg: 45, targetReps: 8 });
    expect((await db.kv.get('settings'))?.value).toMatchObject({ unit: 'kg' });
  });
  it('alle rutineøvelser findes i biblioteket', async () => {
    const ids = new Set((await db.exercises.toArray()).map((e) => e.id));
    for (const r of await db.routines.toArray()) for (const re of r.exercises) expect(ids).toContain(re.exerciseId);
  });
  it('har topsættene som mål', async () => {
    const push = (await db.routines.get('routine-push'))!;
    expect(push.exercises[0].sets[0]).toMatchObject({ targetKg: 55, targetReps: 5 });
    const pull = (await db.routines.get('routine-pull'))!;
    expect(pull.exercises[0].sets[0]).toMatchObject({ targetKg: 62.5, targetReps: 7 });
  });
});

function sampleWorkout(): Workout {
  return {
    id: 'w1',
    name: 'Push day',
    routineId: 'routine-push',
    startedAt: 1000,
    endedAt: 5000,
    exerciseIds: ['ex-hs-plate-shoulder-press'],
    exercises: [
      {
        exerciseId: 'ex-hs-plate-shoulder-press',
        restSec: 120,
        sets: [
          { id: 'a', type: 'warmup', kg: 30, reps: 8, done: true },
          { id: 'b', type: 'normal', kg: 57.5, reps: 5, done: true },
        ],
      },
    ],
  };
}

describe('backup', () => {
  it('eksport og import giver identiske data', async () => {
    await db.workouts.add(sampleWorkout());
    const before = await createBackup(db, 42);
    const json = JSON.parse(JSON.stringify(before));

    const other = new LoeftDB(`test-${++i}`);
    await other.open();
    await other.workouts.add({ ...sampleWorkout(), id: 'skal-vaek' });
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await importBackup(other, parsed.backup, 'replace');
    const after = await createBackup(other, 42);
    const sort = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
    expect(sort(after.data.workouts)).toEqual(sort(before.data.workouts));
    expect(sort(after.data.exercises)).toEqual(sort(before.data.exercises));
    expect(sort(after.data.routines)).toEqual(sort(before.data.routines));
  });

  it('fletning beholder eksisterende data', async () => {
    const backup = await createBackup(db);
    await db.workouts.add(sampleWorkout());
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(db, parsed.backup, 'merge');
    expect(await db.workouts.count()).toBe(1);
  });

  it('afviser forkerte filer og nyere versioner', () => {
    expect(parseBackup({ hello: 1 }).ok).toBe(false);
    const r = parseBackup({ app: 'loeft', schemaVersion: 99, exportedAt: 1, data: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nyere version/);
  });

  it('laver CSV med et sæt pr. linje', async () => {
    const ex = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const csv = workoutsToCSV([sampleWorkout()], ex).trim().split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[2]).toContain('HS Plate Loaded Shoulder Press');
    expect(csv[2]).toContain('57.5');
  });
});

describe('rutiner og afslutning', () => {
  it('fjerner ufærdige sæt og tomme øvelser', () => {
    const w = sampleWorkout();
    w.exercises[0].sets.push({ id: 'c', type: 'normal', done: false });
    w.exercises.push({ exerciseId: 'ex-flyes', restSec: 90, sets: [{ id: 'd', type: 'normal', done: false }] });
    const c = cleanForSave(w);
    expect(c.exercises).toHaveLength(1);
    expect(c.exercises[0].sets).toHaveLength(2);
    expect(c.exerciseIds).toEqual(['ex-hs-plate-shoulder-press']);
  });

  it('opdager ændringer og bevarer rep-intervaller', () => {
    const routine: Routine = {
      id: 'r',
      name: 'R',
      order: 0,
      updatedAt: 0,
      exercises: [{ exerciseId: 'ex-hs-plate-shoulder-press', restSec: 120, sets: [{ type: 'warmup' }, { type: 'normal', targetKg: 55, targetReps: 8, targetRepsMax: 10 }] }],
    };
    const w = sampleWorkout();
    expect(routineDiffers(routine, w)).toBe(true);
    const next = routineExercisesFromWorkout(routine, w);
    expect(next[0].sets[1]).toEqual({ type: 'normal', targetKg: 57.5, targetReps: 8, targetRepsMax: 10 });
    expect(routineDiffers({ ...routine, exercises: next }, w)).toBe(false);
  });

  it('maskine optaget: øvelsen gemmes ikke og ændrer ikke rutinen', () => {
    const routine: Routine = {
      id: 'r',
      name: 'R',
      order: 0,
      updatedAt: 0,
      exercises: [
        { exerciseId: 'ex-hs-plate-shoulder-press', restSec: 120, sets: [{ type: 'warmup', targetKg: 30, targetReps: 8 }, { type: 'normal', targetKg: 57.5, targetReps: 5 }] },
        { exerciseId: 'ex-hs-low-row', restSec: 120, sets: [{ type: 'normal', targetKg: 45, targetReps: 6 }] },
      ],
    };
    const w = sampleWorkout();
    w.exercises.push({ exerciseId: 'ex-hs-low-row', restSec: 120, skipped: true, sets: [{ id: 'q', type: 'normal', targetKg: 45, targetReps: 6, done: false }] });
    const c = cleanForSave(w);
    expect(c.exerciseIds).toEqual(['ex-hs-plate-shoulder-press']);
    expect(c.exercises.some((e) => 'skipped' in e)).toBe(false);
    expect(routineDiffers(routine, c)).toBe(false);
  });

  it('maskine optaget efter et færdigt sæt: sættet gemmes, flaget gør ikke', () => {
    const w = sampleWorkout();
    w.exercises[0].skipped = true;
    w.exercises[0].sets.push({ id: 'u', type: 'normal', done: false });
    const c = cleanForSave(w);
    expect(c.exercises[0].sets.map((x) => x.id)).toEqual(['a', 'b']);
    expect('skipped' in c.exercises[0]).toBe(false);
  });

  it('beholder øvelser jeg sprang over og tilføjer nye sidst', () => {
    const routine: Routine = {
      id: 'r',
      name: 'R',
      order: 0,
      updatedAt: 0,
      exercises: [
        { exerciseId: 'ex-flyes', restSec: 90, sets: [{ type: 'normal', targetKg: 85, targetReps: 5 }] },
        { exerciseId: 'ex-hs-plate-shoulder-press', restSec: 120, sets: [{ type: 'normal', targetKg: 55, targetReps: 5 }] },
      ],
    };
    const w = sampleWorkout();
    w.exercises.push({ exerciseId: 'ex-hs-curl', restSec: 60, sets: [{ id: 'z', type: 'normal', kg: 50, reps: 6, done: true }] });
    const next = routineExercisesFromWorkout(routine, w);
    expect(next.map((e) => e.exerciseId)).toEqual(['ex-flyes', 'ex-hs-plate-shoulder-press', 'ex-hs-curl']);
    expect(next[0]).toBe(routine.exercises[0]);
    expect(next[1].sets).toHaveLength(2);
  });
});
