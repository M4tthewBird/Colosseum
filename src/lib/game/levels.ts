/** Levels, ranks and leagues. Pure — see levels.test.ts. */
import { LAURELS } from './config';

/** Total XP needed to reach a level (level 1 = 0). */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return 50 * n * n + 100 * n;
}

export function levelFromXp(xp: number): number {
  // Inverse of xpForLevel (50n² + 100n = xp), then nudged for float rounding.
  const n = Math.floor((-100 + Math.sqrt(10000 + 200 * Math.max(0, xp))) / 100);
  let level = Math.max(1, n + 1);
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** 0–1 */
  share: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const span = xpForLevel(level + 1) - base;
  const into = Math.max(0, xp - base);
  return { level, into, span, share: span ? into / span : 0 };
}

export type RankId = 'tiro' | 'gladiator' | 'veteranus' | 'primus' | 'rudiarius';

export interface Rank {
  id: RankId;
  name: string;
  from: number;
  /** One line on what the rank means. */
  blurb: string;
  /** What the gladiator wears at this rank. */
  look: string;
}

export const RANKS: Rank[] = [
  {
    id: 'tiro',
    name: 'Tiro',
    from: 1,
    blurb: 'A recruit, new to the ludus.',
    look: 'Tunic, wooden sword',
  },
  {
    id: 'gladiator',
    name: 'Gladiator',
    from: 5,
    blurb: 'Trained and fighting in the arena.',
    look: 'Helmet, round shield, gladius',
  },
  {
    id: 'veteranus',
    name: 'Veteranus',
    from: 12,
    blurb: 'Survived many fights.',
    look: 'Scutum, manica, crest',
  },
  {
    id: 'primus',
    name: 'Primus Palus',
    from: 25,
    blurb: 'The best of the ludus.',
    look: 'Golden armour, red cloak',
  },
  {
    id: 'rudiarius',
    name: 'Rudiarius',
    from: 40,
    blurb: 'Earned the wooden sword of freedom.',
    look: 'Golden laurel, the rudis',
  },
];

export function rankFor(level: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.from) r = x;
  return r;
}

export function nextRank(level: number): Rank | null {
  return RANKS.find((r) => r.from > level) ?? null;
}

export type LeagueId = 'bronze' | 'silver' | 'gold' | 'imperator';

export interface League {
  id: LeagueId;
  name: string;
  from: number;
}

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Bronze', from: 0 },
  { id: 'silver', name: 'Silver', from: 150 },
  { id: 'gold', name: 'Gold', from: 350 },
  { id: 'imperator', name: 'Imperator’s Arena', from: 700 },
];

export function leagueFor(score: number): League {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (score >= x.from) l = x;
  return l;
}

export function nextLeague(score: number): League | null {
  return LEAGUES.find((l) => l.from > score) ?? null;
}

/** What the next season starts with. */
export function carryOver(score: number): number {
  return Math.min(LAURELS.maxCarry, Math.floor(Math.max(0, score) * LAURELS.carryShare));
}

/** "2026-11" for a local date "2026-11-13" or a Date. */
export function seasonOf(day: string | Date): string {
  if (typeof day === 'string') return day.slice(0, 7);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
}

/** The season after "2026-12" is "2027-01". */
export function nextSeason(season: string): string {
  const [y, m] = season.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "November 2026". */
export function seasonName(season: string): string {
  const [y, m] = season.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Whole days left in the season, counting today. */
export function seasonDaysLeft(now: Date = new Date()): number {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}
