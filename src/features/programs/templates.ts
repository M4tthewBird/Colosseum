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
          ['Bench press', 3, 6, 8, 150],
          ['Chest-supported row', 3, 8, 12, 120],
          ['Leg curl', 3, 10, 12, 90],
          ['Cable lateral raise', 3, 12, 15, 60],
          ['Overhead cable triceps extension', 2, 10, 15, 60],
        ],
      },
      {
        name: 'Full Body B',
        weekdays: [3],
        exercises: [
          ['Romanian deadlift', 3, 6, 10, 150],
          ['Overhead press', 3, 6, 8, 150],
          ['Lat pulldown', 3, 8, 12, 120],
          ['Leg press', 3, 10, 12, 120],
          ['Bayesian cable curl', 3, 10, 15, 60],
          ['Calf raise', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Full Body C',
        weekdays: [5],
        exercises: [
          ['Hack squat', 3, 8, 10, 150],
          ['Incline dumbbell press', 3, 8, 12, 120],
          ['Seated cable row', 3, 10, 12, 90],
          ['Leg extension', 2, 12, 15, 60],
          ['Reverse pec deck', 3, 12, 15, 60],
          ['Hanging leg raise', 3, 10, 15, 60],
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
          ['Bench press', 4, 5, 8, 180],
          ['Chest-supported row', 3, 8, 10, 120],
          ['Machine shoulder press', 3, 8, 10, 120],
          ['Lat pulldown', 3, 10, 12, 90],
          ['Cable lateral raise', 3, 12, 15, 60],
          ['Overhead cable triceps extension', 3, 10, 12, 60],
        ],
      },
      {
        name: 'Lower 1',
        weekdays: [2],
        exercises: [
          ['Squat', 4, 5, 8, 180],
          ['Romanian deadlift', 3, 8, 10, 150],
          ['Leg extension', 3, 10, 15, 90],
          ['Leg curl', 3, 10, 15, 90],
          ['Calf raise', 4, 10, 15, 60],
        ],
      },
      {
        name: 'Upper 2',
        weekdays: [4],
        exercises: [
          ['Incline dumbbell press', 3, 8, 10, 120],
          ['Neutral-grip pull-up', 3, 6, 10, 150],
          ['Seated cable pec fly', 3, 10, 15, 90],
          ['Seated cable row', 3, 10, 12, 90],
          ['Reverse pec deck', 3, 12, 15, 60],
          ['Bayesian cable curl', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Lower 2',
        weekdays: [5],
        exercises: [
          ['Hack squat', 3, 8, 10, 150],
          ['Hip thrust', 3, 8, 12, 120],
          ['Bulgarian split squat', 3, 8, 12, 90],
          ['Leg curl', 3, 10, 15, 90],
          ['Hanging leg raise', 3, 10, 15, 60],
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
          ['Bench press', 3, 6, 8, 180],
          ['Machine shoulder press', 3, 8, 10, 120],
          ['Incline dumbbell press', 3, 8, 12, 120],
          ['Cable lateral raise', 3, 12, 15, 60],
          ['Overhead cable triceps extension', 3, 10, 12, 60],
          ['Triceps pushdown', 2, 12, 15, 60],
        ],
      },
      {
        name: 'Pull',
        weekdays: [2, 5],
        exercises: [
          ['Lat pulldown', 3, 8, 12, 120],
          ['Chest-supported row', 3, 8, 10, 120],
          ['Wide-grip cable row', 2, 10, 12, 90],
          ['Reverse pec deck', 3, 12, 15, 60],
          ['Bayesian cable curl', 3, 10, 15, 60],
          ['Hammer curl', 2, 10, 12, 60],
        ],
      },
      {
        name: 'Legs',
        weekdays: [3, 6],
        exercises: [
          ['Squat', 3, 6, 8, 180],
          ['Romanian deadlift', 3, 8, 10, 150],
          ['Leg press', 3, 10, 12, 120],
          ['Leg curl', 3, 10, 15, 90],
          ['Leg extension', 2, 12, 15, 60],
          ['Calf raise', 3, 10, 15, 60],
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
          ['Bench press', 3, 5, 6, 180],
          ['Barbell row', 3, 6, 8, 150],
          ['Leg curl', 3, 8, 12, 90],
        ],
      },
      {
        name: 'Deadlift Day',
        weekdays: [3],
        exercises: [
          ['Deadlift', 3, 3, 5, 210],
          ['Overhead press', 4, 4, 6, 180],
          ['Pull-up', 3, 5, 8, 150],
          ['Hanging leg raise', 3, 10, 15, 60],
        ],
      },
      {
        name: 'Bench Day',
        weekdays: [5],
        exercises: [
          ['Bench press', 4, 3, 5, 210],
          ['Front squat', 3, 5, 6, 180],
          ['Romanian deadlift', 3, 6, 8, 150],
          ['Lat pulldown', 3, 8, 10, 90],
          ['Face pull', 3, 12, 15, 60],
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
          ['Cable lateral raise', 3, 12, 15, 60],
          ['EZ-bar curl', 3, 8, 12, 90],
          ['Overhead cable triceps extension', 3, 10, 12, 90],
          ['Reverse pec deck', 2, 12, 15, 60],
        ],
      },
      {
        name: 'Arms B',
        weekdays: [4],
        exercises: [
          ['Machine shoulder press', 3, 8, 10, 120],
          ['Bayesian cable curl', 3, 10, 15, 60],
          ['Triceps pushdown', 3, 10, 15, 60],
          ['Lean-in dumbbell lateral raise', 2, 12, 15, 60],
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
