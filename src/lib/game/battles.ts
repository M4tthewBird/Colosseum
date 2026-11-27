/**
 * Scores of ludus wars, duels and Bellum. The server computes the real ones (war_scores,
 * duel_scores, bellum_standings); these mirror them for demo mode and for explaining a score.
 * Pure — see battles.test.ts.
 */
import { toLocalDate } from '../dates';
import { e1rm } from '../formulas';
import { BELLUM, LUDUS, WAR } from './config';
import { qualifies, workingSets } from './engine';
import type { Session } from '../types';

export interface WarWorkout {
  user_id: string;
  started_at: string;
  prs: number;
}

/** Raw war points of one side: verified workouts (2 a day), PRs (3 a workout), days trained. */
export function warPoints(workouts: WarWorkout[]): number {
  const perUserDay = new Map<string, number>();
  let points = 0;
  for (const w of [...workouts].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const key = `${w.user_id}:${toLocalDate(new Date(w.started_at))}`;
    const n = perUserDay.get(key) ?? 0;
    perUserDay.set(key, n + 1);
    if (n >= WAR.maxWorkoutsPerDay) continue;
    points += WAR.perWorkout + WAR.pr * Math.min(w.prs, WAR.maxPrs) + (n === 0 ? WAR.perDay : 0);
  }
  return points;
}

/** Points per active member (at least 2), with the defender's palisade bonus. */
export function warScore(points: number, activeMembers: number, palisade = 0): number {
  const per = points / Math.max(LUDUS.minMembers, activeMembers);
  return Math.round(per * (1 + WAR.wallBonus * palisade) * 10) / 10;
}

/** The winner of a war; a tie goes to the defender. */
export function warWinner(attacker: number, defender: number): 'attacker' | 'defender' {
  return attacker > defender ? 'attacker' : 'defender';
}

/** Spoils: a share of the loser's hours (minutes), capped. */
export function warSpoils(loserTreasury: number): number {
  return Math.min(WAR.maxSpoils, Math.floor(Math.max(0, loserTreasury) * WAR.spoilsShare));
}

export type DuelKind = 'workouts' | 'lift';

/**
 * One player's duel score in [from, to): qualifying workouts, or kg added to the best e1RM of
 * the exercise compared with everything before the duel.
 */
export function duelScore(
  sessions: Session[],
  kind: DuelKind,
  exerciseId: string | null,
  from: Date,
  to: Date,
): number {
  const inWindow = (s: Session) => {
    const t = new Date(s.started_at).getTime();
    return t >= from.getTime() && t < to.getTime();
  };
  if (kind === 'workouts') return sessions.filter((s) => qualifies(s) && inWindow(s)).length;
  let before = 0;
  let during = 0;
  for (const s of sessions) {
    if (!s.finished_at) continue;
    const t = new Date(s.started_at).getTime();
    for (const x of workingSets(s)) {
      if (x.exercise_id !== exerciseId || x.drop_of || x.reps <= 0) continue;
      const est = e1rm(x.weight_kg, x.reps);
      if (t < from.getTime()) before = Math.max(before, est);
      else if (t < to.getTime()) during = Math.max(during, est);
    }
  }
  if (!before) return 0;
  return Math.max(0, Math.round((during - before) * 10) / 10);
}

/** Bellum: verified visit days per active member, with the palisade bonus. Null below 3 active. */
export function bellumScore(visitDays: number, activeMembers: number, palisade = 0): number | null {
  if (activeMembers < BELLUM.minActive) return null;
  return Math.round((visitDays / activeMembers) * (1 + BELLUM.wallBonus * palisade) * 100) / 100;
}
