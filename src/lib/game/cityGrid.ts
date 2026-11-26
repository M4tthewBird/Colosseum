/**
 * The modular city's grid (docs/GAME.md §9 "Building the city"). Pieces are painted on diamond
 * plots of 1×1, 2×2 or 3×3 tiles. A new piece must share a tile edge with one already built, so
 * the city grows from its arena in one block. The ground under the city is paved; each piece is
 * drawn a little smaller than its plot (STREET of a tile in from every side), so the paving shows
 * between neighbours as streets that follow every change. A piece that holds part of the city
 * together cannot be taken away, and the arena always stays.
 */

/** The street on each side of a plot, in tiles (two plots side by side: twice this). */
export const STREET = 0.1;

export interface Placed {
  /** Unique within the city. */
  key: number;
  /** Piece id (assets/game/painted/manifest.json). */
  id: string;
  /** Top tile: i runs to the lower right, j to the lower left. */
  i: number;
  j: number;
}

/** Plot size in tiles, by piece id. */
export type SizeOf = (id: string) => number;

const tileKey = (i: number, j: number) => `${i},${j}`;
export const parseTile = (key: string): [number, number] =>
  key.split(',').map(Number) as [number, number];

/** Every tile a piece stands on, mapped to its key. */
export function tilesOf(list: Placed[], size: SizeOf): Map<string, number> {
  const tiles = new Map<string, number>();
  for (const p of list) {
    const n = size(p.id);
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) tiles.set(tileKey(p.i + a, p.j + b), p.key);
  }
  return tiles;
}

/** The tiles along the four sides of an n×n square at (i, j). */
export function edgeTiles(i: number, j: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < n; a++)
    out.push([i + a, j - 1], [i + a, j + n], [i - 1, j + a], [i + n, j + a]);
  return out;
}

/** The free tiles a new piece could start from: the ones touching the city. */
export function edgeOfCity(city: Placed[], size: SizeOf): Set<string> {
  const tiles = tilesOf(city, size);
  const out = new Set<string>();
  for (const key of tiles.keys()) {
    const [i, j] = parseTile(key);
    for (const [x, y] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      const k = tileKey(x, y);
      if (!tiles.has(k)) out.add(k);
    }
  }
  return out;
}

/**
 * Can a piece of `id` stand with its top tile at (i, j)? On free tiles and sharing an edge with
 * the city; anything goes in an empty city. `without` leaves one piece out (a move).
 */
export function fits(
  city: Placed[],
  size: SizeOf,
  id: string,
  i: number,
  j: number,
  without?: number,
): boolean {
  const rest = city.filter((p) => p.key !== without);
  if (!rest.length) return true;
  const n = size(id);
  const tiles = tilesOf(rest, size);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) if (tiles.has(tileKey(i + a, j + b))) return false;
  return edgeTiles(i, j, n).some(([x, y]) => tiles.has(tileKey(x, y)));
}

/** Does every other piece stay joined to the root once `without` is gone? */
export function staysWhole(
  city: Placed[],
  size: SizeOf,
  rootKey: number,
  without: number,
): boolean {
  if (without === rootKey) return false;
  const rest = city.filter((p) => p.key !== without);
  const root = rest.find((p) => p.key === rootKey);
  if (!root || rest.length <= 1) return true;
  const tiles = tilesOf(rest, size);
  const seen = new Set([root.key]);
  const queue = [root];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [x, y] of edgeTiles(p.i, p.j, size(p.id))) {
      const other = tiles.get(tileKey(x, y));
      if (other != null && !seen.has(other)) {
        seen.add(other);
        queue.push(rest.find((q) => q.key === other)!);
      }
    }
  }
  return seen.size === rest.length;
}

/**
 * Back to front, for drawing: a piece is behind another when all its tiles lie at smaller i, or
 * (where they overlap along i) all at smaller j.
 */
export function drawOrder<T extends Placed>(list: T[], size: SizeOf): T[] {
  const behind = (A: T, B: T) => {
    if (A.i + size(A.id) <= B.i) return true;
    if (B.i + size(B.id) <= A.i) return false;
    return A.j + size(A.id) <= B.j;
  };
  const left = [...list];
  const out: T[] = [];
  while (left.length) {
    const n = left.findIndex((A) => !left.some((B) => B !== A && behind(B, A)));
    out.push(...left.splice(n < 0 ? 0 : n, 1));
  }
  return out;
}

/** A layout built from a wish list, keeping only the pieces the rules allow, in order. */
export function layOut(plan: [string, number, number][], size: SizeOf): Placed[] {
  const city: Placed[] = [];
  for (const [id, i, j] of plan) {
    if (fits(city, size, id, i, j)) city.push({ key: city.length + 1, id, i, j });
  }
  return city;
}
