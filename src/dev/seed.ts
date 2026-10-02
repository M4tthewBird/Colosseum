/**
 * Sample data. Used only in demo mode (no Supabase keys in .env) and on /dev/components.
 * Never import this from screens directly — go through src/features/social/api.ts.
 */
import { addDays, startOfWeek, toLocalDate } from '@/lib/dates';
import { e1rm, markPRs, prCount, volume } from '@/lib/formulas';
import { defaultPhases } from '@/lib/periodization';
import type { Exercise, Gym, Program, PublicUser, Session, SetEntry } from '@/lib/types';

const BUILT_IN: [string, string[], string | null][] = [
  ['Bench press', ['chest', 'triceps', 'shoulders'], 'bench-press'],
  ['Incline bench press', ['upper chest', 'triceps', 'shoulders'], null],
  ['Incline dumbbell press', ['upper chest', 'triceps'], null],
  ['Dumbbell bench press', ['chest', 'triceps'], null],
  ['Dips', ['chest', 'triceps'], null],
  ['Push-up', ['chest', 'triceps'], null],
  ['Overhead press', ['shoulders', 'triceps'], null],
  ['Dumbbell shoulder press', ['shoulders', 'triceps'], null],
  ['Lateral raise', ['shoulders'], null],
  ['Face pull', ['rear delts', 'upper back'], null],
  ['Triceps pushdown', ['triceps'], null],
  ['Skull crusher', ['triceps'], null],
  ['Squat', ['quads', 'glutes'], null],
  ['Front squat', ['quads'], null],
  ['Leg press', ['quads', 'glutes'], null],
  ['Lunge', ['quads', 'glutes'], null],
  ['Bulgarian split squat', ['quads', 'glutes'], null],
  ['Leg extension', ['quads'], null],
  ['Deadlift', ['back', 'glutes', 'hamstrings'], null],
  ['Romanian deadlift', ['hamstrings', 'glutes'], null],
  ['Leg curl', ['hamstrings'], null],
  ['Hip thrust', ['glutes'], null],
  ['Calf raise', ['calves'], null],
  ['Barbell row', ['back', 'biceps'], null],
  ['Dumbbell row', ['back', 'biceps'], null],
  ['Pull-up', ['back', 'biceps'], null],
  ['Chin-up', ['back', 'biceps'], null],
  ['Lat pulldown', ['back', 'biceps'], null],
  ['Seated cable row', ['back'], null],
  ['Shrug', ['traps'], null],
  ['Biceps curl', ['biceps'], null],
  ['Hammer curl', ['biceps', 'forearms'], null],
  ['Preacher curl', ['biceps'], null],
  ['Cable fly', ['chest'], null],
  ['Plank', ['core'], null],
  ['Hanging leg raise', ['core'], null],
  ['Cable crunch', ['core'], null],
  ["Farmer's carry", ['grip', 'traps', 'core'], null],
  ['Good morning', ['hamstrings', 'lower back'], null],
  ['Arnold press', ['shoulders'], null],
  // Jeff Nippard's S, A and B tier exercises (hackmd.io/@dastratman/B1w4jGoDJx)
  ['Cable lateral raise', ['shoulders'], null],
  ['Cable Y-raise', ['shoulders', 'rear delts'], null],
  ['Behind-the-back cuffed cable lateral raise', ['shoulders'], null],
  ['Reverse pec deck', ['rear delts', 'upper back'], null],
  ['Reverse cable crossover', ['rear delts', 'upper back'], null],
  ['Machine shoulder press', ['shoulders', 'triceps'], null],
  ['Standing machine lateral raise', ['shoulders'], null],
  ['Lean-in dumbbell lateral raise', ['shoulders'], null],
  ['Side-lying dumbbell lateral raise', ['shoulders'], null],
  ['Bent-over reverse dumbbell fly', ['rear delts', 'upper back'], null],
  ['Seated machine lateral raise', ['shoulders'], null],
  ['Lean-away dumbbell lateral raise', ['shoulders'], null],
  ['Super-ROM dumbbell lateral raise', ['shoulders'], null],
  ['Seated barbell overhead press', ['shoulders', 'triceps'], null],
  ['Upright row', ['shoulders', 'traps'], null],
  ['Hack squat', ['quads', 'glutes'], null],
  ['Pendulum squat', ['quads', 'glutes'], null],
  ['Smith machine squat', ['quads', 'glutes'], null],
  ['Low-bar squat', ['quads', 'glutes', 'hamstrings'], null],
  ['Reverse Nordic', ['quads'], null],
  ['Goblet squat', ['quads', 'glutes'], null],
  ['Sissy squat', ['quads'], null],
  ['Machine chest press', ['chest', 'triceps', 'shoulders'], null],
  ['Seated cable pec fly', ['chest'], null],
  ['Deficit push-up', ['chest', 'triceps'], null],
  ['Dumbbell guillotine press', ['chest', 'shoulders'], null],
  ['Smith machine bench press', ['chest', 'triceps'], null],
  ['Incline Smith machine bench press', ['upper chest', 'triceps'], null],
  ['Cable crossover', ['chest'], null],
  ['Pec deck', ['chest'], null],
  ['Dumbbell fly', ['chest'], null],
  ['Cable press-around', ['chest'], null],
  ['Decline bench press', ['chest', 'triceps'], null],
  ['Decline dumbbell press', ['chest', 'triceps'], null],
  ['Banded push-up', ['chest', 'triceps'], null],
  ['Neutral-grip lat pulldown', ['back', 'biceps'], null],
  ['One-arm lat pulldown', ['back'], null],
  ['Cross-body one-arm lat pulldown', ['back'], null],
  ['Meadows row', ['back', 'rear delts'], null],
  ['Chest-supported row', ['back', 'rear delts'], null],
  ['Wide-grip cable row', ['upper back', 'rear delts'], null],
  ['Neutral-grip pull-up', ['back', 'biceps'], null],
  ['Deficit Pendlay row', ['back'], null],
  ['Pendlay row', ['back'], null],
  ['Kroc row', ['back', 'biceps', 'forearms'], null],
  ['Cable lat prayer', ['back'], null],
  ['Dumbbell pullover', ['back', 'chest'], null],
  ['Overhead cable triceps extension', ['triceps'], null],
  ['Katana cable triceps extension', ['triceps'], null],
  ['One-arm dumbbell overhead extension', ['triceps'], null],
  ['Dumbbell skull crusher', ['triceps'], null],
  ['Smith machine JM press', ['triceps'], null],
  ['JM press', ['triceps'], null],
  ['Cable triceps kickback', ['triceps'], null],
  ['Close-grip bench press', ['triceps', 'chest'], null],
  ['Rope triceps pushdown', ['triceps'], null],
  ['Dumbbell French press', ['triceps'], null],
  ['Machine dips', ['triceps', 'chest'], null],
  ['Diamond push-up', ['triceps', 'chest'], null],
  ['Bayesian cable curl', ['biceps'], null],
  ['Dumbbell preacher curl', ['biceps'], null],
  ['Machine preacher curl', ['biceps'], null],
  ['Preacher hammer curl', ['biceps', 'forearms'], null],
  ['EZ-bar curl', ['biceps'], null],
  ['Incline dumbbell curl', ['biceps'], null],
  ['Lying dumbbell curl', ['biceps'], null],
  ['Cable curl', ['biceps'], null],
  ['Inverse Zottman curl', ['biceps', 'forearms'], null],
  ['Barbell curl', ['biceps'], null],
  ['Flat bench dumbbell curl', ['biceps'], null],
  ['Walking lunge', ['glutes', 'quads'], null],
  ['Machine hip abduction', ['glutes'], null],
  ['45-degree back extension', ['glutes', 'hamstrings', 'lower back'], null],
  ['Front-foot-elevated Smith machine lunge', ['glutes', 'quads'], null],
  ['Smith machine lunge', ['glutes', 'quads'], null],
  ['Machine hip thrust', ['glutes'], null],
  ['Single-leg dumbbell hip thrust', ['glutes'], null],
  ['Cable glute kickback', ['glutes'], null],
  ['Step-up', ['glutes', 'quads'], null],
  ['Glute bridge', ['glutes'], null],
  ['Cable hip abduction', ['glutes'], null],
  ['Curtsy lunge', ['glutes', 'quads'], null],
  ['Sumo deadlift', ['glutes', 'quads', 'back'], null],
  ['Cable pull-through', ['glutes', 'hamstrings'], null],
];

