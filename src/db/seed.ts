import type { Equipment, Exercise, ExerciseType, Muscle, Routine, RoutineExercise } from './types';

// Faste id'er, så backups fra forskellige installationer kan flettes.
function ex(
  id: string,
  name: string,
  aliases: string[],
  primaryMuscle: Muscle,
  secondaryMuscles: Muscle[],
  equipment: Equipment,
  type: ExerciseType = 'weight_reps',
  isCustom = false,
): Exercise {
  return { id: `ex-${id}`, name, aliases, type, primaryMuscle, secondaryMuscles, equipment, isCustom };
}

export const SEED_EXERCISES: Exercise[] = [
  // Bryst
  ex('bench-press', 'Bench Press (Barbell)', ['Bænkpres'], 'chest', ['triceps', 'shoulders'], 'barbell'),
  ex('incline-bench-press', 'Incline Bench Press (Barbell)', ['Skråbænkpres'], 'chest', ['shoulders', 'triceps'], 'barbell'),
  ex('db-bench-press', 'Bench Press (Dumbbell)', ['Bænkpres med håndvægte'], 'chest', ['triceps', 'shoulders'], 'dumbbell'),
  ex('incline-db-press', 'Incline Press (Dumbbell)', ['Skråpres med håndvægte'], 'chest', ['shoulders', 'triceps'], 'dumbbell'),
  ex('chest-press-machine', 'Chest Press (Machine)', ['Brystpres maskine'], 'chest', ['triceps', 'shoulders'], 'machine'),
  ex('incline-chest-press-machine', 'Incline Chest Press (Machine)', ['Skråpres maskine'], 'chest', ['shoulders', 'triceps'], 'machine'),
  ex('pec-deck', 'Pec Deck', ['Butterfly', 'Flyes maskine'], 'chest', ['shoulders'], 'machine'),
  ex('cable-fly', 'Cable Fly', ['Kabelflyes', 'Cable crossover'], 'chest', ['shoulders'], 'cable'),
  ex('push-up', 'Push-up', ['Armstrækninger'], 'chest', ['triceps', 'shoulders'], 'bodyweight', 'bodyweight_reps'),
  ex('chest-dip', 'Dip', ['Dips'], 'chest', ['triceps', 'shoulders'], 'bodyweight', 'bodyweight_reps'),

  // Ryg
  ex('deadlift', 'Deadlift (Barbell)', ['Dødløft'], 'lower_back', ['glutes', 'hamstrings', 'upper_back', 'traps'], 'barbell'),
  ex('barbell-row', 'Bent Over Row (Barbell)', ['Roning med stang'], 'upper_back', ['lats', 'biceps'], 'barbell'),
  ex('db-row', 'Single Arm Row (Dumbbell)', ['Etarms roning'], 'lats', ['upper_back', 'biceps'], 'dumbbell'),
  ex('seated-cable-row', 'Seated Cable Row', ['Siddende roning'], 'upper_back', ['lats', 'biceps'], 'cable'),
  ex('t-bar-row', 'T-Bar Row', ['T-bar roning'], 'upper_back', ['lats', 'biceps'], 'barbell'),
  ex('lat-pulldown', 'Lat Pulldown', ['Nedtræk', 'Lat pull down'], 'lats', ['biceps', 'upper_back'], 'cable'),
  ex('close-grip-lat-pulldown', 'Lat Pulldown (Close Grip)', ['Nedtræk smalt greb'], 'lats', ['biceps', 'upper_back'], 'cable'),
  ex('pull-up', 'Pull-up', ['Pull-ups', 'Pullups'], 'lats', ['biceps', 'upper_back'], 'bodyweight', 'bodyweight_reps'),
  ex('chin-up', 'Chin-up', ['Chin-ups'], 'lats', ['biceps'], 'bodyweight', 'bodyweight_reps'),
  ex('assisted-pull-up', 'Assisted Pull-up', ['Assisteret pull-up', 'Assisted pullups'], 'lats', ['biceps', 'upper_back'], 'machine', 'assisted_bodyweight'),
  ex('straight-arm-pulldown', 'Straight Arm Pulldown', ['Strakarms nedtræk'], 'lats', [], 'cable'),
  ex('face-pull', 'Face Pull', ['Face pulls'], 'shoulders', ['upper_back', 'traps'], 'cable'),
  ex('back-extension', 'Back Extension', ['Rygstræk', 'Hyperextension'], 'lower_back', ['glutes', 'hamstrings'], 'bodyweight', 'bodyweight_reps'),
  ex('db-shrug', 'Shrug (Dumbbell)', ['Skulderløft'], 'traps', [], 'dumbbell'),

  // Skuldre
  ex('overhead-press', 'Overhead Press (Barbell)', ['Skulderpres med stang', 'Military press'], 'shoulders', ['triceps'], 'barbell'),
  ex('db-shoulder-press', 'Shoulder Press (Dumbbell)', ['Skulderpres med håndvægte'], 'shoulders', ['triceps'], 'dumbbell'),
  ex('shoulder-press-machine', 'Shoulder Press (Machine)', ['Skulderpres maskine'], 'shoulders', ['triceps'], 'machine'),
  ex('lateral-raise', 'Lateral Raise (Dumbbell)', ['Sidehæv', 'Lateraises', 'Lateral raises'], 'shoulders', [], 'dumbbell'),
  ex('cable-lateral-raise', 'Cable Lateral Raise', ['Sidehæv i kabel'], 'shoulders', [], 'cable'),
  ex('lateral-raise-machine', 'Lateral Raise (Machine)', ['Sidehæv maskine', 'Lateraise machine'], 'shoulders', [], 'machine'),
  ex('rear-delt-fly-machine', 'Rear Delt Fly (Machine)', ['Reverse butterfly', 'Reverse pec deck'], 'shoulders', ['upper_back'], 'machine'),
  ex('rear-delt-fly-db', 'Rear Delt Fly (Dumbbell)', ['Bagside skulder med håndvægte'], 'shoulders', ['upper_back'], 'dumbbell'),
  ex('front-raise', 'Front Raise (Dumbbell)', ['Fronthæv'], 'shoulders', [], 'dumbbell'),
  ex('arnold-press', 'Arnold Press', ['Arnoldpres'], 'shoulders', ['triceps'], 'dumbbell'),

  // Biceps
  ex('barbell-curl', 'Bicep Curl (Barbell)', ['Biceps curl med stang'], 'biceps', ['forearms'], 'barbell'),
  ex('ez-curl', 'EZ Bar Curl', ['Curl med EZ-stang'], 'biceps', ['forearms'], 'barbell'),
  ex('db-curl', 'Bicep Curl (Dumbbell)', ['Biceps curl med håndvægte'], 'biceps', ['forearms'], 'dumbbell'),
  ex('hammer-curl', 'Hammer Curl', ['Hammercurl', 'Hammer curls'], 'biceps', ['forearms'], 'dumbbell'),
  ex('incline-db-curl', 'Incline Curl (Dumbbell)', ['Skråbænk curl'], 'biceps', [], 'dumbbell'),
  ex('preacher-curl-machine', 'Preacher Curl (Machine)', ['Scottcurl'], 'biceps', [], 'machine'),
  ex('cable-curl', 'Cable Curl', ['Curl i kabel'], 'biceps', ['forearms'], 'cable'),

  // Triceps
  ex('triceps-pushdown', 'Triceps Pushdown', ['Triceps push down', 'Pushdown'], 'triceps', [], 'cable'),
  ex('overhead-triceps-cable', 'Overhead Triceps Extension (Cable)', ['Triceps over hovedet'], 'triceps', [], 'cable'),
  ex('skull-crusher', 'Skull Crusher', ['Liggende triceps'], 'triceps', [], 'barbell'),
  ex('close-grip-bench', 'Close Grip Bench Press', ['Bænkpres smalt greb'], 'triceps', ['chest', 'shoulders'], 'barbell'),
  ex('triceps-extension-machine', 'Triceps Extension (Machine)', ['Triceps maskine'], 'triceps', [], 'machine'),

  // Ben
  ex('squat', 'Squat (Barbell)', ['Knæbøj', 'Squats'], 'quads', ['glutes', 'hamstrings', 'lower_back'], 'barbell'),
  ex('front-squat', 'Front Squat', ['Frontsquat'], 'quads', ['glutes', 'abs'], 'barbell'),
  ex('goblet-squat', 'Goblet Squat', ['Goblet squats'], 'quads', ['glutes'], 'dumbbell'),
  ex('leg-press', 'Leg Press', ['Benpres'], 'quads', ['glutes', 'hamstrings'], 'machine'),
  ex('hack-squat', 'Hack Squat (Machine)', ['Hack squat'], 'quads', ['glutes'], 'machine'),
  ex('romanian-deadlift', 'Romanian Deadlift (Barbell)', ['Rumænsk dødløft', 'RDL'], 'hamstrings', ['glutes', 'lower_back'], 'barbell'),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', ['Bulgarske udfald'], 'quads', ['glutes'], 'dumbbell'),
  ex('walking-lunge', 'Walking Lunge (Dumbbell)', ['Udfald', 'Lunges'], 'quads', ['glutes', 'hamstrings'], 'dumbbell'),
  ex('leg-extension', 'Leg Extension', ['Benstræk', 'Knæekstension'], 'quads', [], 'machine'),
  ex('lying-leg-curl', 'Lying Leg Curl', ['Liggende lårcurl', 'Hamstring curl'], 'hamstrings', [], 'machine'),
  ex('seated-leg-curl', 'Seated Leg Curl', ['Siddende lårcurl'], 'hamstrings', [], 'machine'),
  ex('hip-thrust', 'Hip Thrust (Barbell)', ['Hoftestød'], 'glutes', ['hamstrings'], 'barbell'),
  ex('standing-calf-raise', 'Standing Calf Raise', ['Tåhævninger stående'], 'calves', [], 'machine'),
  ex('seated-calf-raise', 'Seated Calf Raise', ['Tåhævninger siddende'], 'calves', [], 'machine'),
  ex('hip-adduction', 'Hip Adduction (Machine)', ['Adduktormaskine', 'Inderlår'], 'adductors', [], 'machine'),
  ex('hip-abduction', 'Hip Abduction (Machine)', ['Abduktormaskine', 'Yderlår'], 'abductors', ['glutes'], 'machine'),

  // Mave og underarme
  ex('cable-crunch', 'Cable Crunch', ['Kabelcrunch', 'Mavebøjninger i kabel'], 'abs', [], 'cable'),
  ex('hanging-leg-raise', 'Hanging Leg Raise', ['Hængende benløft'], 'abs', [], 'bodyweight', 'bodyweight_reps'),
  ex('plank', 'Plank', ['Planke'], 'abs', [], 'bodyweight', 'duration'),
  ex('ab-wheel', 'Ab Wheel', ['Mavehjul'], 'abs', [], 'other', 'bodyweight_reps'),
  ex('sit-up', 'Sit-up', ['Mavebøjninger'], 'abs', [], 'bodyweight', 'bodyweight_reps'),
  ex('wrist-curl', 'Wrist Curl', ['Håndledscurl'], 'forearms', [], 'dumbbell'),

  // Kondition
  ex('rowing-machine', 'Rowing Machine', ['Romaskine', 'Roning'], 'cardio', [], 'machine', 'distance_duration'),
  ex('treadmill', 'Treadmill', ['Løbebånd'], 'cardio', [], 'machine', 'distance_duration'),
  ex('bike', 'Stationary Bike', ['Kondicykel', 'Spinning'], 'cardio', [], 'machine', 'distance_duration'),
  ex('stairmaster', 'Stair Machine', ['Trappemaskine', 'Stairmaster'], 'cardio', [], 'machine', 'duration'),

  // Egne maskiner fra BRIEF
  ex('hs-plate-shoulder-press', 'HS Plate Loaded Shoulder Press', ['Hammer Strength skulderpres'], 'shoulders', ['triceps'], 'machine', 'weight_reps', true),
  ex('neutral-grip-shoulder-press', 'Neutral Grip Shoulder Press', ['Skulderpres neutralt greb'], 'shoulders', ['triceps'], 'machine', 'weight_reps', true),
  ex('incline-press', 'Incline Press', ['Skråpres'], 'chest', ['shoulders', 'triceps'], 'machine', 'weight_reps', true),
  ex('flat-chest-press', 'Flat Chest Press', ['Brystpres'], 'chest', ['triceps', 'shoulders'], 'machine', 'weight_reps', true),
  ex('flyes', 'Flyes', ['Flyes maskine'], 'chest', ['shoulders'], 'machine', 'weight_reps', true),
  ex('dip-machine', 'Dip Machine', ['Dipmaskine'], 'triceps', ['chest', 'shoulders'], 'machine', 'weight_reps', true),
  ex('hs-overhead-triceps', 'Overhead Triceps Push (HS Machine)', ['Triceps over hovedet maskine'], 'triceps', [], 'machine', 'weight_reps', true),
  ex('cs-t-bar-row', 'CS T-Bar Row', ['Chest supported T-bar row', 'T-bar roning'], 'upper_back', ['lats', 'biceps'], 'machine', 'weight_reps', true),
  ex('hs-low-row', 'HS Low Row', ['Hammer Strength low row', 'Lav roning'], 'upper_back', ['lats', 'biceps'], 'machine', 'weight_reps', true),
  ex('prime-single-arm-pulldown', 'Single Arm Lat Pulldown (Prime Handle)', ['Prime handle', 'Etarms nedtræk'], 'lats', ['biceps'], 'machine', 'weight_reps', true),
  ex('lat-high-row', 'Lat High Row', ['High row', 'Høj roning'], 'lats', ['upper_back', 'biceps'], 'machine', 'weight_reps', true),
  ex('hs-pullover', 'HS Pullover', ['Pull over', 'Hammer Strength pullover'], 'lats', ['chest'], 'machine', 'weight_reps', true),
  ex('hs-curl', 'HS Curl', ['Hammer Strength curl'], 'biceps', [], 'machine', 'weight_reps', true),
  ex('upper-curl', 'Upper Curl', ['Curl'], 'biceps', [], 'machine', 'weight_reps', true),
];

