/**
 * What the workout generator can pick without a full gym, best first. Chosen by hand: the catalog's
 * names do not say what an exercise needs ("Squat" is a barbell lift). Every name is checked against
 * the catalog in generator.test.ts.
 */
import type { MuscleGroup } from '@/lib/muscleGroups';

export type Equipment = 'gym' | 'dumbbells' | 'bodyweight' | 'home';

export const EQUIPMENT_EXERCISES: Record<
  Exclude<Equipment, 'gym'>,
  Record<MuscleGroup, string[]>
> = {
  dumbbells: {
    Quads: ['Goblet Squat', 'Bulgarian Split Squat', 'Lunge'],
    Back: ['Dumbbell Row', 'Dumbbell Incline Row', 'Dumbbell Pullover', 'Shrug'],
    Chest: ['Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Push Up'],
    Hamstrings: ['Dumbbell Romanian Deadlift', 'Dumbbell Single Leg Deadlift'],
    Glutes: ['Walking Lunge', 'Step Up', 'Glute Bridge', 'Single Leg Dumbbell Hip Thrust'],
    Shoulders: [
      'Dumbbell Shoulder Press',
      'Lateral Raise',
      'Lean In Dumbbell Lateral Raise',
      'Bent Over Reverse Dumbbell Fly',
    ],
    Triceps: [
      'Dumbbell Kickback',
      'One Arm Dumbbell Overhead Extension',
      'Dumbbell French Press',
      'Diamond Push Up',
    ],
    Biceps: ['Biceps Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Dumbbell Concentration Curl'],
    Calves: ['Dumbbell Standing Calf Raise', 'Dumbbell Single Leg Calf Raise'],
    Core: ['Crunch Floor', 'Reverse Crunch', 'Russian Twist', 'Dumbbell Side Bend'],
  },
  // Your body and something to hang from: a pull-up bar and dip bars, in a park or a gym.
  bodyweight: {
    Quads: [
      'Squat to Overhead Reach',
      'Lunge',
      'Bulgarian Split Squat',
      'Split Squats',
      'Curtsey Squat',
    ],
    Back: ['Inverted Row', 'Pull Up', 'Inverted Row Bent Knees', 'Chin Up', 'Neutral Grip Pull Up'],
    Chest: ['Push Up', 'Dips', 'Incline Push Up', 'Decline Push Up', 'Archer Push Up'],
    Hamstrings: [
      'Glute Bridge March',
      'Single Leg Bridge with Outstretched Leg',
      'Low Glute Bridge on Floor',
      'Standing Single Leg Curl',
    ],
    Glutes: ['Glute Bridge', 'Forward Lunge', 'Walking Lunge', 'Step Up', 'Side Hip Abduction'],
    Shoulders: [
      'Pike to Cobra Push Up',
      'Decline Push Up',
      'Shoulder Tap',
      'Kneeling Plank Tap Shoulder',
    ],
    Triceps: [
      'Close Grip Push Up',
      'Diamond Push Up',
      'Bench Dip Knees Bent',
      'Triceps Dips Floor',
    ],
    Biceps: ['Chin Up', 'Bodyweight Side Lying Biceps Curl', 'Close Grip Chin Up'],
    Calves: [
      'Bodyweight Standing Calf Raise',
      'One Leg Floor Calf Raise',
      'Standing Calf Raise on a Staircase',
    ],
    Core: ['Hanging Leg Raise', 'Crunch Floor', 'Reverse Crunch', 'Dead Bug', 'Russian Twist'],
  },
  // At home: nothing needed but the floor, at most a chair, stairs or a towel. The generator leaves out
  // what needs a bar (NEEDS_A_BAR in lib/generator), so those are offered only as swaps.
  home: {
    Quads: [
      'Squat to Overhead Reach',
      'Lunge',
      'Split Squats',
      'Bulgarian Split Squat',
      'Curtsey Squat',
    ],
    Back: [
      'Bodyweight Standing Row with Towel',
      'Bodyweight Squatting Row with Towel',
      'Lower Back Curl',
      'One Arm Towel Row',
      'Inverted Row',
      'Pull Up',
      'Chin Up',
    ],
    Chest: [
      'Push Up',
      'Incline Push Up',
      'Kneeling Push Up',
      'Wide Hand Push Up',
      'Decline Push Up',
      'Archer Push Up',
    ],
    Hamstrings: [
      'Glute Bridge March',
      'Single Leg Bridge with Outstretched Leg',
      'Low Glute Bridge on Floor',
      'Standing Single Leg Curl',
    ],
    Glutes: ['Glute Bridge', 'Forward Lunge', 'Walking Lunge', 'Step Up', 'Side Hip Abduction'],
    Shoulders: [
      'Pike to Cobra Push Up',
      'Decline Push Up',
      'Shoulder Tap',
      'Kneeling Plank Tap Shoulder',
    ],
    Triceps: [
      'Close Grip Push Up',
      'Close Grip Push Up on Knees',
      'Bench Dip Knees Bent',
      'Triceps Dips Floor',
      'Diamond Push Up',
    ],
    Biceps: ['Bodyweight Side Lying Biceps Curl', 'Biceps Leg Concentration Curl', 'Chin Up'],
    Calves: [
      'Bodyweight Standing Calf Raise',
      'One Leg Floor Calf Raise',
      'Standing Calf Raise on a Staircase',
    ],
    Core: [
      'Crunch Floor',
      'Reverse Crunch',
      'Dead Bug',
      'Russian Twist',
      'Sit Up',
      'Oblique Crunches Floor',
      'Flutter Kicks',
    ],
  },
};
