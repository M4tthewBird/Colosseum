/**
 * Recommended sets, reps and rest per training goal.
 *
 * Evidence:
 * - Strength: heavy loads (> 60 % 1RM, roughly 1–6 reps) build maximal strength best
 *   (Schoenfeld et al. 2017, JSCR meta-analysis).
 * - Muscle: hypertrophy is similar across ~6–30 reps when sets are taken close to failure;
 *   moderate reps are the practical middle (Schoenfeld et al. 2021, "Loading recommendations for
 *   muscle strength, hypertrophy, and local endurance: a re-examination of the repetition continuum").
 * - Endurance: light-moderate loads for 15+ reps with short rest (ACSM position stand 2009).
 * - Health / general: 8–12 reps (ACSM position stand 2009).
 * - Fat loss: rep range does not change fat loss; lifting is there to keep muscle, so the muscle
 *   ranges apply.
 * Multi-joint lifts get the lower end, isolation lifts the higher end of each range.
 */
import type { Goal } from './types';

export interface Recommendation {
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
}

type Kind = 'compound' | 'isolation';

export const GOAL_LABELS: Record<Goal, string> = {
  strength: 'Strength',
  muscle: 'Build muscle',
  endurance: 'Endurance',
  lean: 'Lose fat',
  health: 'Stay healthy',
};

const TABLE: Record<Goal, Record<Kind, Recommendation>> = {
  strength: {
    compound: { sets: 4, reps_min: 3, reps_max: 6, rest_seconds: 180 },
    isolation: { sets: 3, reps_min: 6, reps_max: 10, rest_seconds: 120 },
  },
  muscle: {
    compound: { sets: 3, reps_min: 6, reps_max: 10, rest_seconds: 150 },
    isolation: { sets: 3, reps_min: 10, reps_max: 15, rest_seconds: 90 },
  },
  lean: {
    compound: { sets: 3, reps_min: 6, reps_max: 10, rest_seconds: 120 },
    isolation: { sets: 3, reps_min: 10, reps_max: 15, rest_seconds: 75 },
  },
  health: {
    compound: { sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90 },
    isolation: { sets: 2, reps_min: 10, reps_max: 15, rest_seconds: 60 },
  },
  endurance: {
    compound: { sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60 },
    isolation: { sets: 3, reps_min: 15, reps_max: 20, rest_seconds: 45 },
  },
};

/** Why the numbers are what they are, shown under the recommendation. */
export const GOAL_NOTES: Record<Goal, string> = {
  strength: 'Heavy weights for few reps build maximal strength best.',
  muscle:
    'Muscle grows across a wide rep range when sets end close to failure; this is the practical middle.',
  lean: 'Reps do not burn more fat; lifting keeps your muscle while you diet, so these match building muscle.',
  health: 'The general recommendation for healthy adults (ACSM).',
  endurance: 'Lighter weights, 15+ reps and short rest build muscular endurance.',
};

/** When several goals are picked, the first in this order sets the default. */
const PRIORITY: Goal[] = ['strength', 'muscle', 'lean', 'health', 'endurance'];

export function primaryGoal(goals: Goal[]): Goal {
  return PRIORITY.find((g) => goals.includes(g)) ?? 'health';
}

/** User's goals in priority order (or "health" when none are set). */
export function orderedGoals(goals: Goal[]): Goal[] {
  const list = PRIORITY.filter((g) => goals.includes(g));
  return list.length ? list : ['health'];
}

const ISOLATION =
  /curl|raise|fly|flye|extension|kickback|pushdown|pec deck|crossover|abduction|shrug|calf|pullover|prayer|face pull|press-around|crunch|nordic|sissy|plank|pull-through|bridge/i;

export function exerciseKind(name: string): Kind {
  return ISOLATION.test(name) ? 'isolation' : 'compound';
}

export function recommend(goal: Goal, exerciseName: string): Recommendation {
  return { ...TABLE[goal][exerciseKind(exerciseName)] };
}