function topSet(exerciseId: string, kg: number | undefined, reps: number, notes?: string): RoutineExercise {
  return {
    exerciseId: `ex-${exerciseId}`,
    restSec: 120,
    notes,
    sets: [{ type: 'normal', targetKg: kg, targetReps: reps }],
  };
}

// Topsæt fra BRIEF. Kun topsættet er lagt ind. Opvarmning og ekstra sæt tilføjes under træningen,
// og "Opdatér rutinen" gemmer den rigtige opbygning bagefter.
export function seedRoutines(now: number): Routine[] {
  return [
    {
      id: 'routine-push',
      name: 'Push day',
      order: 0,
      updatedAt: now,
      exercises: [
        topSet('hs-plate-shoulder-press', 55, 5),
        topSet('neutral-grip-shoulder-press', 60, 8),
        topSet('lateral-raise-machine', 60, 6),
        topSet('lateral-raise', 12, 7),
        topSet('cable-lateral-raise', 11, 7),
        topSet('incline-press', 60, 5),
        topSet('flat-chest-press', 60, 5),
        topSet('flyes', 85, 5),
        topSet('dip-machine', 80, 5),
        topSet('triceps-pushdown', 60, 7, 'Fuld stak (45 kg) + 15 kg'),
        topSet('hs-overhead-triceps', 35, 8),
      ],
    },
    {
      id: 'routine-pull',
      name: 'Pull day',
      order: 1,
      updatedAt: now,
      exercises: [
        topSet('cs-t-bar-row', 62.5, 7),
        topSet('hs-low-row', 45, 6, 'Fuld stak'),
        topSet('assisted-pull-up', 25, 9),
        topSet('prime-single-arm-pulldown', 55, 8),
        topSet('lat-high-row', 45, 8, 'Fuld stak'),
        topSet('hs-pullover', 125, 7),
        topSet('hs-curl', 55, 5),
        topSet('upper-curl', 40, 7),
        topSet('hammer-curl', 22, 6),
      ],
    },
  ];
}
