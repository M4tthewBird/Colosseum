/** When a workout left running ends by itself. Pure — see workoutLimits.test.ts. */

const HOUR = 3600000;
/** No change to any set or note for this long: nobody is logging any more. */
export const IDLE_HOURS = 3;
/** The longest a workout can be. Far past a real session, and past the Marathon badge's top tier. */
export const MAX_HOURS = 6;

interface Running {
  started_at: string;
  updated_at: string;
  sets: { updated_at: string }[];
}

const time = (iso: string) => new Date(iso).getTime() || 0;

/** The last time the user changed anything in the workout. */
export function lastActivity(s: Running): number {
  return Math.max(time(s.started_at), time(s.updated_at), ...s.sets.map((x) => time(x.updated_at)));
}

/**
 * When a workout that was left running ended: its last activity, so the duration stays true and
 * a forgotten workout does not read 350 hours. Null while it is still fine.
 */
export function staleWorkoutEnd(s: Running, now: number = Date.now()): string | null {
  const start = time(s.started_at);
  const last = lastActivity(s);
  const limit = start + MAX_HOURS * HOUR;
  if (now - last < IDLE_HOURS * HOUR && now < limit) return null;
  return new Date(Math.min(last, limit)).toISOString();
}

/** A finished workout's length in minutes; nonsense (longer than any real one) counts as 0. */
export function realMinutes(s: { started_at: string; finished_at: string | null }): number {
  if (!s.finished_at) return 0;
  const ms = time(s.finished_at) - time(s.started_at);
  return ms > MAX_HOURS * HOUR ? 0 : ms / 60000;
}
