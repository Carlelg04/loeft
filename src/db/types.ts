export type ExerciseType =
  | 'weight_reps' // fx bænkpres: kg x reps
  | 'bodyweight_reps' // fx pull-ups: reps, evt. med ekstra kg
  | 'assisted_bodyweight' // fx assisteret pull-up: kg trækkes fra
  | 'duration' // fx planke: sekunder
  | 'distance_duration'; // fx roning: meter og tid

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';

export type Muscle =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'traps'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'neck'
  | 'cardio'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith'
  | 'other';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  type: ExerciseType;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  isCustom: boolean;
  defaultRestSec?: number;
  notes?: string;
  archived?: boolean;
}

export interface RoutineSet {
  type: SetType;
  targetKg?: number;
  targetReps?: number;
  targetRepsMax?: number;
  targetDurationSec?: number;
  targetDistanceM?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  restSec: number;
  notes?: string;
  sets: RoutineSet[];
}

export interface Routine {
  id: string;
  name: string;
  notes?: string;
  order: number;
  exercises: RoutineExercise[];
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  type: SetType;
  kg?: number;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  rpe?: number;
  done: boolean;
  doneAt?: number;
  // Mål fra rutinen. Vises som placeholder, aldrig som udført værdi.
  targetKg?: number;
  targetReps?: number;
  targetRepsMax?: number;
  targetDurationSec?: number;
  targetDistanceM?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  restSec: number;
  notes?: string;
  sets: WorkoutSet[];
  // Maskine optaget: ufærdige sæt ignoreres ved afslutning, og intet nyt gemmes for øvelsen.
  // Findes kun under en aktiv træning.
  skipped?: boolean;
}

export interface Workout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: number;
  endedAt?: number; // mangler = træningen er aktiv
  notes?: string;
  exerciseIds: string[]; // denormaliseret til multiEntry-indeks
  exercises: WorkoutExercise[];
}

export type ThemeSetting = 'dark' | 'light' | 'system';

export interface Settings {
  unit: 'kg' | 'lb';
  defaultRestSec: number;
  previousFrom: 'any_workout' | 'same_routine';
  sound: boolean;
  vibrate: boolean;
  keepAwake: boolean;
  theme: ThemeSetting;
  barKg: number;
  plates: number[];
  lastBackupAt?: number;
}

export interface RestTimer {
  endsAt: number;
  durationSec: number;
  exerciseId: string;
}

export interface KV {
  key: string;
  value: unknown;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  defaultRestSec: 120,
  previousFrom: 'any_workout',
  sound: true,
  vibrate: true,
  keepAwake: true,
  theme: 'dark',
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Bryst',
  lats: 'Lats',
  upper_back: 'Øvre ryg',
  lower_back: 'Lænd',
  traps: 'Traps',
  shoulders: 'Skuldre',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Underarme',
  abs: 'Mave',
  glutes: 'Baller',
  quads: 'Forlår',
  hamstrings: 'Baglår',
  calves: 'Lægge',
  adductors: 'Adduktorer',
  abductors: 'Abduktorer',
  neck: 'Nakke',
  cardio: 'Kondition',
  full_body: 'Hele kroppen',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Stang',
  dumbbell: 'Håndvægte',
  machine: 'Maskine',
  cable: 'Kabel',
  bodyweight: 'Kropsvægt',
  kettlebell: 'Kettlebell',
  band: 'Elastik',
  smith: 'Smith',
  other: 'Andet',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Vægt og reps',
  bodyweight_reps: 'Kropsvægt og reps',
  assisted_bodyweight: 'Assisteret kropsvægt',
  duration: 'Tid',
  distance_duration: 'Distance og tid',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normalt sæt',
  warmup: 'Opvarmning',
  failure: 'Til failure',
  drop: 'Dropsæt',
};
