/**
 * Drop sets: right after a set, lower the weight and keep going. A drop set points at the set it
 * follows (`drop_of`): the main set, or the previous drop. Pure — covered by dropsets.test.ts.
 */

interface Linked {
  id: string;
  drop_of?: string | null;
}

export const isMain = (s: { drop_of?: string | null }) => !s.drop_of;

/** The drops after a main set, in order. */
export function dropChain<T extends Linked>(sets: T[], mainId: string): T[] {
  const next = new Map<string, T>();
  for (const s of sets) if (s.drop_of) next.set(s.drop_of, s);
  const out: T[] = [];
  let cur = next.get(mainId);
  while (cur && out.length < 20) {
    out.push(cur);
    cur = next.get(cur.id);
  }
  return out;
}

/** Each main set with its drops, keeping the order of `sets` for the main sets. */
export function withDrops<T extends Linked>(sets: T[]): { set: T; drops: T[] }[] {
  return sets.filter(isMain).map((set) => ({ set, drops: dropChain(sets, set.id) }));
}

/** Ids of a main set and all its drops. */
export function chainIds(sets: Linked[], mainId: string): string[] {
  return [mainId, ...dropChain(sets, mainId).map((s) => s.id)];
}

/** Weight for a new drop: about 20 % lighter, rounded down to 2.5 kg (never below 0). */
export function dropWeight(weightKg: number): number {
  return Math.max(0, Math.floor((weightKg * 0.8) / 2.5) * 2.5);
}
