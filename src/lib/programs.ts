/** Program scheduling. Pure functions only — covered by programs.test.ts. */
import { addDays, fromLocalDate, isoWeekday, sameDay, startOfWeek, weeksBetween } from './dates';
import type { Program, ProgramDay } from './types';

export interface FinishedRef {
  program_day_id: string | null;
  started_at: string;
}

/** Weekly target: training days of the active program, or 3 when there is none. */
export function weeklyTarget(program: Program | null | undefined): number {
  if (!program) return 3;
  const n = program.training_days.length || program.days.length;
  return n > 0 ? n : 3;
}

/**
 * The next program day to train.
 * - If days have weekdays: today's day (unless already trained today), else the next weekday
 *   that has a day assigned.
 * - Otherwise: the day after the last one trained, in order.
 */
export function upNextDay(
  program: Program,
  sessions: FinishedRef[],
  now: Date = new Date(),
): ProgramDay | null {
  const days = [...program.days].sort((a, b) => a.position - b.position);
  if (days.length === 0) return null;
  const dayIds = new Set(days.map((d) => d.id));
  const mine = sessions
    .filter((s) => s.program_day_id && dayIds.has(s.program_day_id))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const scheduled = days.some((d) => d.weekdays.length > 0);
  if (scheduled) {
    const trainedToday = new Set(
      mine.filter((s) => sameDay(new Date(s.started_at), now)).map((s) => s.program_day_id),
    );
    for (let i = 0; i < 7; i++) {
      const wd = isoWeekday(addDays(now, i));
      const day = days.find((d) => d.weekdays.includes(wd) && !(i === 0 && trainedToday.has(d.id)));
      if (day) return day;
    }
  }

  const last = mine[0];
  if (!last) return days[0];
  const idx = days.findIndex((d) => d.id === last.program_day_id);
  return days[(idx + 1) % days.length];
}

/** 1-based program week, clamped to the program length. */
export function programWeek(program: Program, now: Date = new Date()): number {
  if (!program.started_on) return 1;
  const w = weeksBetween(fromLocalDate(program.started_on), now) + 1;
  return Math.min(Math.max(w, 1), program.weeks);
}

export function plannedWorkouts(program: Program): number {
  return weeklyTarget(program) * program.weeks;
}

export function completedWorkouts(program: Program, sessions: FinishedRef[]): number {
  const dayIds = new Set(program.days.map((d) => d.id));
  const since = program.started_on ? fromLocalDate(program.started_on).getTime() : 0;
  return sessions.filter(
    (s) =>
      s.program_day_id && dayIds.has(s.program_day_id) && new Date(s.started_at).getTime() >= since,
  ).length;
}

/** 2-letter label for a day name: "Push Day" → "Pu". */
export function dayAbbrev(name: string): string {
  const words = name.trim().split(/\s+/);
  const w = words[0] ?? '';
  // "Upper 1" → "U1", "Full Body A" → "FA": the numbered/lettered variants stay apart.
  const last = words[words.length - 1] ?? '';
  if (words.length > 1 && /^[a-z0-9]$/i.test(last))
    return w.slice(0, 1).toUpperCase() + last.toUpperCase();
  return w.slice(0, 1).toUpperCase() + w.slice(1, 2).toLowerCase();
}

/** Unique 2-letter labels per day: "Push" → "Pu", then "Pull" → "Pl" (first letter + next consonant). */
export function dayAbbrevs(days: { id: string; name: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const d of days) {
    let a = dayAbbrev(d.name);
    if (used.has(a)) {
      const w = d.name.trim().split(/\s+/)[0] ?? '';
      const c = w.slice(1).match(/[bcdfghjklmnpqrstvwxz]/i)?.[0];
      if (c && !used.has(w[0].toUpperCase() + c.toLowerCase()))
        a = w[0].toUpperCase() + c.toLowerCase();
    }
    used.add(a);
    out.set(d.id, a);
  }
  return out;
}

export type WeekStripState = 'done' | 'today' | 'next' | 'rest' | 'missed';

export interface WeekStripDay {
  weekday: number;
  label: string;
  state: WeekStripState;
}

/** Mon–Sun strip for the current week. */
export function weekStrip(
  program: Program,
  sessions: FinishedRef[],
  now: Date = new Date(),
): WeekStripDay[] {
  const monday = startOfWeek(now);
  const todayWd = isoWeekday(now);
  const dayIds = new Set(program.days.map((d) => d.id));
  const abbr = dayAbbrevs([...program.days].sort((a, b) => a.position - b.position));
  const out: WeekStripDay[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    const date = addDays(monday, wd - 1);
    const done = sessions.find(
      (s) =>
        s.program_day_id && dayIds.has(s.program_day_id) && sameDay(new Date(s.started_at), date),
    );
    const assigned = program.days.find((d) => d.weekdays.includes(wd));
    const isTraining = program.training_days.includes(wd) || !!assigned;
    if (done) {
      const day = program.days.find((d) => d.id === done.program_day_id);
      out.push({ weekday: wd, label: day ? (abbr.get(day.id) ?? '') : '', state: 'done' });
    } else if (!isTraining) {
      out.push({ weekday: wd, label: '', state: 'rest' });
    } else {
      const label = assigned ? (abbr.get(assigned.id) ?? '') : '';
      const state: WeekStripState = wd === todayWd ? 'today' : wd > todayWd ? 'next' : 'missed';
      out.push({ weekday: wd, label, state });
    }
  }
  return out;
}

/** "Mon · Thu" */
export function weekdaysLabel(weekdays: number[]): string {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((w) => names[w - 1])
    .join(' · ');
}
