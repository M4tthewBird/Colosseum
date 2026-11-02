/**
 * Correcting a finished workout: changing, removing or adding sets, then working out again what
 * depends on them. Pure functions, covered by sessionEdit.test.ts.
 */
import { chainIds, isMain } from './dropsets';
import { bestsByExercise, markPRs, prCount, volume, type Best } from './formulas';
import type { Session, SetEntry } from './types';
import { isWork } from './warmups';

/** Volume, set count and PR count from the sets, the same way finishing a workout does. */
export function withTotals(s: Session): Session {
  return {
    ...s,
    volume_kg: volume(s.sets),
    set_count: s.sets.filter(isWork).length,
    pr_count: prCount(s.sets),
  };
}

/** Removes a set with its drop sets; the later sets of that exercise move up a number. */
export function removeEditedSet(sets: SetEntry[], setId: string): SetEntry[] {
  const target = sets.find((x) => x.id === setId);
  if (!target) return sets;
  const remove = new Set(chainIds(sets, setId));
  const left = sets.filter((x) => !remove.has(x.id));
  if (target.drop_of || !isWork(target)) return left;
  const moved = (x: SetEntry) =>
    x.exercise_position === target.exercise_position &&
    isWork(x) &&
    x.set_number > target.set_number;
  return left.map((x) => (moved(x) ? { ...x, set_number: x.set_number - 1 } : x));
}

/** One more done set for an exercise, starting from the numbers of its last one. */
export function addEditedSet(sets: SetEntry[], position: number, id: string): SetEntry[] {
  const work = sets
    .filter((x) => x.exercise_position === position && isMain(x) && isWork(x))
    .sort((a, b) => a.set_number - b.set_number);
  const last = work[work.length - 1];
  if (!last) return sets;
  return [
    ...sets,
    { ...last, id, set_number: last.set_number + 1, done: true, is_pr: false, failure: false },
  ];
}

/** Any set without reps: it would count for nothing, so it should be filled in or removed. */
export function hasEmptySet(sets: SetEntry[]): boolean {
  return sets.some((x) => x.reps <= 0);
}

const merged = (a: Record<string, Best>, b: Record<string, Best>): Record<string, Best> => {
  const out = { ...a };
  for (const [id, best] of Object.entries(b)) {
    const had = out[id];
    out[id] = had
      ? { weight: Math.max(had.weight, best.weight), e1rm: Math.max(had.e1rm, best.e1rm) }
      : best;
  }
  return out;
};

/**
 * PR flags again from the edited workout onward, because it changes what later workouts had to
 * beat. A corrected typo of 1000 kg gives the PRs it hid back. Only the given exercises are
 * touched. Returns the edited workout (with fresh totals) and every later one that changed.
 */
export function reflagPRs(
  sessions: Session[],
  editedId: string,
  exerciseIds: Set<string>,
): Session[] {
  const order = sessions
    .filter((s) => s.finished_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const at = order.findIndex((s) => s.id === editedId);
  if (at < 0) return [];
  let bests = bestsByExercise(order.slice(0, at).flatMap((s) => s.sets));
  const out: Session[] = [];
  for (const s of order.slice(at)) {
    const ordered = [...s.sets].sort(
      (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
    );
    const flags = markPRs(ordered, bests);
    let changed = false;
    const sets = ordered.map((x, i) => {
      if (!exerciseIds.has(x.exercise_id) || x.is_pr === flags[i]) return x;
      changed = true;
      return { ...x, is_pr: flags[i] };
    });
    bests = merged(bests, bestsByExercise(s.sets));
    if (s.id === editedId) out.push(withTotals({ ...s, sets }));
    else if (changed) out.push({ ...s, sets, pr_count: prCount(sets) });
  }
  return out;
}
