/**
 * Built-in program templates (original to Colosseum). Principles: each muscle about twice a week,
 * ~10–20 hard sets per muscle per week, stretch-focused S/A tier exercises, heavy compounds
 * 5–8 reps, the rest 8–15, double progression, and an 8-week block (Intro, Build, Push, Deload).
 * Exercises are referenced by built-in name; programs.test checks they exist in the catalog.
 */
import { defaultPhases } from '@/lib/periodization';
import type { Exercise, Program } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';

/** [name, sets, repsMin, repsMax, restSeconds] */
type Ex = [string, number, number, number, number];

interface TemplateDay {
  name: string;
  weekdays: number[];
  exercises: Ex[];
}

export interface ProgramTemplate {
  key: string;
  name: string;
  summary: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  goal: string;
  weeks: number;
  trainingDays: number[];
  days: TemplateDay[];
}

export const TEMPLATES: ProgramTemplate[] = [
  {
    key: 'full-body',
    name: 'Full Body',
    summary:
      'Three full-body sessions a week. Every muscle trained three times with little time in the gym.',
    level: 'Beginner',
    goal: 'Build muscle',
    weeks: 8,
    trainingDays: [1, 3, 5],
    days: [
      {
        name: 'Full Body A',
        weekdays: [1],
        exercises: [
          ['Squat', 3, 5, 8, 180],
          ['Bench Press', 3, 6, 8, 150],
          ['Chest Supported Row', 3, 8, 12, 120],
          ['Leg Curl', 3, 10, 12, 90],
          ['Cable Lateral Raise', 3, 12, 15, 60],
          ['Overhead Cable Triceps Extension', 2, 10, 15, 60],
        ],
      },
      {
        name: 'Full Body B',
        weekdays: [3],
        exercises: [
          ['Romanian Deadlift', 3, 6, 10, 150],
          ['Overhead Press', 3, 6, 8, 150],
          ['Lat Pulldown', 3, 8, 12, 120],
          ['Leg Press', 3, 10, 12, 120],
          ['Bayesian Cable Curl', 3, 10, 15, 60],
          ['Calf Raise', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Full Body C',
        weekdays: [5],
        exercises: [
          ['Hack Squat', 3, 8, 10, 150],
          ['Incline Dumbbell Press', 3, 8, 12, 120],
          ['Seated Cable Row', 3, 10, 12, 90],
          ['Leg Extension', 2, 12, 15, 60],
          ['Reverse Pec Deck', 3, 12, 15, 60],
          ['Hanging Leg Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    key: 'upper-lower',
    name: 'Upper / Lower',
    summary: 'Four days, upper and lower body twice each. The classic next step after full body.',
    level: 'Intermediate',
    goal: 'Build muscle',
    weeks: 8,
    trainingDays: [1, 2, 4, 5],
    days: [
      {
        name: 'Upper 1',
        weekdays: [1],
        exercises: [
          ['Bench Press', 4, 5, 8, 180],
          ['Chest Supported Row', 3, 8, 10, 120],
          ['Machine Shoulder Press', 3, 8, 10, 120],
          ['Lat Pulldown', 3, 10, 12, 90],
          ['Cable Lateral Raise', 3, 12, 15, 60],
          ['Overhead Cable Triceps Extension', 3, 10, 12, 60],
        ],
      },
      {
        name: 'Lower 1',
        weekdays: [2],
        exercises: [
          ['Squat', 4, 5, 8, 180],
          ['Romanian Deadlift', 3, 8, 10, 150],
          ['Leg Extension', 3, 10, 15, 90],
          ['Leg Curl', 3, 10, 15, 90],
          ['Calf Raise', 4, 10, 15, 60],
        ],
      },
      {
        name: 'Upper 2',
        weekdays: [4],
        exercises: [
          ['Incline Dumbbell Press', 3, 8, 10, 120],
          ['Neutral Grip Pull Up', 3, 6, 10, 150],
          ['Seated Cable Pec Fly', 3, 10, 15, 90],
          ['Seated Cable Row', 3, 10, 12, 90],
          ['Reverse Pec Deck', 3, 12, 15, 60],
          ['Bayesian Cable Curl', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Lower 2',
        weekdays: [5],
        exercises: [
          ['Hack Squat', 3, 8, 10, 150],
          ['Hip Thrust', 3, 8, 12, 120],
          ['Bulgarian Split Squat', 3, 8, 12, 90],
          ['Leg Curl', 3, 10, 15, 90],
          ['Hanging Leg Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    key: 'push-pull-legs',
    name: 'Push Pull Legs',
    summary: 'Six days, each split day twice a week. Highest volume, for lifters who recover well.',
    level: 'Advanced',
    goal: 'Build muscle',
    weeks: 8,
    trainingDays: [1, 2, 3, 4, 5, 6],
    days: [
      {
        name: 'Push',
        weekdays: [1, 4],
        exercises: [
          ['Bench Press', 3, 6, 8, 180],
          ['Machine Shoulder Press', 3, 8, 10, 120],
          ['Incline Dumbbell Press', 3, 8, 12, 120],
          ['Cable Lateral Raise', 3, 12, 15, 60],
          ['Overhead Cable Triceps Extension', 3, 10, 12, 60],
          ['Triceps Pushdown', 2, 12, 15, 60],
        ],
      },
      {
        name: 'Pull',
        weekdays: [2, 5],
        exercises: [
          ['Lat Pulldown', 3, 8, 12, 120],
          ['Chest Supported Row', 3, 8, 10, 120],
          ['Wide Grip Cable Row', 2, 10, 12, 90],
          ['Reverse Pec Deck', 3, 12, 15, 60],
          ['Bayesian Cable Curl', 3, 10, 15, 60],
          ['Hammer Curl', 2, 10, 12, 60],
        ],
      },
      {
        name: 'Legs',
        weekdays: [3, 6],
        exercises: [
          ['Squat', 3, 6, 8, 180],
          ['Romanian Deadlift', 3, 8, 10, 150],
          ['Leg Press', 3, 10, 12, 120],
          ['Leg Curl', 3, 10, 15, 90],
          ['Leg Extension', 2, 12, 15, 60],
          ['Calf Raise', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    key: 'strength-base',
    name: 'Strength Base',
    summary: 'Three days built around squat, bench press and deadlift. Heavy, low reps, long rest.',
    level: 'Intermediate',
    goal: 'Strength',
    weeks: 8,
    trainingDays: [1, 3, 5],
    days: [
      {
        name: 'Squat Day',
        weekdays: [1],
        exercises: [
          ['Squat', 4, 3, 5, 210],
          ['Bench Press', 3, 5, 6, 180],
          ['Barbell Row', 3, 6, 8, 150],
          ['Leg Curl', 3, 8, 12, 90],
        ],
      },
      {
        name: 'Deadlift Day',
        weekdays: [3],
        exercises: [
          ['Deadlift', 3, 3, 5, 210],
          ['Overhead Press', 4, 4, 6, 180],
          ['Pull Up', 3, 5, 8, 150],
          ['Hanging Leg Raise', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Bench Day',
        weekdays: [5],
        exercises: [
          ['Bench Press', 4, 3, 5, 210],
          ['Front Squat', 3, 5, 6, 180],
          ['Romanian Deadlift', 3, 6, 8, 150],
          ['Lat Pulldown', 3, 8, 10, 90],
          ['Face Pull', 3, 12, 15, 60],
        ],
      },
    ],
  },
  {
    key: 'arms-shoulders',
    name: 'Arms & Shoulders',
    summary: 'Two short add-on sessions for arms and side delts, on top of another program.',
    level: 'Intermediate',
    goal: 'Build muscle',
    weeks: 8,
    trainingDays: [2, 4],
    days: [
      {
        name: 'Arms A',
        weekdays: [2],
        exercises: [
          ['Cable Lateral Raise', 3, 12, 15, 60],
          ['EZ Bar Curl', 3, 8, 12, 90],
          ['Overhead Cable Triceps Extension', 3, 10, 12, 90],
          ['Reverse Pec Deck', 2, 12, 15, 60],
        ],
      },
      {
        name: 'Arms B',
        weekdays: [4],
        exercises: [
          ['Machine Shoulder Press', 3, 8, 10, 120],
          ['Bayesian Cable Curl', 3, 10, 15, 60],
          ['Triceps Pushdown', 3, 10, 15, 60],
          ['Lean In Dumbbell Lateral Raise', 2, 12, 15, 60],
        ],
      },
    ],
  },
];

export function templateExerciseNames(): string[] {
  return [
    ...new Set(TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.exercises.map((e) => e[0])))),
  ];
}

export function setsPerWeek(t: ProgramTemplate): number {
  return t.days.reduce(
    (n, d) => n + d.weekdays.length * d.exercises.reduce((m, e) => m + e[1], 0),
    0,
  );
}

/**
 * The user's own copy of a template. Built-in exercises are matched by name; unknown names are
 * skipped (cannot happen while programs.test passes).
 */
export function instantiateTemplate(
  t: ProgramTemplate,
  ownerId: string,
  exercises: Record<string, Exercise>,
): Program {
  const byName = new Map(
    Object.values(exercises)
      .filter((e) => !e.created_by)
      .map((e) => [e.name.toLowerCase(), e.id]),
  );
  return {
    id: uuid(),
    owner_id: ownerId,
    name: t.name,
    weeks: t.weeks,
    training_days: [...t.trainingDays],
    phases: defaultPhases(t.weeks),
    is_active: false,
    started_on: null,
    updated_at: nowIso(),
    created_at: nowIso(),
    days: t.days.map((d, i) => ({
      id: uuid(),
      position: i,
      name: d.name,
      weekdays: [...d.weekdays],
      exercises: d.exercises
        .filter(([name]) => byName.has(name.toLowerCase()))
        .map(([name, sets, reps_min, reps_max, rest_seconds], j) => ({
          id: uuid(),
          exercise_id: byName.get(name.toLowerCase())!,
          position: j,
          sets,
          reps_min,
          reps_max,
          rest_seconds,
        })),
    })),
  };
}
