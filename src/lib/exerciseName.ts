/**
 * The catalog's naming style for user-typed exercise names: Title Case, no hyphens or
 * apostrophes ("cable y-raise" → "Cable Y Raise"). Mirrors scripts/catalog/names.mjs.
 */
const ACRONYMS: Record<string, string> = { ez: 'EZ', jm: 'JM', rdl: 'RDL', rom: 'ROM', trx: 'TRX' };
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'on', 'to', 'with', 'for', 'or']);

export function cleanExerciseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[-/,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(
      (w, i) => ACRONYMS[w] ?? (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)),
    )
    .join(' ');
}
