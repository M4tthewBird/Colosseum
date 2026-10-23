/**
 * What to add next in a workout, from how similar past workouts went on. Pure — covered by
 * nextExercise.test.ts.
 */
import type { Exercise, Session } from './types';
import { regionOf } from './workoutType';

export interface NextPick {
  exerciseId: string;
  /** "After Bench Press in 4 workouts" / "In 3 similar workouts" / "Top-rated for triceps" */
  reason: string;
}

const HISTORY = 60;
const RECENCY = 0.97;
const TIER_RANK = { S: 0, A: 1, B: 2 } as const;

/** Exercises of a finished session in the order they were done (working sets only). */
function sequence(s: Session): string[] {
  const out: string[] = [];
  const sets = s.sets
    .filter((x) => x.done && !x.warmup)
    .sort((a, b) => a.exercise_position - b.exercise_position);
  for (const x of sets) if (!out.includes(x.exercise_id)) out.push(x.exercise_id);
  return out;
}

const times = (n: number) => `${n} ${n === 1 ? 'workout' : 'workouts'}`;

/**
 * Suggestions for the next exercise. `current` is today's exercises in order, `history` the
 * finished workouts newest first.
 * - Past workouts that share exercises with today count, more the more they share and the more
 *   recent they are. Their exercises not done today score, most the one right after today's
 *   last exercise, then the ones later on.
 * - With nothing logged today, it suggests how you usually start.
 * - Without enough history it fills up with S/A-tier exercises for muscles of the same body
 *   regions that today has not trained yet.
 */
export function suggestNextExercises(
  current: string[],
  history: Session[],
  catalog: Record<string, Exercise>,
  limit = 3,
): NextPick[] {
  const today = new Set(current);
  const last = current[current.length - 1];
  const scores = new Map<string, { score: number; after: number; seen: number }>();
  const bump = (id: string, score: number, after: boolean) => {
    const s = scores.get(id) ?? { score: 0, after: 0, seen: 0 };
    s.score += score;
    s.seen += 1;
    if (after) s.after += 1;
    scores.set(id, s);
  };

  history.slice(0, HISTORY).forEach((s, i) => {
    const seq = sequence(s).filter((id) => catalog[id]);
    if (!seq.length) return;
    const recency = RECENCY ** i;
    if (!current.length) {
      bump(seq[0], recency, false);
      return;
    }
    const shared = seq.filter((id) => today.has(id)).length;
    if (!shared) return;
    const sim = shared / current.length;
    const at = last ? seq.indexOf(last) : -1;
    seq.forEach((id, j) => {
      if (today.has(id)) return;
      const next = at >= 0 && j === at + 1;
      const later = at >= 0 && j > at;
      bump(id, sim * recency * (next ? 3 : later ? 1.5 : 1), next);
    });
  });

  const lastName = last ? catalog[last]?.name : undefined;
  const picks: NextPick[] = [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id, s]) => ({
      exerciseId: id,
      reason: !current.length
        ? `How you usually start (${times(s.seen)})`
        : s.after && lastName
          ? `After ${lastName} in ${times(s.after)}`
          : `In ${times(s.seen)} like this one`,
    }));

  if (picks.length >= limit || !current.length) return picks;

  // Fill up: top-rated exercises for muscles of today's regions that are not trained yet.
  const mainOf = (id: string) => catalog[id]?.muscles[0];
  const regions = new Set(current.map((id) => regionOf(mainOf(id) ?? '')).filter(Boolean));
  const trained = new Set(current.flatMap((id) => catalog[id]?.muscles ?? []));
  const taken = new Set([...today, ...picks.map((p) => p.exerciseId)]);
  const usedMuscles = new Set(picks.map((p) => mainOf(p.exerciseId)));
  const fill = Object.values(catalog)
    .filter(
      (e) =>
        !e.created_by &&
        (e.tier === 'S' || e.tier === 'A') &&
        !taken.has(e.id) &&
        e.muscles[0] &&
        regions.has(regionOf(e.muscles[0])) &&
        !trained.has(e.muscles[0]),
    )
    .sort((a, b) => TIER_RANK[a.tier!] - TIER_RANK[b.tier!] || a.name.localeCompare(b.name));
  for (const e of fill) {
    if (picks.length >= limit) break;
    if (usedMuscles.has(e.muscles[0])) continue;
    usedMuscles.add(e.muscles[0]);
    picks.push({ exerciseId: e.id, reason: `Top-rated for ${e.muscles[0]}` });
  }
  return picks;
}
