/**
 * Forgiving exercise search: ignores case, diacritics and hyphens, accepts words in any order,
 * word prefixes ("lat pull"), common gym abbreviations ("rdl", "ohp", "db") and small typos
 * ("benchpress", "squar", "romainan"). Pure — covered by search.test.ts.
 */

export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}

/** Abbreviations expand to words that must all appear. */
const ABBREVIATIONS: Record<string, string> = {
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  ohp: 'overhead press',
  bss: 'bulgarian split squat',
  db: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  ez: 'ez',
  bp: 'bench press',
  pullup: 'pull up',
  pullups: 'pull up',
  chinup: 'chin up',
  pushup: 'push up',
  pushups: 'push up',
  situp: 'sit up',
  benchpress: 'bench press',
  latpulldown: 'lat pulldown',
  tricep: 'triceps',
  bicep: 'biceps',
  delt: 'shoulder',
  delts: 'shoulder',
  lats: 'lat',
  abs: 'crunch',
  calfs: 'calf',
  calves: 'calf',
};

function expand(query: string): string[] {
  return norm(query)
    .split(' ')
    .filter(Boolean)
    .flatMap((t) => (ABBREVIATIONS[t] ?? t).split(' '));
}

/**
 * Edit distance where swapping two neighbouring letters ("rasie" / "raise") counts as one edit
 * (optimal string alignment). Stops early once it exceeds `max`.
 */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const allowed = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

/** How well one query token matches the name's words: 3 exact, 2 prefix, 1 typo, 0 none. */
function tokenScore(token: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === token) return 3;
    if (w.startsWith(token)) best = Math.max(best, 2);
    else if (best < 1) {
      const max = allowed(token.length);
      if (
        max &&
        (distance(token, w, max) <= max ||
          distance(token, w.slice(0, token.length), max) <= max - (max > 1 ? 1 : 0))
      )
        best = 1;
    }
  }
  return best;
}

/**
 * Score of a name for the query; 0 = no match. Every query word has to match some word in the
 * name. Exact and prefix matches beat typos; names that start with the query and shorter names
 * rank higher.
 */
export function matchScore(query: string, name: string): number {
  const tokens = expand(query);
  if (tokens.length === 0) return 0;
  const n = norm(name);
  const words = n.split(' ');
  let score = 0;
  for (const t of tokens) {
    const s = tokenScore(t, words);
    if (s === 0) {
      // "benchpress" style: the query word may be several name words glued together
      if (t.length >= 6 && n.replace(/ /g, '').includes(t)) {
        score += 2;
        continue;
      }
      return 0;
    }
    score += s;
  }
  const q = tokens.join(' ');
  if (n === q) score += 6;
  else if (n.startsWith(q)) score += 4;
  else if (n.includes(q)) score += 2;
  return score * 10 - words.length;
}

export interface Searchable {
  name: string;
  tier?: 'S' | 'A' | 'B' | null;
}

const TIER_BONUS = { S: 6, A: 4, B: 2 } as const;

/** Matches sorted best first; tiered exercises get a small boost. */
export function searchExercises<T extends Searchable>(query: string, items: T[], limit = 60): T[] {
  return items
    .map((item) => {
      const s = matchScore(query, item.name);
      return { item, s: s > 0 ? s + (item.tier ? TIER_BONUS[item.tier] : 0) : 0 };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((x) => x.item);
}
