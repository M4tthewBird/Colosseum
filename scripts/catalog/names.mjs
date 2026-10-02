/**
 * One naming style for every exercise: Title Case, no hyphens, no apostrophes, no "(male)",
 * "(side pov)" or "v. 2" notes. Used by build-catalog.mjs and its test.
 */
const ACRONYMS = {
  ez: 'EZ',
  jm: 'JM',
  rdl: 'RDL',
  rom: 'ROM',
  trx: 'TRX',
  bosu: 'BOSU',
  skierg: 'SkiErg',
  v: 'V',
  t: 'T',
  y: 'Y',
  w: 'W',
};
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'on', 'to', 'with', 'for', 'or']);
const TYPOS = [
  [/\brevers\b/g, 'reverse'],
  [/\bsitted\b/g, 'seated'],
  [/45в°/g, '45°'],
];

export function cleanName(raw) {
  let s = raw.toLowerCase();
  for (const [re, b] of TYPOS) s = s.replace(re, b);
  s = s
    .replace(/\((?:[^)]*\b(?:male|female|pov)\b[^)]*)\)/g, ' ') // viewpoint / gender notes
    .replace(/\bv\.\s*\d+\b/g, ' ') // "v. 2"
    .replace(/\s-\s/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/['’]/g, '')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1~$2') // keep 3/4
    .replace(/[-/,]/g, ' ')
    .replace(/~/g, '/')
    .replace(/°/g, ' degree ')
    .replace(/\s+/g, ' ')
    .trim();
  return s
    .split(' ')
    .map((w, i) => {
      if (ACRONYMS[w]) return ACRONYMS[w];
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** Lowercase, no diacritics, single spaces: the dedupe and search key. */
export function key(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}
