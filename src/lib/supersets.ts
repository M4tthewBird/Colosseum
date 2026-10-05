/**
 * Supersets: two or more exercises done back to back, one set of each per round, then rest.
 * Exercises (and their sets) in one superset share a superset id. Pure — see supersets.test.ts.
 */

export interface Groupable {
  position: number;
  superset?: string | null;
}

/** Plan entries grouped into pages: consecutive entries with the same superset id go together. */
export function groupPlan<T extends Groupable>(plan: T[]): T[][] {
  const sorted = [...plan].sort((a, b) => a.position - b.position);
  const out: T[][] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.superset && last[0].superset === p.superset) last.push(p);
    else out.push([p]);
  }
  return out;
}

/** Index of the page that holds an exercise position. */
export function groupIndexOf<T extends Groupable>(groups: T[][], position: number): number {
  return groups.findIndex((g) => g.some((p) => p.position === position));
}

export interface RoundSet {
  exercise_position: number;
  set_number: number;
  done: boolean;
}

/** Sets of a superset in the order they are done: A1, B1, A2, B2… */
export function interleave<T extends RoundSet>(sets: T[], positions: number[]): T[] {
  const order = new Map(positions.map((p, i) => [p, i]));
  return [...sets].sort(
    (a, b) =>
      a.set_number - b.set_number ||
      (order.get(a.exercise_position) ?? 0) - (order.get(b.exercise_position) ?? 0),
  );
}

/** "A", "B", "C"… for the exercises of a superset. */
export function letter(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

/**
 * True when every exercise of the group that has a set with this number has it done:
 * the round is over and the rest starts.
 */
export function roundComplete(sets: RoundSet[], positions: number[], setNumber: number): boolean {
  const round = sets.filter(
    (s) => s.set_number === setNumber && positions.includes(s.exercise_position),
  );
  return round.length > 0 && round.every((s) => s.done);
}

/**
 * Letter of each item inside its superset ("A", "B"…), or null when it is not in one.
 * Only consecutive items with the same id count as one superset.
 */
export function supersetLetters(items: { superset?: string | null }[]): (string | null)[] {
  return items.map((it, i) => {
    if (!it.superset) return null;
    let start = i;
    while (start > 0 && items[start - 1].superset === it.superset) start--;
    const alone = start === i && items[i + 1]?.superset !== it.superset;
    return alone ? null : letter(i - start);
  });
}

interface Linkable {
  superset_id?: string | null;
}

/**
 * Links (or unlinks) the exercise at `index` with the one above it in an ordered list.
 * Exercises already linked below the moved one follow it. Ids left on one exercise are cleared.
 */
export function linkWithAbove<T extends Linkable>(
  list: T[],
  index: number,
  on: boolean,
  newId: () => string,
): T[] {
  const out = list.map((e) => ({ ...e }));
  const cur = out[index];
  const above = out[index - 1];
  if (!cur || !above) return out;
  const old = cur.superset_id ?? null;
  const linked = !!old && above.superset_id === old;
  if (on !== linked) {
    const id = on ? (above.superset_id ?? newId()) : newId();
    if (on) above.superset_id = id;
    for (let i = index; i < out.length; i++) {
      if (i > index && (!old || out[i].superset_id !== old)) break;
      out[i].superset_id = id;
    }
  }
  return cleanSupersets(out);
}

/** Clears superset ids that no neighbouring exercise shares. */
export function cleanSupersets<T extends Linkable>(list: T[]): T[] {
  return list.map((e, i) => {
    const id = e.superset_id;
    if (!id) return e;
    const shared = list[i - 1]?.superset_id === id || list[i + 1]?.superset_id === id;
    return shared ? e : { ...e, superset_id: null };
  });
}
