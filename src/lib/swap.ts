/** Swapping an exercise in the active workout. Pure — see swap.test.ts. */
import { isMain } from './dropsets';
import type { SetEntry } from './types';
import { isWork } from './warmups';

/** Working sets of one exercise in order (no drop sets, no warm-ups). */
export function workSetsAt(sets: SetEntry[], position: number): SetEntry[] {
  return sets
    .filter((s) => s.exercise_position === position && isMain(s) && isWork(s))
    .sort((a, b) => a.set_number - b.set_number);
}

/**
 * The session's sets after the exercise at `position` becomes `exerciseId`. Done sets move along
 * as logged. Open working sets are replaced one for one by `fresh` (filled in for the new
 * exercise), keeping their set numbers. Open warm-ups and drop sets were meant for the old
 * exercise, so they go, and so does a done drop set whose main set went.
 */
export function swapSets(
  sets: SetEntry[],
  position: number,
  exerciseId: string,
  fresh: SetEntry[],
  now: string,
): SetEntry[] {
  const open = workSetsAt(sets, position).filter((s) => !s.done);
  const kept = new Set(
    sets.filter((s) => s.exercise_position === position && s.done).map((s) => s.id),
  );
  const out: SetEntry[] = [];
  for (const s of sets) {
    if (s.exercise_position !== position) out.push(s);
    else if (kept.has(s.id) && (!s.drop_of || kept.has(s.drop_of)))
      out.push({ ...s, exercise_id: exerciseId, updated_at: now });
  }
  open.forEach((s, i) => {
    const f = fresh[i];
    if (f) out.push({ ...f, set_number: s.set_number, superset_id: s.superset_id ?? null });
  });
  return out;
}
