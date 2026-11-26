/**
 * Gloria (a ludus's lasting fame from wars), its war record and its badges. The server applies
 * the same rules when it settles a war (supabase/updates/2026-11-13-gloria.sql); these mirror it
 * for demo mode and for explaining a change. Pure — see game.test.ts.
 */
import type { BadgeDef, BadgeStatus } from '../badges';
import { GLORIA } from './config';

/** A ludus's war record, kept on the ludus row. */
export interface WarRecord {
  gloria: number;
  /** The highest gloria ever reached (badges never go away). */
  best_gloria: number;
  wins: number;
  losses: number;
  /** Wars won as the defender. */
  defences: number;
  /** Wars won against a ludus with more gloria. */
  upsets: number;
  /** Wins in a row now, and the longest run. */
  streak: number;
  best_streak: number;
}

export const EMPTY_RECORD: WarRecord = {
  gloria: 0,
  best_gloria: 0,
  wins: 0,
  losses: 0,
  defences: 0,
  upsets: 0,
  streak: 0,
  best_streak: 0,
};

/**
 * Gloria won and lost in one war. The winner gets GLORIA.win plus a bonus for beating a ludus
 * with more gloria; the loser drops GLORIA.loss, or nothing after a close fight.
 */
export function gloriaChange(
  winnerGloria: number,
  loserGloria: number,
  winnerScore: number,
  loserScore: number,
): { winner: number; loser: number } {
  const upset = Math.min(
    GLORIA.maxUpset,
    Math.floor(Math.max(0, loserGloria - winnerGloria) / GLORIA.upsetStep),
  );
  const close = winnerScore <= 0 || loserScore >= winnerScore * GLORIA.closeShare;
  return {
    winner: GLORIA.win + upset,
    loser: close || loserGloria <= 0 ? 0 : -Math.min(GLORIA.loss, loserGloria),
  };
}

/** The record after one war. */
export function applyWar(
  r: WarRecord,
  won: boolean,
  defended: boolean,
  upset: boolean,
  change: number,
): WarRecord {
  const gloria = Math.max(0, r.gloria + change);
  const streak = won ? r.streak + 1 : 0;
  return {
    gloria,
    best_gloria: Math.max(r.best_gloria, gloria),
    wins: r.wins + (won ? 1 : 0),
    losses: r.losses + (won ? 0 : 1),
    defences: r.defences + (won && defended ? 1 : 0),
    upsets: r.upsets + (won && upset ? 1 : 0),
    streak,
    best_streak: Math.max(r.best_streak, streak),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Badges of a ludus, earned by the whole crew. */
export const LUDUS_BADGES: (BadgeDef & { from: (r: WarRecord) => number })[] = [
  {
    id: 'ludus-wins',
    name: 'Victories',
    icon: 'trophy',
    tiers: [1, 5, 10, 25, 50],
    tierTitle: (n) => (n === 1 ? 'First victory' : `${n} victories`),
    about: 'Wars won.',
    format: (v) => plural(v, 'war') + ' won',
    from: (r) => r.wins,
  },
  {
    id: 'ludus-streak',
    name: 'Unbroken',
    icon: 'flame',
    tiers: [3, 5, 10],
    tierTitle: (n) => `${n} wins in a row`,
    about: 'Wars won in a row, without a loss between.',
    format: (v) => plural(v, 'win') + ' in a row',
    from: (r) => r.best_streak,
  },
  {
    id: 'ludus-walls',
    name: 'Iron wall',
    icon: 'layers',
    tiers: [1, 5, 10, 25],
    tierTitle: (n) => (n === 1 ? 'Held the walls' : `${n} attacks beaten`),
    about: 'Wars won when another clan attacked you.',
    format: (v) => plural(v, 'attack') + ' beaten',
    from: (r) => r.defences,
  },
  {
    id: 'ludus-giants',
    name: 'Giant slayer',
    icon: 'skull',
    tiers: [1, 3, 10],
    tierTitle: (n) => (n === 1 ? 'Giant slain' : `${n} giants slain`),
    about: 'Wars won against a clan with more gloria.',
    format: (v) => plural(v, 'giant') + ' slain',
    from: (r) => r.upsets,
  },
  {
    id: 'ludus-gloria',
    name: 'Gloria',
    icon: 'crown',
    tiers: [100, 250, 500, 1000, 2000],
    tierTitle: (n) => `${n} gloria`,
    about: 'The most gloria your clan has reached.',
    format: (v) => `${v} gloria`,
    from: (r) => r.best_gloria,
  },
];

/** Every ludus badge with its value and the tiers reached. */
export function ludusBadges(r: WarRecord): BadgeStatus[] {
  return LUDUS_BADGES.map((def) => {
    const value = def.from(r);
    const earned = def.tiers
      .filter((t) => value >= t)
      .map((threshold) => ({ threshold, at: null, sessionId: null }));
    return { def, value, earned, next: def.tiers.find((t) => value < t) ?? null };
  });
}
