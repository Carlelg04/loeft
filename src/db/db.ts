import Dexie, { type EntityTable } from 'dexie';
import { SEED_EXERCISES, seedRoutines } from './seed';
import { DEFAULT_SETTINGS, type Exercise, type KV, type Routine, type Workout } from './types';

export const DB_NAME = 'loeft';
export const SCHEMA_VERSION = 1;

// Regel: hver skemaændring får et nyt versionsnummer og en upgrade()-funktion.
// Slet aldrig tabeller eller felter med data. Se README.
export class LoeftDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, primaryMuscle, equipment',
      routines: 'id, order',
      workouts: 'id, startedAt, endedAt, routineId, *exerciseIds',
      kv: 'key',
    });
    this.on('populate', (tx) => {
      const now = Date.now();
      void tx.table('exercises').bulkAdd(SEED_EXERCISES);
      void tx.table('routines').bulkAdd(seedRoutines(now));
      void tx.table('kv').add({ key: 'settings', value: DEFAULT_SETTINGS });
    });
  }
}

export const db = new LoeftDB();