/** Stable fake uuid from a label, so demo ids survive reloads. */
function sid(label: string): string {
  let h = 0x811c9dc5;
  const parts: string[] = [];
  for (let round = 0; round < 4; round++) {
    for (const ch of `${round}:${label}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    parts.push(h.toString(16).padStart(8, '0'));
  }
  const hex = parts.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const DEMO_EXERCISES: Exercise[] = BUILT_IN.map(([name, muscles, image_key]) => ({
  id: sid(`ex:${name}`),
  name,
  muscles,
  image_key,
  created_by: null,
}));

const ex = (name: string) => DEMO_EXERCISES.find((e) => e.name === name)!.id;

export const DEMO_GYMS: Gym[] = [
  { id: sid('gym:iron'), name: 'Iron Forum', city: 'Prague' },
  { id: sid('gym:titan'), name: 'Titan Gym', city: 'Brno' },
  { id: sid('gym:olymp'), name: 'Olymp Fitness', city: 'Prague' },
];

export const DEMO_USERS: (PublicUser & { home_gym_id: string })[] = [
  ['tomas', 'Tomáš Král'],
  ['adam', 'Adam Novák'],
  ['jakub', 'Jakub Beneš'],
  ['ondrej', 'Ondřej Svoboda'],
  ['filip', 'Filip Horák'],
  ['lukas', 'Lukáš Veselý'],
  ['petr', 'Petr Dvořák'],
].map(([username, display_name]) => ({
  id: sid(`user:${username}`),
  username,
  display_name,
  avatar_url: null,
  home_gym_id: DEMO_GYMS[0].id,
}));

export const demoUser = (username: string) => DEMO_USERS.find((u) => u.username === username)!;

/** Sample bests per friend (kg, estimated 1RM) and weekly volume (kg). */
export const DEMO_STATS: Record<
  string,
  {
    bench: number;
    squat: number;
    deadlift: number;
    weekVolume: number;
    workouts: number;
    bodyweight: number;
  }
> = {
  tomas: { bench: 115, squat: 150, deadlift: 185, weekVolume: 17900, workouts: 4, bodyweight: 96 },
  adam: { bench: 110, squat: 160, deadlift: 190, weekVolume: 16200, workouts: 3, bodyweight: 104 },
  jakub: { bench: 105, squat: 140, deadlift: 200, weekVolume: 14800, workouts: 3, bodyweight: 112 },
  ondrej: {
    bench: 102.5,
    squat: 135,
    deadlift: 170,
    weekVolume: 24100,
    workouts: 5,
    bodyweight: 78,
  },
  filip: { bench: 95, squat: 130, deadlift: 165, weekVolume: 12000, workouts: 2, bodyweight: 85 },
  lukas: { bench: 90, squat: 120, deadlift: 150, weekVolume: 9600, workouts: 2, bodyweight: 72 },
  petr: { bench: 85, squat: 110, deadlift: 150, weekVolume: 7000, workouts: 1, bodyweight: 68 },
};

/** A Push/Pull/Legs program for the demo user. */
export function demoProgram(userId: string, now: Date): Program {
  const pe = (
    day: string,
    name: string,
    i: number,
    sets: number,
    min: number,
    max: number,
    rest = 120,
  ) => ({
    id: sid(`pe:${day}:${name}`),
    exercise_id: ex(name),
    position: i,
    sets,
    reps_min: min,
    reps_max: max,
    rest_seconds: rest,
  });
  return {
    id: sid('program:ppl'),
    owner_id: userId,
    name: 'Push Pull Legs',
    weeks: 8,
    training_days: [1, 2, 4, 5],
    phases: defaultPhases(8),
    is_active: true,
    started_on: toLocalDate(addDays(startOfWeek(now), -14)),
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    days: [
      {
        id: sid('day:push'),
        position: 0,
        name: 'Push Day',
        weekdays: [2, 5],
        exercises: [
          pe('push', 'Bench press', 0, 4, 6, 8),
          pe('push', 'Overhead press', 1, 3, 8, 8),
          pe('push', 'Incline dumbbell press', 2, 3, 10, 10, 90),
          pe('push', 'Lateral raise', 3, 3, 12, 15, 60),
          pe('push', 'Triceps pushdown', 4, 3, 12, 12, 60),
        ],
      },
      {
        id: sid('day:pull'),
        position: 1,
        name: 'Pull Day',
        weekdays: [1],
        exercises: [
          pe('pull', 'Deadlift', 0, 3, 5, 5, 180),
          pe('pull', 'Barbell row', 1, 4, 6, 8),
          pe('pull', 'Lat pulldown', 2, 3, 10, 10, 90),
          pe('pull', 'Face pull', 3, 3, 15, 15, 60),
          pe('pull', 'Biceps curl', 4, 3, 10, 12, 60),
        ],
      },
      {
        id: sid('day:legs'),
        position: 2,
        name: 'Leg Day',
        weekdays: [4],
        exercises: [
          pe('legs', 'Squat', 0, 4, 5, 6, 180),
          pe('legs', 'Romanian deadlift', 1, 3, 8, 8),
          pe('legs', 'Leg press', 2, 3, 10, 12, 90),
          pe('legs', 'Leg curl', 3, 3, 12, 12, 60),
          pe('legs', 'Calf raise', 4, 4, 15, 15, 60),
        ],
      },
    ],
  };
}

const START_KG: Record<string, number> = {
  'Bench press': 85,
  'Overhead press': 50,
  'Incline dumbbell press': 26,
  'Lateral raise': 10,
  'Triceps pushdown': 30,
  Deadlift: 160,
  'Barbell row': 75,
  'Lat pulldown': 60,
  'Face pull': 25,
  'Biceps curl': 30,
  Squat: 125,
  'Romanian deadlift': 100,
  'Leg press': 180,
  'Leg curl': 45,
  'Calf raise': 80,
};

/** ~12 weeks of history following the demo program, with steady progress and some PRs. */
export function demoSessions(userId: string, program: Program, now: Date): Session[] {
  const out: Session[] = [];
  const bests: Record<string, { weight: number; e1rm: number }> = {};
  const firstMonday = addDays(startOfWeek(now), -7 * 12);
  let n = 0;
  for (let d = firstMonday; d < now; d = addDays(d, 1)) {
    const wd = d.getDay() === 0 ? 7 : d.getDay();
    const day = program.days.find((x) => x.weekdays.includes(wd));
    if (!day) continue;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 30);
    if (start > now) continue;
    // Skip a few days so the calendar looks real.
    if ((n++ * 7) % 23 === 3) continue;
    const week = Math.floor((start.getTime() - firstMonday.getTime()) / (7 * 86400000));
    const id = sid(`session:${start.toISOString()}`);
    const sets: SetEntry[] = [];
    for (const e of day.exercises) {
      const name = DEMO_EXERCISES.find((x) => x.id === e.exercise_id)!.name;
      const base = START_KG[name] ?? 40;
      const kg = Math.round((base * (1 + Math.floor(week / 3) * 0.035)) / 2.5) * 2.5;
      for (let s = 1; s <= e.sets; s++) {
        sets.push({
          id: sid(`set:${id}:${e.position}:${s}`),
          session_id: id,
          exercise_id: e.exercise_id,
          exercise_position: e.position,
          set_number: s,
          weight_kg: kg,
          reps: Math.max(e.reps_min, e.reps_max - (s > 2 ? 1 : 0)),
          done: true,
          is_pr: false,
          updated_at: start.toISOString(),
        });
      }
    }
    const prs = markPRs(sets, bests);
    sets.forEach((s, i) => {
      s.is_pr = prs[i];
      const b = bests[s.exercise_id] ?? { weight: 0, e1rm: 0 };
      bests[s.exercise_id] = {
        weight: Math.max(b.weight, s.weight_kg),
        e1rm: Math.max(b.e1rm, e1rm(s.weight_kg, s.reps)),
      };
    });
    const minutes = 52 + ((n * 13) % 20);
    out.push({
      id,
      user_id: userId,
      program_day_id: day.id,
      name: day.name,
      started_at: start.toISOString(),
      finished_at: new Date(start.getTime() + minutes * 60000).toISOString(),
      volume_kg: volume(sets),
      set_count: sets.length,
      pr_count: prCount(sets),
      updated_at: start.toISOString(),
      sets,
    });
  }
  return out;
}

export function demoBodyweights(now: Date): { logged_on: string; weight_kg: number }[] {
  const out = [];
  for (let i = 10; i >= 0; i--) {
    out.push({
      logged_on: toLocalDate(addDays(now, -i * 4)),
      weight_kg: Math.round((83.6 - (10 - i) * 0.12) * 10) / 10,
    });
  }
  return out;
}

export const DEMO_MEASUREMENTS = [
  {
    daysAgo: 45,
    chest_cm: 103,
    shoulders_cm: 122,
    biceps_l_cm: 38,
    biceps_r_cm: 38.5,
    forearms_cm: 31,
    waist_cm: 82.5,
    thighs_cm: 59.5,
    calves_cm: 38.5,
  },
  {
    daysAgo: 17,
    chest_cm: 104,
    shoulders_cm: 123.5,
    biceps_l_cm: 38.5,
    biceps_r_cm: 39,
    forearms_cm: 31,
    waist_cm: 81,
    thighs_cm: 60.5,
    calves_cm: 39,
  },
];

export const DEMO_FEED = [
  {
    user: 'ondrej',
    workout: 'Pull Day',
    minutesAgo: 35,
    duration: 58,
    volume: 12400,
    prs: 2,
    likes: 14,
    comments: 3,
  },
  {
    user: 'filip',
    workout: 'Leg Day',
    minutesAgo: 60,
    duration: 72,
    volume: 16100,
    prs: 1,
    likes: 8,
    comments: 1,
  },
  {
    user: 'tomas',
    workout: 'Push Day',
    minutesAgo: 180,
    duration: 61,
    volume: 11800,
    prs: 1,
    likes: 5,
    comments: 0,
  },
  {
    user: 'adam',
    workout: 'Leg Day',
    minutesAgo: 60 * 26,
    duration: 70,
    volume: 15900,
    prs: 0,
    likes: 9,
    comments: 2,
  },
];

export const DEMO_FRIEND_PRS = [
  { user: 'tomas', lift: 'Bench press', minutesAgo: 120, weight: 115, reps: 1 },
  { user: 'adam', lift: 'Squat', minutesAgo: 300, weight: 160, reps: 1 },
  { user: 'jakub', lift: 'Deadlift', minutesAgo: 60 * 26, weight: 200, reps: 1 },
];

export const DEMO_COMMENTS = [
  { user: 'tomas', body: 'Strong session 💪', minutesAgo: 20 },
  { user: 'adam', body: 'Those PRs though!', minutesAgo: 12 },
];

export const DEMO_CHALLENGE = {
  title: '10,000 pull-ups together',
  metric: 'reps' as const,
  exercise: 'Pull-up',
  target: 10000,
  gymTotal: 6420,
  myTotal: 182,
  daysLeft: 12,
};

export const DEMO_GYM_MEMBERS = 248;
export const DEMO_TRAINING_NOW = ['tomas', 'adam', 'jakub', 'ondrej', 'filip'];
