/** Date helpers. A week runs Monday 00:00 to Sunday 23:59 in the device's local time zone. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), 1 - isoWeekday(d));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Local calendar date as YYYY-MM-DD. */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD as a local date (not UTC). */
export function fromLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whole weeks between the Monday of `from` and the Monday of `to`. */
export function weeksBetween(from: Date, to: Date): number {
  return Math.round((startOfWeek(to).getTime() - startOfWeek(from).getTime()) / (7 * DAY_MS));
}

export function isInWeek(d: Date, weekStart: Date): boolean {
  const t = d.getTime();
  return t >= weekStart.getTime() && t < addDays(weekStart, 7).getTime();
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
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function monthName(month: number): string {
  return MONTHS[month];
}

/** 1 = Monday */
export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1];
}

export function weekdayShort(weekday: number): string {
  return WEEKDAYS[weekday - 1].slice(0, 3);
}

export function weekdayLetter(weekday: number): string {
  return WEEKDAYS[weekday - 1][0];
}

/** "12 Sep" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "2 h ago", "Yesterday", "12 Sep" */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (sameDay(d, now)) return `${Math.floor(s / 3600)} h ago`;
  if (sameDay(d, addDays(now, -1))) return 'Yesterday';
  if (s < 7 * 86400) return weekdayName(isoWeekday(d));
  return shortDate(d);
}

/** "58 min", "1 h 02 min" */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** "12:48" or "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
