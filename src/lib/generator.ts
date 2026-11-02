/**
 * Builds one workout from the muscles someone wants to train. Pure — see generator.test.ts.
 * The rules, the research behind them and how sure each one is: docs/GENERATOR.md.
 */
import { EQUIPMENT_EXERCISES, type Equipment } from '@/data/equipmentExercises';

import { MUSCLE_GROUPS, mainGroup, setCredit, type MuscleGroup } from './muscleGroups';
import { exerciseKind, recommend, type Recommendation } from './repRanges';
import { isMachine } from './exerciseName';
import type { Exercise, Experience, Goal } from './types';

const TIER_RANK = { S: 0, A: 1, B: 2 } as const;
const UNRATED = 3;
const MAX_PER_GROUP = 4;
const MAX_EXERCISES = 12;
/** Two or more sets per exercise beat one (Krieger 2009, Currier 2023). */
const MIN_SETS = 2;
/** Default rest (Matyáš's call): 3:00 on big lifts, 2:00 on small ones. Endurance keeps its short rests. */
const BIG_REST = 180;
const SMALL_REST = 120;
/** Short on time, every rest comes down to this before sets are dropped. */
const SHORT_REST = SMALL_REST;
const SECONDS_PER_SET = 45;
const SETUP_SECONDS = 60;
/** Two warm-up sets on a lift, with their rests. */
const WARMUP_SECONDS = 180;
/** The time estimate is rough, so a workout may run this much over the time chosen. */
const TIME_SLACK = 1.07;
/** Worked hard by another muscle's lifts: first to lose an exercise of their own when time is short. */
const ASSISTED: [MuscleGroup, MuscleGroup][] = [
  ['Shoulders', 'Chest'],
  ['Triceps', 'Chest'],
  ['Biceps', 'Back'],
];
/** One warm-up per part of the body: a squat warms the hamstrings too. */
const REGIONS: Partial<Record<MuscleGroup, string>> = {
  Quads: 'legs',
  Hamstrings: 'legs',
  Glutes: 'legs',
  Calves: 'legs',
  Chest: 'push',
  Shoulders: 'push',
  Triceps: 'push',
  Back: 'pull',
  Biceps: 'pull',
};
/** Back is built on rows and pulldowns; arms and small muscles have their own isolation lifts. */
const ALWAYS_COMPOUND: MuscleGroup[] = ['Back'];
const ALWAYS_ISOLATION: MuscleGroup[] = ['Triceps', 'Biceps', 'Calves', 'Core'];

/** The most sets per muscle in a session when going by time. Hypertrophy gains level off near 11. */
export const MAX_SETS = { beginner: 6, intermediate: 8, advanced: 10 } as const;

