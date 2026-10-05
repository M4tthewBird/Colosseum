/** Swap suggestions: rated exercises that train the same main muscle. Pure — see similar.test.ts. */
import type { Exercise } from './types';

const TIER_RANK = { S: 0, A: 1, B: 2 } as const;

/**
 * Built-in exercises with a tier whose main muscle matches the target's, best tier first,
 * then the ones that share the most muscles with it.
 */
export function similarExercises(target: Exercise, all: Exercise[], limit = 6): Exercise[] {
  const main = target.muscles[0];
  if (!main) return [];
  const own = new Set(target.muscles);
  const overlap = (e: Exercise) => e.muscles.filter((m) => own.has(m)).length;
  return all
    .filter((e) => e.id !== target.id && !e.created_by && e.tier && e.muscles[0] === main)
    .sort(
      (a, b) =>
        TIER_RANK[a.tier!] - TIER_RANK[b.tier!] ||
        overlap(b) - overlap(a) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}
