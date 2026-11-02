/**
 * Progress worth saying out loud, and coming back after a break. Pure — see progress.test.ts.
 * It only ever reports what went up: a worse day says nothing.
 */
import { isMain } from './dropsets';
import { e1rm, formatKg } from './formulas';
import { finished } from './stats';
import type { Session } from './types';
import { isWork } from './warmups';

const DAY = 86400000;
/** How many earlier times of an exercise count as "recent", and how few are enough to compare. */
const RECENT_TIMES = 4;
const MIN_TIMES = 2;
/** "Since your first time" needs some history behind it. */
const FIRST_TIME_DAYS = 14;
/** A week off is normal; from this many days on it is a break. */
const BREAK_DAYS = 14;

/** The best set of an exercise in one workout. */
interface Point {
  date: string;
  weight: number;
  reps: number;
}

export interface ProgressLine {
  exerciseId: string;
  from: Point;
  to: Point;
  /** How much better, as a share of where it started: the biggest gains come first. */
  share: number;
}

export interface WorkoutProgress {
  /** This workout against recent times of the same exercises, biggest gain first. */
  recent: ProgressLine[];
  /** The biggest gain since the first time of an exercise, with how long ago that was. */
  sinceFirst: (ProgressLine & { days: number }) | null;
}

const strength = (p: Point) => (p.weight > 0 ? e1rm(p.weight, p.reps) : p.reps);

function bestSet(session: Session, exerciseId: string): Point | null {
  let best: Point | null = null;
  for (const s of session.sets) {
    if (s.exercise_id !== exerciseId || !s.done || !isMain(s) || !isWork(s)) continue;
    const p = { date: session.started_at, weight: s.weight_kg, reps: s.reps };
    if (!best || strength(p) > strength(best)) best = p;
  }
  return best;
}

/**
 * How much better `to` is than `from`, or null. More weight must not have cost too many reps, and
 * a lighter weight for more reps is not called progress, so the message stays simple and true.
 */
function gain(exerciseId: string, from: Point, to: Point): ProgressLine | null {
  if ((from.weight === 0) !== (to.weight === 0)) return null;
  if (strength(to) <= strength(from)) return null;
  let share = 0;
  if (to.weight > from.weight) share = (to.weight - from.weight) / from.weight;
  else if (to.weight === from.weight && to.reps > from.reps)
    share = (to.reps - from.reps) / Math.max(1, from.reps);
  return share > 0 ? { exerciseId, from, to, share } : null;
}

export function workoutProgress(session: Session, sessions: Session[]): WorkoutProgress {
  const earlier = finished(sessions)
    .filter((s) => s.id !== session.id && s.started_at < session.started_at)
    .reverse();
  const recent: ProgressLine[] = [];
  let sinceFirst: WorkoutProgress['sinceFirst'] = null;
  for (const id of new Set(session.sets.map((s) => s.exercise_id))) {
    const now = bestSet(session, id);
    if (!now) continue;
    const history = earlier.flatMap((s) => bestSet(s, id) ?? []);
    if (history.length < MIN_TIMES) continue;
    const window = history.slice(-RECENT_TIMES);
    const line = gain(id, window[0], now);
    if (line) recent.push(line);
    const first = gain(id, history[0], now);
    const days = (Date.parse(now.date) - Date.parse(history[0].date)) / DAY;
    if (first && days >= FIRST_TIME_DAYS && (!sinceFirst || first.share > sinceFirst.share))
      sinceFirst = { ...first, days };
  }
  return { recent: recent.sort((a, b) => b.share - a.share), sinceFirst };
}

/** "+7.5 kg", "+2 reps at 80 kg", "+3 reps". */
export function gainText({ from, to }: ProgressLine): string {
  if (to.weight > from.weight) return `+${formatKg(to.weight - from.weight)} kg`;
  const reps = to.reps - from.reps;
  const label = `+${reps} rep${reps === 1 ? '' : 's'}`;
  return to.weight > 0 ? `${label} at ${formatKg(to.weight)} kg` : label;
}

/** "80 → 95 kg", "8 → 15 reps". */
export function changeText({ from, to }: ProgressLine): string {
  return to.weight > from.weight
    ? `${formatKg(from.weight)} → ${formatKg(to.weight)} kg`
    : `${from.reps} → ${to.reps} reps`;
}

/** "3 weeks", "2 months". */
export function durationText(days: number): string {
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'}`;
  if (days < 60) return unit(Math.max(1, Math.round(days / 7)), 'week');
  return unit(Math.round(days / 30), 'month');
}

export interface Break {
  /** The workout before the break: dismissing the card lasts until the next break. */
  lastSessionId: string;
  days: number;
}

/** How long it has been, when that makes this a break. Null for new users and regulars. */
export function currentBreak(sessions: Session[], now: Date = new Date()): Break | null {
  const last = finished(sessions)[0];
  if (!last) return null;
  const days = (now.getTime() - Date.parse(last.started_at)) / DAY;
  return days >= BREAK_DAYS ? { lastSessionId: last.id, days } : null;
}

/** How long the break before this workout was, in days, when it came after one. */
export function breakBefore(session: Session, sessions: Session[]): number | null {
  const before = finished(sessions).find(
    (s) => s.id !== session.id && s.started_at < session.started_at,
  );
  if (!before) return null;
  const days = (Date.parse(session.started_at) - Date.parse(before.started_at)) / DAY;
  return days >= BREAK_DAYS ? days : null;
}
