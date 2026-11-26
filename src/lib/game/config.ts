/**
 * Every number of the game layer in one place (rules in docs/GAME.md). A first pass to tune with
 * real use. The database repeats the caps as check constraints (supabase/updates/2026-11-13-game.sql).
 */

/** A workout earns anything only with at least this many done working sets. */
export const QUALIFYING_SETS = 3;

export const XP = {
  workout: 100,
  verified: 25,
  incomplete: 12,
  pr: 30,
  maxPrs: 3,
  streakWeek: 10,
  maxStreakWeeks: 5,
  together: 20,
  dailyCap: 300,
} as const;

export const LAURELS = {
  attendance: 10,
  verified: 5,
  incomplete: 2,
  /** Progress laurels per workout: gain % × level factor, at least 1 per PR, at most this. */
  maxProgress: 10,
  /** Strength: DOTS total ÷ this, at most maxStrength. */
  strengthDivisor: 60,
  maxStrength: 5,
  weeklyTarget: 15,
  dailyCap: 45,
  duelWin: 25,
  warWin: 30,
  bellumWin: 40,
  /** A new season starts with half of the last score, at most this. */
  carryShare: 0.5,
  maxCarry: 300,
} as const;

export const LEVEL_FACTOR = { beginner: 1, intermediate: 1.5, advanced: 2 } as const;

/** PRs in the first weeks of an exercise set its baseline and earn no progress laurels. */
export const BASELINE_DAYS = 21;

/** A new best this much above the old one (with 2+ earlier sessions) is not rewarded. */
export const UNUSUAL_JUMP = 0.25;
export const UNUSUAL_MIN_SESSIONS = 2;

export const DENARII = {
  verified: 20,
  incomplete: 12,
  unverified: 8,
  pr: 5,
  maxPrs: 3,
  streakWeek: 1,
  maxStreakWeeks: 5,
  togetherLudus: 10,
  dailyCap: 60,
  /** The server accepts at most this on a day without a verified visit. */
  unverifiedDailyCap: 30,
} as const;

export const VISIT = {
  radiusM: 150,
  /** A visit without a check-out closes as incomplete after this. */
  autoCloseHours: 3,
  minMinutes: 20,
  maxMinutes: 240,
  /** A workout started this long before the check-in still belongs to the visit. */
  earlyMinutes: 15,
  /** Scans saved offline are accepted this late. */
  offlineHours: 48,
} as const;

export const LUDUS = {
  /** Members a ludus needs to fight; also the least a war score is divided by. */
  minMembers: 2,
  baseMembers: 5,
  maxMembers: 10,
  nameMax: 24,
  mottoMax: 60,
} as const;

export const WAR = {
  days: 3,
  perWorkout: 10,
  maxWorkoutsPerDay: 2,
  pr: 5,
  maxPrs: 3,
  perDay: 5,
  activeDays: 14,
  rematchDays: 7,
  spoilsShare: 0.2,
  maxSpoils: 300,
  /** Palisade bonus per level for the defender. */
  wallBonus: 0.05,
} as const;

/** Gloria: a ludus's lasting fame from wars. Never resets, never below 0. */
export const GLORIA = {
  win: 30,
  /** Beating a ludus with more gloria: +1 per this many it had more, at most maxUpset. */
  upsetStep: 10,
  maxUpset: 30,
  loss: 10,
  /** A loss with at least this share of the winner's score costs nothing. */
  closeShare: 0.9,
} as const;

export const DUEL = { days: 7 } as const;

export const BELLUM = {
  minActive: 3,
  /** Palisade bonus per level of the gym fortress. */
  wallBonus: 0.02,
} as const;

/** The gym fortress costs this many times the ludus price. */
export const GYM_COST_FACTOR = 3;
/** Repairing a damaged building costs this share of its level cost. */
export const REPAIR_SHARE = 0.4;

/** Fighting style: a flat XP bonus for a workout in the style's way of training. */
export const STYLE = {
  xp: 15,
  /** Murmillo: a working set of this many reps or fewer counts as heavy. */
  heavyReps: 6,
  /** Thraex: this share of working sets in the 8–15 rep range. */
  volumeShare: 2 / 3,
  /** Hoplomachus: this many muscle groups in one workout. */
  groups: 4,
  /** Bestiarius: this share of working sets with no added weight. */
  bodyweightShare: 0.5,
} as const;

/** Running (docs/GAME.md → 11). A run is worth one workout; never anything per km. */
export const RUN = {
  /** A run counts from this distance or this duration. */
  minDistanceM: 3000,
  minDurationS: 20 * 60,
  /** Slower than this (seconds per km) is a walk. */
  maxPace: 12 * 60,
  maxDistanceM: 100000,
  maxDurationS: 12 * 3600,
  /** A run counts for a standard distance d when it is d to d × this long. */
  distanceSlack: 1.05,
  /** Only one PR per run (one distance). */
  maxPrs: 1,
  /** A new best this much faster than the old one (with 2+ earlier runs) is not rewarded. */
  unusualGain: 0.1,
  unusualMinRuns: 2,
  /** Like lifts: the first weeks on a distance set its baseline. */
  baselineDays: 21,
  /** Strength laurels from the best VDOT of this many days: (VDOT − base) ÷ step. */
  vdotDays: 90,
  vdotBase: 30,
  vdotStep: 4,
  maxStrength: 5,
} as const;

/** Gear raises a member's war points by up to this share. */
export const GEAR = { maxWarBonus: 0.15 } as const;

/** Tribe attacks: one gym's tribe against another in the same city. */
export const TRIBE_WAR = {
  /** Warning before the battle starts, for the defenders to get ready. */
  warningHours: 24,
  days: 3,
  /** Paid from the attacking tribe's treasury (a revenge attack is free). */
  cost: 100,
  /** Who may declare: from this level (the Gladiator rank). */
  minLevel: 5,
  /** Each side needs this many active members; also the least a score is divided by. */
  minActive: 3,
  rematchDays: 7,
  spoilsShare: 0.2,
  maxSpoils: 500,
  /** Defender's palisade bonus per level. */
  wallBonus: 0.03,
  /** A revenge attack within this many hours of a lost defence gets the bonus and is free. */
  revengeHours: 24,
  revengeBonus: 0.2,
  /** Strength: points per verified workout in the last 14 days, plus each member's gear power. */
  strengthPerWorkout: 20,
} as const;
