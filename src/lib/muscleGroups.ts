/**
 * Muscle groups and hard sets per week. Pure — see muscleGroups.test.ts.
 *
 * Evidence: more weekly sets build more muscle with diminishing returns (Pelland et al. 2026, Sports
 * Med), and at least 10 per muscle beats fewer (Schoenfeld et al. 2017, J Sports Sci). Around 12–20 is
 * a reasonable target (Baz-Valle et al. 2022, J Hum Kinet); more can add a little. A set counts 1 for
 * the main muscle and 0.5 for those that assist, the counting that fit the data best (Pelland 2026).
 */
import { isMain } from './dropsets';
import { isInWeek, startOfWeek } from './dates';
import type { Exercise, Session } from './types';
import { isWork } from './warmups';

/** Biggest first: the order a workout trains them in. */
export const MUSCLE_GROUPS = [
  'Quads',
  'Back',
  'Chest',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Triceps',
  'Biceps',
  'Calves',
  'Core',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const WEEKLY_SETS = { min: 10, max: 20 };

const GROUP_OF: Record<string, MuscleGroup> = {
  quads: 'Quads',
  back: 'Back',
  'upper back': 'Back',
  'lower back': 'Back',
  traps: 'Back',
  chest: 'Chest',
  'upper chest': 'Chest',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  shoulders: 'Shoulders',
  'rear delts': 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  calves: 'Calves',
  core: 'Core',
};

/** The group an exercise mainly trains, or null (cardio, grip…). */
export function mainGroup(muscles: string[]): MuscleGroup | null {
  return GROUP_OF[muscles[0]] ?? null;
}

/** What one set is worth per group: 1 for the main muscle, 0.5 for those that assist. */
export function setCredit(muscles: string[]): Map<MuscleGroup, number> {
  const credit = new Map<MuscleGroup, number>();
  muscles.forEach((m, i) => {
    const g = GROUP_OF[m];
    if (g) credit.set(g, Math.max(credit.get(g) ?? 0, i === 0 ? 1 : 0.5));
  });
  return credit;
}

/** Done working sets per group in the week of `now`, from finished workouts. */
export function weeklySets(
  sessions: Session[],
  exercises: Record<string, Exercise>,
  now: Date = new Date(),
): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>;
  const week = startOfWeek(now);
  for (const s of sessions) {
    if (!s.finished_at || !isInWeek(new Date(s.started_at), week)) continue;
    for (const x of s.sets) {
      if (!x.done || !isMain(x) || !isWork(x)) continue;
      for (const [g, c] of setCredit(exercises[x.exercise_id]?.muscles ?? [])) out[g] += c;
    }
  }
  return out;
}

export type WeeklyLevel = 'below' | 'in range' | 'above';

export function weeklyLevel(sets: number): WeeklyLevel {
  if (sets < WEEKLY_SETS.min) return 'below';
  return sets > WEEKLY_SETS.max ? 'above' : 'in range';
}
