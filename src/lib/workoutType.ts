/**
 * What kind of workout a session was (Push, Pull, Legs, Upper, Lower, Arms, Full body), read from
 * the muscles of its exercises, and which earlier workout is fair to compare it with. Pure —
 * covered by workoutType.test.ts.
 */
import type { Session, SetEntry } from './types';

export type WorkoutKind = 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Arms' | 'Core' | 'Full body';

export const WORKOUT_KINDS: WorkoutKind[] = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Full body',
  'Arms',
  'Core',
];

type Region = 'push' | 'pull' | 'legs' | 'arms' | 'core';

const REGION: Record<string, Region> = {
  chest: 'push',
  'upper chest': 'push',
  shoulders: 'push',
  triceps: 'arms',
  back: 'pull',
  'upper back': 'pull',
  'rear delts': 'pull',
  traps: 'pull',
  neck: 'pull',
  biceps: 'arms',
  forearms: 'arms',
  quads: 'legs',
  glutes: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  'lower back': 'legs',
  core: 'core',
};

/** Muscle → weight. The first muscle of an exercise counts fully, the others half. */
export type MuscleVector = Record<string, number>;

/** Weighted muscle counts over the done main sets (drop sets do not count). */
export function muscleVector(
  sets: Pick<SetEntry, 'exercise_id' | 'done' | 'drop_of'>[],
  musclesOf: (exerciseId: string) => string[],
): MuscleVector {
  const v: MuscleVector = {};
  for (const s of sets) {
    if (!s.done || s.drop_of) continue;
    musclesOf(s.exercise_id).forEach((m, i) => {
      v[m] = (v[m] ?? 0) + (i === 0 ? 1 : 0.5);
    });
  }
  return v;
}

export function workoutKind(v: MuscleVector): WorkoutKind | null {
  const r: Record<Region, number> = { push: 0, pull: 0, legs: 0, arms: 0, core: 0 };
  let total = 0;
  for (const [m, w] of Object.entries(v)) {
    const region = REGION[m];
    if (!region) continue;
    r[region] += w;
    total += w;
  }
  if (total === 0) return null;
  const share = (x: number) => x / total;
  if (share(r.legs) >= 0.6) return 'Legs';
  if (share(r.core) >= 0.6) return 'Core';
  if (share(r.legs) <= 0.2) {
    const upper = r.push + r.pull + r.arms;
    if (share(r.arms) >= 0.6) return 'Arms';
    // Arms follow whatever they are trained with: triceps with push, biceps with pull.
    if (r.push / upper >= 0.55 && r.pull / upper <= 0.15) return 'Push';
    if (r.pull / upper >= 0.55 && r.push / upper <= 0.15) return 'Pull';
    return 'Upper';
  }
  return 'Full body';
}

/** Cosine similarity of two muscle vectors, 0 … 1. */
export function similarity(a: MuscleVector, b: MuscleVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, x] of Object.entries(a)) {
    na += x * x;
    dot += x * (b[k] ?? 0);
  }
  for (const x of Object.values(b)) nb += x * x;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface Comparable {
  session: Session;
  kind: WorkoutKind | null;
  /** 'same' = the same program day or name; 'similar' = same kind of workout by muscles. */
  match: 'same' | 'similar';
}

/**
 * The most recent earlier finished workout that is fair to compare with: the same program day
 * (or the same name for free workouts), otherwise the same kind of workout with similar muscles.
 * `earlier` is newest first.
 */
export function comparableWorkout(
  session: Session,
  earlier: Session[],
  musclesOf: (exerciseId: string) => string[],
): Comparable | null {
  const mine = muscleVector(session.sets, musclesOf);
  const kind = workoutKind(mine);
  const same = earlier.find((s) =>
    session.program_day_id
      ? s.program_day_id === session.program_day_id
      : !s.program_day_id && s.name === session.name && session.name !== 'Workout',
  );
  if (same) return { session: same, kind, match: 'same' };
  if (!kind) return null;
  let best: { s: Session; score: number } | null = null;
  for (const s of earlier) {
    const v = muscleVector(s.sets, musclesOf);
    if (workoutKind(v) !== kind) continue;
    const score = similarity(mine, v);
    if (score >= 0.5 && (!best || score > best.score + 0.15)) best = { s, score };
  }
  return best ? { session: best.s, kind, match: 'similar' } : null;
}
