/** When to ask a beginner about moving up. Pure — see levelUp.test.ts. */
import type { Experience } from './types';

/** A rule of thumb (Matyáš's call): about five weeks at two workouts a week. */
export const LEVEL_UP_AFTER = 10;

/** True once a beginner (or someone who never chose a level) has done enough, and it is time to ask. */
export function levelUpDue(
  experience: Experience | null | undefined,
  workouts: number,
  askAt: number = LEVEL_UP_AFTER,
): boolean {
  return (!experience || experience === 'beginner') && workouts >= Math.max(LEVEL_UP_AFTER, askAt);
}

/** "Not yet" asks again this many workouts later. */
export const askAgainAt = (workouts: number) => workouts + LEVEL_UP_AFTER;
