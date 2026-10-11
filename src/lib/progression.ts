/**
 * Next-time suggestions from how the last workout went (reps, failure, effort and feel), and a
 * deload hint after several hard workouts in a row. Pure — covered by progression.test.ts.
 */
import type { Feel, Session } from './types';

export const FEEL_KEYS = ['energy', 'sleep', 'pump', 'joints'] as const;

/** Average of the feel ratings (1–5), or null when not rated. */
export function feelAverage(feel?: Feel | null): number | null {
  if (!feel) return null;
  const v = FEEL_KEYS.map((k) => feel[k]).filter((x) => x >= 1 && x <= 5);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** A hard workout: effort 9–10, or it felt bad overall (average feel 2 or less). */
export function isHard(s: Pick<Session, 'rpe' | 'feel'>): boolean {
  const f = feelAverage(s.feel);
  return (s.rpe ?? 0) >= 9 || (f != null && f <= 2);
}

export const isRated = (s: Pick<Session, 'rpe' | 'feel'>) => s.rpe != null || !!s.feel;

/** Smallest sensible jump: 2 kg for dumbbells (pairs of 1 kg steps), otherwise 2.5 kg. */
export function increment(exerciseName: string): number {
  return /dumbbell/i.test(exerciseName) ? 2 : 2.5;
}

export interface Suggestion {
  kind: 'up' | 'hold' | 'down';
  weight: number;
  reps: number;
  reason: string;
}

interface LastSet {
  weight_kg: number;
  reps: number;
  failure?: boolean;
}

/**
 * What to aim for this time, from last time's main sets of the exercise (double progression):
 * - every set at the top weight reached the top of the rep range, not at failure and not a hard
 *   workout → add weight
 * - reached the top but at failure or in a hard workout → repeat it
 * - fell short of the range at failure or in a hard workout → a little lighter
 * - otherwise → same weight, one more rep
 * Bodyweight exercises (0 kg) get no suggestion.
 */
export function suggestNext(
  last: LastSet[],
  plan: { reps_min: number; reps_max: number },
  lastSession: Pick<Session, 'rpe' | 'feel'> | null,
  exerciseName: string,
): Suggestion | null {
  if (last.length === 0) return null;
  const top = Math.max(...last.map((s) => s.weight_kg));
  if (top <= 0) return null;
  const atTop = last.filter((s) => s.weight_kg === top);
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const failure = last.some((s) => s.failure);
  const hard = lastSession ? isHard(lastSession) : false;

  if (minReps >= plan.reps_max) {
    if (!failure && !hard)
      return {
        kind: 'up',
        weight: top + increment(exerciseName),
        reps: plan.reps_min,
        reason: `You hit ${plan.reps_max} reps on every set last time`,
      };
    return {
      kind: 'hold',
      weight: top,
      reps: plan.reps_max,
      reason: failure
        ? 'Top of the range, but at failure. Repeat it before adding weight'
        : 'Top of the range, but it felt hard. Repeat it before adding weight',
    };
  }
  if (minReps < plan.reps_min && (failure || hard)) {
    const lighter = Math.floor((top * 0.95) / 2.5) * 2.5;
    return {
      kind: 'down',
      weight: lighter < top ? lighter : Math.max(0, top - 2.5),
      reps: plan.reps_min,
      reason: `Missed ${plan.reps_min} reps ${failure ? 'at failure' : 'in a hard workout'}. A little lighter`,
    };
  }
  const reps = Math.min(plan.reps_max, Math.max(plan.reps_min, minReps + 1));
  return { kind: 'hold', weight: top, reps, reason: `Same weight, aim for ${reps} reps` };
}

/**
 * Deload hint: the last `count` rated workouts (within 3 weeks) were all hard. `finished` is
 * newest first.
 */
export function deloadAdvice(
  finished: Session[],
  now: Date = new Date(),
  count = 3,
): { hard: number } | null {
  const since = new Date(now.getTime() - 21 * 86400000).toISOString();
  const rated = finished.filter((s) => isRated(s) && s.started_at >= since).slice(0, count);
  return rated.length === count && rated.every(isHard) ? { hard: count } : null;
}

export interface FeelPoint {
  date: string;
  rpe: number | null;
  /** Average feel, 1–5. */
  feel: number | null;
}

/** The last `n` rated workouts, oldest first. `finished` is newest first. */
export function feelTrend(finished: Session[], n = 12): FeelPoint[] {
  return finished
    .filter(isRated)
    .slice(0, n)
    .reverse()
    .map((s) => ({ date: s.started_at, rpe: s.rpe ?? null, feel: feelAverage(s.feel) }));
}
