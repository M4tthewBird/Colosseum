/** Favorite exercises first. Pure — covered by favorites.test.ts. */
import { norm } from './search';

/**
 * Moves favorites ahead of the rest, keeping each part's order. With a search query an exercise
 * whose name is exactly the query stays first, so a favorite never hides what was typed.
 */
export function favoritesFirst<T extends { id: string; name: string }>(
  list: T[],
  isFavorite: (id: string) => boolean,
  query = '',
): T[] {
  const q = norm(query);
  const rank = (e: T) => (q && norm(e.name) === q ? 0 : isFavorite(e.id) ? 1 : 2);
  return list
    .map((e, i) => ({ e, i, r: rank(e) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}