/** Ready-made choices for people who do not think in muscles. Fewest muscles that cover it. */
export const PRESETS: { name: string; groups: MuscleGroup[] }[] = [
  { name: 'Full body', groups: ['Quads', 'Back', 'Chest', 'Hamstrings', 'Shoulders'] },
  { name: 'Upper', groups: ['Back', 'Chest', 'Shoulders', 'Triceps', 'Biceps'] },
  { name: 'Lower', groups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
  { name: 'Push', groups: ['Chest', 'Shoulders', 'Triceps'] },
  { name: 'Pull', groups: ['Back', 'Biceps'] },
];

export interface GenerateOptions {
  groups: MuscleGroup[];
  setsPerGroup: number;
  /** A fixed rest; null follows the goal (longer on big lifts). */
  restSeconds: number | null;
  goal: Goal;
  /** Beginners get moderate weights and movements that are easy to learn. */
  experience?: Experience;
  /** What there is to train with. Without a full gym, exercises come from hand-made lists. */
  equipment?: Equipment;
  exercises: Exercise[];
  /** The curated part of the catalog: unrated exercises outside it are not picked. */
  curated: Set<string>;
  favorites: Set<string>;
  /** Another seed shuffles the picks within each tier. */
  seed: number;
}

export interface GeneratedExercise {
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
}

const MOVEMENTS = [
  'incline',
  'decline',
  'squat',
  'lunge',
  'step up',
  'leg press',
  'leg extension',
  'leg curl',
  'deadlift',
  'hip thrust',
  'bridge',
  'bench press',
  'chest press',
  'push up',
  'dip',
  'fly',
  'crossover',
  'pec deck',
  'pulldown',
  'pull up',
  'chin up',
  'pullover',
  'row',
  'shoulder press',
  'overhead press',
  'lateral raise',
  'reverse',
  'curl',
  'extension',
  'pushdown',
  'skull',
  'kickback',
  'calf',
  'crunch',
];

/** Hard to learn without a coach, or unkind to joints on day one. Beginners get them only as a last resort. */
const HARD_TO_LEARN =
  /archer|deadlift|front squat|low bar|good morning|jm press|guillotine|sissy|nordic|skull|katana|cuffed|pullover|upright row|front foot|curtsy|dips?$|pull up|chin up/i;

/** Not in every gym, or a niche variation. A beginner should find the machine and know what it is. */
const RARE =
  /pendulum|belt squat|v squat|reverse hack|prayer|machine preacher|preacher hammer|bayesian|super rom/i;
/** One leg or arm at a time: balance limits them, so they never go heavy for 3–6 repetitions. */
const NOT_HEAVY = /lunge|step up|split squat|single leg|one arm/i;

/** At home these are only swaps, for those who have a bar: nobody should be handed one unasked. */
const NEEDS_A_BAR = /pull up|chin up|inverted row/i;

/** Your whole body is the load: few people reach 8–20 of these. */
const HARD_BODYWEIGHT = /pull up|chin up|^dips$/i;

/** The kind of movement, from the name; the name itself when none fits. */
export function movementOf(name: string): string {
  const n = name.toLowerCase();
  return MOVEMENTS.find((m) => n.includes(m)) ?? n;
}

/** A number from a string and a seed, to shuffle the same way for the same seed. */
function hash(text: string, seed: number): number {
  let h = (seed * 2654435761) >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The exercises for one group, best first. */
function ranked(group: MuscleGroup, o: GenerateOptions): Exercise[] {
  if (o.equipment && o.equipment !== 'gym') {
    const names = EQUIPMENT_EXERCISES[o.equipment][group];
    const rank = (e: Exercise) =>
      Math.floor(names.indexOf(e.name) / 2) - (o.favorites.has(e.id) ? 1 : 0);
    return o.exercises
      .filter(
        (e) =>
          !e.created_by &&
          names.includes(e.name) &&
          !(o.equipment === 'home' && NEEDS_A_BAR.test(e.name)),
      )
      .sort((a, b) => rank(a) - rank(b) || hash(a.id, o.seed) - hash(b.id, o.seed));
  }
  const beginner = o.experience === 'beginner';
  const score = (e: Exercise) =>
    (e.tier ? TIER_RANK[e.tier] : UNRATED) -
    (o.favorites.has(e.id) ? 1 : 0) +
    // Machines guide the movement: same results, less to learn (Haugen 2023).
    (beginner && isMachine(e.name) ? -0.5 : 0) +
    (beginner && HARD_TO_LEARN.test(e.name) ? 4 : 0) +
    (beginner && RARE.test(e.name) ? 2 : 0) +
    // Side delts first: rows and pulldowns already reach the rear ones.
    (e.muscles[0] === 'rear delts' ? 2 : 0);
  return o.exercises
    .filter(
      (e) =>
        !e.created_by &&
        (e.tier || o.curated.has(e.name)) &&
        !/plank/i.test(e.name) && // held for time, and sets here are logged in reps
        mainGroup(e.muscles) === group,
    )
    .sort((a, b) => score(a) - score(b) || hash(a.id, o.seed) - hash(b.id, o.seed));
}

/** The goal's sets, reps and rest; beginners stay at moderate weights whatever the goal. */
function scheme(o: GenerateOptions, name: string): Recommendation {
  const goal = recommend(o.goal, name);
  const big = exerciseKind(name) === 'compound';
  const rest = o.goal === 'endurance' ? goal.rest_seconds : big ? BIG_REST : SMALL_REST;
  const light = NOT_HEAVY.test(name) || o.equipment === 'dumbbells';
  if (o.equipment === 'bodyweight' || o.equipment === 'home')
    // Nothing to load: repetitions take its place, and growth holds over a wide range of them.
    return HARD_BODYWEIGHT.test(name)
      ? { ...goal, reps_min: 5, reps_max: 12, rest_seconds: rest }
      : { ...goal, reps_min: 8, reps_max: 20, rest_seconds: rest };
  const rec = light
    ? {
        ...goal,
        reps_min: Math.max(goal.reps_min, 6),
        reps_max: Math.max(goal.reps_max, 10),
        rest_seconds: rest,
      }
    : { ...goal, rest_seconds: rest };
  if (o.experience !== 'beginner') return rec;
  return {
    sets: Math.min(rec.sets, 3),
    reps_min: Math.max(rec.reps_min, 8),
    reps_max: Math.max(rec.reps_max, 12),
    rest_seconds: rec.rest_seconds,
  };
}

/** Sets for the next exercise: its normal number, or what is left when that is close (one more at most). */
function setsFor(left: number, normal: number, extra: number): number {
  if (left >= normal + 2) return normal;
  return Math.min(normal + extra, Math.max(MIN_SETS, Math.ceil(left)));
}

export function generateWorkout(o: GenerateOptions): GeneratedExercise[] {
  const groups = MUSCLE_GROUPS.filter((g) => o.groups.includes(g));
  const credit = new Map<MuscleGroup, number>();
  const picked: Exercise[] = [];
  const out: (GeneratedExercise & { compound: boolean })[] = [];

  const add = (e: Exercise, sets: number, group: MuscleGroup) => {
    const rec = scheme(o, e.name);
    picked.push(e);
    const worth = setCredit(e.muscles);
    for (const [g, c] of worth) credit.set(g, (credit.get(g) ?? 0) + c * sets);
    // A list can pick it for a muscle the catalog calls secondary: it counts in full here.
    const own = worth.get(group) ?? 0;
    if (own < 1) credit.set(group, (credit.get(group) ?? 0) + (1 - own) * sets);
    out.push({
      exercise_id: e.id,
      sets,
      reps_min: rec.reps_min,
      reps_max: rec.reps_max,
      rest_seconds: o.restSeconds ?? rec.rest_seconds,
      compound: exerciseKind(e.name) === 'compound',
    });
  };

  for (const group of groups) {
    const list = ranked(group, o);
    for (let n = 0; n < MAX_PER_GROUP && out.length < MAX_EXERCISES; n++) {
      const left = o.setsPerGroup - (credit.get(group) ?? 0);
      // The first exercise always comes: the user asked for this muscle.
      if (n > 0 && left <= 1) break;
      const unused = list.filter((e) => !picked.includes(e));
      // A beginner sees a hard-to-learn lift only when nothing else is left, even a repeat movement.
      const easy =
        o.experience === 'beginner' ? unused.filter((x) => !HARD_TO_LEARN.test(x.name)) : [];
      const free = easy.length ? easy : unused;
      const moved = new Set(picked.map((e) => movementOf(e.name)));
      const fresh = free.filter((e) => !moved.has(movementOf(e.name)));
      const open = fresh.length ? fresh : free;
      if (!open.length) break;
      // Start the muscle with a multi-joint lift, then mix in isolation work.
      const wantCompound =
        !ALWAYS_ISOLATION.includes(group) && (ALWAYS_COMPOUND.includes(group) || n % 2 === 0);
      const e = open.find((x) => (exerciseKind(x.name) === 'compound') === wantCompound) ?? open[0];
      add(e, setsFor(left, scheme(o, e.name).sets, o.experience === 'beginner' ? 0 : 1), group);
    }
  }

  return [...out]
    .sort((a, b) => Number(b.compound) - Number(a.compound))
    .map(({ compound: _, ...e }) => e);
}

/**
 * The exercises that get warm-up sets: the first lift for the legs, for pushing and for pulling.
 * The muscles nearby are warm after that (a squat warms the hamstrings, a press the triceps).
 */
export function warmupExercises(
  list: GeneratedExercise[],
  exercises: Record<string, Exercise | undefined>,
): string[] {
  const warm = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const muscles = exercises[e.exercise_id]?.muscles ?? [];
    const main = mainGroup(muscles);
    const region = main ? REGIONS[main] : undefined;
    if (region && !warm.has(region)) {
      warm.add(region);
      out.push(e.exercise_id);
    }
  }
  return out;
}

/** How long it takes, moving between exercises and warm-up sets included. */
export function workoutMinutes(list: GeneratedExercise[], warmups = 0): number {
  const seconds = list.reduce(
    (sum, e) => sum + e.sets * (SECONDS_PER_SET + e.rest_seconds) + SETUP_SECONDS,
    warmups * WARMUP_SECONDS,
  );
  return Math.round(seconds / 60);
}

type TimeOptions = Omit<GenerateOptions, 'setsPerGroup' | 'restSeconds'>;

export interface TimePlan {
  setsPerGroup: number;
  restSeconds: number | null;
  /** The muscles that keep an exercise of their own. */
  groups: MuscleGroup[];
  /** Left without one to save time: they still work in the other lifts. */
  dropped: MuscleGroup[];
}

/**
 * Sets and rest that fit the time. The most sets up to `maxSets`; when time is short, shorter rests
 * come before fewer sets, except for strength, which needs the rest to lift heavy. Still too long at
 * the fewest sets: muscles that other lifts already work lose their own exercise.
 */
export function planForTime(
  o: TimeOptions,
  minutes: number,
  maxSets: number,
  withWarmups = false,
  /** A rest the user chose: it stays, and only the sets change. */
  fixedRest: number | null = null,
): TimePlan {
  const byId = Object.fromEntries(o.exercises.map((e) => [e.id, e]));
  const fits = (groups: MuscleGroup[], setsPerGroup: number, restSeconds: number | null) => {
    const list = generateWorkout({ ...o, groups, setsPerGroup, restSeconds });
    const warmups = withWarmups ? warmupExercises(list, byId).length : 0;
    return workoutMinutes(list, warmups) <= minutes * TIME_SLACK;
  };
  // A beginner on moderate weights does not need the long rests of heavy strength work.
  const heavy = o.goal === 'strength' && o.experience !== 'beginner';
  const rests: (number | null)[] =
    fixedRest !== null ? [fixedRest] : heavy ? [null] : [null, SHORT_REST];
  const shortest = rests[rests.length - 1];
  for (let sets = maxSets; sets >= MIN_SETS; sets--)
    for (const restSeconds of rests)
      if (fits(o.groups, sets, restSeconds))
        return { setsPerGroup: sets, restSeconds, groups: o.groups, dropped: [] };
  let groups = o.groups;
  const dropped: MuscleGroup[] = [];
  for (const [muscle, by] of ASSISTED) {
    if (!groups.includes(muscle) || !groups.includes(by)) continue;
    groups = groups.filter((g) => g !== muscle);
    dropped.push(muscle);
    if (fits(groups, MIN_SETS, shortest)) break;
  }
  return { setsPerGroup: MIN_SETS, restSeconds: shortest, groups, dropped };
}

/**
 * The same time spent differently: fewer exercises with more sets each. Muscles that other lifts
 * already work give up their own exercise first. Null when that does not raise the sets.
 */
export function focusedPlan(
  o: TimeOptions,
  minutes: number,
  maxSets: number,
  withWarmups = false,
  fixedRest: number | null = null,
): TimePlan | null {
  const listOf = (groups: MuscleGroup[], plan: TimePlan) =>
    generateWorkout({
      ...o,
      groups,
      setsPerGroup: plan.setsPerGroup,
      restSeconds: plan.restSeconds,
    });
  const average = (list: GeneratedExercise[]) =>
    list.reduce((sum, e) => sum + e.sets, 0) / Math.max(1, list.length);
  const base = planForTime(o, minutes, maxSets, withWarmups, fixedRest);
  const baseList = listOf(base.groups, base);
  let groups = base.groups;
  const dropped = [...base.dropped];
  for (const [muscle, by] of ASSISTED) {
    if (!groups.includes(muscle) || !groups.includes(by)) continue;
    groups = groups.filter((g) => g !== muscle);
    dropped.push(muscle);
    const plan = planForTime({ ...o, groups }, minutes, maxSets, withWarmups, fixedRest);
    const list = listOf(plan.groups, plan);
    if (list.length < baseList.length && average(list) >= average(baseList) + 0.5)
      return { ...plan, dropped: [...dropped, ...plan.dropped] };
  }
  return null;
}

/** What else fits this exercise's muscle with the same equipment. */
export function equipmentAlternatives(
  equipment: Exclude<Equipment, 'gym'>,
  target: Exercise,
  all: Exercise[],
): Exercise[] {
  const group = (Object.keys(EQUIPMENT_EXERCISES[equipment]) as MuscleGroup[]).find((g) =>
    EQUIPMENT_EXERCISES[equipment][g].includes(target.name),
  );
  const names = group ? EQUIPMENT_EXERCISES[equipment][group] : [];
  return all.filter((e) => e.id !== target.id && !e.created_by && names.includes(e.name));
}

/** "5 exercises, 2 sets each"; "5 exercises, 2–3 sets each". */
export function shapeText(list: GeneratedExercise[]): string {
  const sets = list.map((e) => e.sets);
  const low = Math.min(...sets);
  const high = Math.max(...sets);
  const count = `${list.length} exercise${list.length === 1 ? '' : 's'}`;
  if (low === high) return `${count}, ${low} sets${list.length === 1 ? '' : ' each'}`;
  return `${count}, ${low}–${high} sets each`;
}

/** How hard to go: with few sets, each one has to count (docs/GENERATOR.md). */
export function effortCue(list: GeneratedExercise[]): string {
  const average = list.reduce((sum, e) => sum + e.sets, 0) / Math.max(1, list.length);
  return average < 2.5
    ? 'Only 2 sets, so make them count: stop with just 1–2 repetitions left in you.'
    : 'Stop each set with 2–3 repetitions left in you.';
}

/** The ready-made choice these muscles are, if any. */
export function presetOf(groups: MuscleGroup[]): string | null {
  return (
    PRESETS.find(
      (p) => p.groups.length === groups.length && p.groups.every((g) => groups.includes(g)),
    )?.name ?? null
  );
}

/** "Upper", "Chest + Triceps"; "Full body" when it is most of the body. */
export function generatedName(groups: MuscleGroup[]): string {
  const preset = presetOf(groups);
  if (preset) return preset;
  if (groups.length >= 6) return 'Full body';
  return MUSCLE_GROUPS.filter((g) => groups.includes(g)).join(' + ');
}
