/** Planning a workout with others and confirming it by QR code. Pure — see together.test.ts. */
import { addDays, isoWeekday, sameDay, weekdayName } from './dates';

const HOUR = 3600000;
/** A plan stays up this long after its time: people are still on their way or training. */
const PLAN_LIVE_HOURS = 2;
/** How long after a workout its code can be confirmed (the server checks this too). */
const CONFIRM_HOURS = 12;

export type PlanDay = 'today' | 'tomorrow';

const pad = (n: number) => String(n).padStart(2, '0');
export const clock = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`;

/** "17:30", "17.30", "1730", "7" → hours and minutes, or null. */
export function parseClock(text: string): { h: number; m: number } | null {
  const t = text.trim().replace('.', ':');
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  return h < 24 && m < 60 ? { h, m } : null;
}

/** The moment of a typed time, or null when it is not a time or already over. */
export function planDate(day: PlanDay, text: string, now: Date = new Date()): Date | null {
  const t = parseClock(text);
  if (!t) return null;
  const d = addDays(now, day === 'tomorrow' ? 1 : 0);
  d.setHours(t.h, t.m, 0, 0);
  return d.getTime() > now.getTime() ? d : null;
}

/** The form's starting point: the next half hour, at least 30 minutes away. */
export function defaultPlan(now: Date = new Date()): { day: PlanDay; time: string } {
  const halfHour = 30 * 60000;
  const d = new Date(Math.ceil((now.getTime() + halfHour) / halfHour) * halfHour);
  return { day: sameDay(d, now) ? 'today' : 'tomorrow', time: clock(d) };
}

/** "Today 17:30", "Tomorrow 7:00", "Friday 18:00". */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return `Today ${clock(d)}`;
  if (sameDay(d, addDays(now, 1))) return `Tomorrow ${clock(d)}`;
  return `${weekdayName(isoWeekday(d))} ${clock(d)}`;
}

export function planIsLive(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() >= now.getTime() - PLAN_LIVE_HOURS * HOUR;
}

interface Plan {
  planned_at: string;
  inviteeId: string | null;
  myAnswer: boolean | null;
}

/** Invites waiting for my answer first, then by time. Plans I said no to are gone. */
export function sortPlans<T extends Plan>(plans: T[], myId: string): T[] {
  const waiting = (p: T) => (p.inviteeId === myId && p.myAnswer === null ? 0 : 1);
  return plans
    .filter((p) => p.myAnswer !== false)
    .sort(
      (a, b) =>
        waiting(a) - waiting(b) ||
        new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime(),
    );
}

export function confirmOpen(finishedAt: string | null, now: Date = new Date()): boolean {
  return !!finishedAt && new Date(finishedAt).getTime() > now.getTime() - CONFIRM_HOURS * HOUR;
}

/** True when the user has a workout from the last hours, running or finished. */
export function trainedRecently(
  sessions: { started_at: string }[],
  now: Date = new Date(),
): boolean {
  const since = now.getTime() - CONFIRM_HOURS * HOUR;
  return sessions.some((s) => new Date(s.started_at).getTime() > since);
}

export type ScannedCode = { kind: 'together'; id: string } | { kind: 'friend'; username: string };

/** What a scanned QR code points to: a workout to confirm, a friend to add, or nothing of ours. */
export function readCode(text: string): ScannedCode | null {
  const together = /\/together\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(text);
  if (together) return { kind: 'together', id: together[1].toLowerCase() };
  const friend = /\/add\/([^/?#]+)/.exec(text);
  if (friend) return { kind: 'friend', username: decodeURIComponent(friend[1]) };
  return null;
}

/** "Tomáš Král is in", "Tomáš Král and Adam Novák are in", "… and 2 more are in"; "" for nobody. */
export function goingText(names: string[], suffix = true): string {
  if (names.length === 0) return '';
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} more`;
  if (!suffix) return who;
  return `${who} ${names.length === 1 && names[0] !== 'You' ? 'is' : 'are'} in`;
}
