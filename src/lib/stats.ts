/** Derived training stats from sessions. Pure functions — covered by stats.test.ts. */
import { addDays, isInWeek, startOfWeek } from './dates';
import { bestsByExercise, e1rm, roundHalf, volume, type Best } from './formulas';
import type { Session, SetEntry } from './types';

export function finished(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.finished_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** Bests per exercise from finished sessions, optionally excluding one session. */
export function historyBests(sessions: Session[], excludeId?: string): Record<string, Best> {
  const sets = sessions.filter((s) => s.finished_at && s.id !== excludeId).flatMap((s) => s.sets);
  return bestsByExercise(sets);
}

/** Sets of this exercise from the most recent finished session that has it. */
export function lastTimeSets(
  sessions: Session[],
  exerciseId: string,
  excludeId?: string,
): SetEntry[] {
  const list = finished(sessions);
  for (const s of list) {
    if (s.id === excludeId) continue;
    const sets = s.sets
      .filter((x) => x.exercise_id === exerciseId && x.done)
      .sort((a, b) => a.set_number - b.set_number);
    if (sets.length) return sets;
  }
  return [];
}

export interface WeekStats {
  workouts: number;
  volumeKg: number;
  prs: number;
}

export function weekStats(sessions: Session[], now: Date = new Date()): WeekStats {
  const ws = startOfWeek(now);
  const inWeek = finished(sessions).filter((s) => isInWeek(new Date(s.started_at), ws));
  return {
    workouts: inWeek.length,
    volumeKg: inWeek.reduce((sum, s) => sum + volume(s.sets), 0),
    prs: inWeek.reduce((sum, s) => sum + s.pr_count, 0),
  };
}

export interface BestSet {
  weight: number;
  reps: number;
  e1rm: number;
}

function bestSetOf(sets: SetEntry[]): BestSet | null {
  let best: BestSet | null = null;
  for (const s of sets) {
    if (!s.done || s.reps <= 0) continue;
    const est = e1rm(s.weight_kg, s.reps);
    if (!best || est > best.e1rm || (est === best.e1rm && s.weight_kg > best.weight)) {
      best = { weight: s.weight_kg, reps: s.reps, e1rm: est };
    }
  }
  return best;
}

export interface ExerciseSession {
  sessionId: string;
  date: string;
  sets: SetEntry[];
  best: BestSet;
  hasPr: boolean;
}

/** Sessions containing this exercise, oldest first. */
export function exerciseHistory(sessions: Session[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const s of finished(sessions).reverse()) {
    const sets = s.sets
      .filter((x) => x.exercise_id === exerciseId && x.done)
      .sort((a, b) => a.set_number - b.set_number);
    const best = bestSetOf(sets);
    if (best)
      out.push({
        sessionId: s.id,
        date: s.started_at,
        sets,
        best,
        hasPr: sets.some((x) => x.is_pr),
      });
  }
  return out;
}

export interface LiftSummary {
  exerciseId: string;
  best: BestSet;
  spark: number[];
  /** Gain in estimated 1RM over the last 12 weeks (kg), or null with too little data. */
  gain: number | null;
  sessions: number;
  lastDate: string;
}

export function liftsSummary(sessions: Session[], now: Date = new Date()): LiftSummary[] {
  const ids = new Set(
    finished(sessions).flatMap((s) => s.sets.filter((x) => x.done).map((x) => x.exercise_id)),
  );
  const since = addDays(now, -84).toISOString();
  const out: LiftSummary[] = [];
  for (const id of ids) {
    const hist = exerciseHistory(sessions, id);
    if (hist.length === 0) continue;
    const best = hist.reduce((b, h) => (h.best.e1rm > b.e1rm ? h.best : b), hist[0].best);
    const recent = hist.filter((h) => h.date >= since);
    const series = (recent.length >= 2 ? recent : hist.slice(-8)).map((h) => h.best.e1rm);
    const gain =
      recent.length >= 2
        ? roundHalf(Math.max(...recent.map((h) => h.best.e1rm)) - recent[0].best.e1rm)
        : null;
    out.push({
      exerciseId: id,
      best,
      spark: series,
      gain,
      sessions: hist.length,
      lastDate: hist[hist.length - 1].date,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || b.lastDate.localeCompare(a.lastDate));
}

export function totalVolume(sessions: Session[]): number {
  return finished(sessions).reduce((sum, s) => sum + volume(s.sets), 0);
}

export function totalPrs(sessions: Session[]): number {
  return finished(sessions).reduce((sum, s) => sum + s.pr_count, 0);
}
