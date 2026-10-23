/**
 * Badges: ladders of milestones (workouts, streaks, volume, PRs, strength clubs and common gym
 * feats), each with tiers. Computed from the whole history, oldest first, so every tier knows
 * the workout it was earned in. Pure — covered by badges.test.ts.
 */
import { addDays, startOfWeek } from './dates';
import { isMain } from './dropsets';
import { formatKg, volume } from './formulas';
import type { Session } from './types';

export type BadgeIcon =
  | 'dumbbell'
  | 'flame'
  | 'weight'
  | 'trophy'
  | 'plate'
  | 'bench'
  | 'squat'
  | 'deadlift'
  | 'crown'
  | 'sunrise'
  | 'moon'
  | 'calendar'
  | 'clock'
  | 'bolt'
  | 'compass'
  | 'layers'
  | 'skull'
  | 'link'
  | 'rotate'
  | 'users';

export interface BadgeDef {
  id: string;
  name: string;
  icon: BadgeIcon;
  /** Thresholds, lowest first. */
  tiers: number[];
  /** "100 workouts", "Bench 100 kg", "1000 lb club". */
  tierTitle: (threshold: number) => string;
  /** One line: what counts. */
  about: string;
  /** How the value reads: "37 workouts", "12.4 t". */
  format: (value: number) => string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const kg = (n: number) => `${formatKg(n)} kg`;
const tonnes = (n: number) => `${n >= 100 ? Math.round(n) : Math.round(n * 10) / 10} t`;
const PLATES = ['1 plate', '2 plates', '3 plates', '4 plates', '5 plates'];

export const BADGES: BadgeDef[] = [
  {
    id: 'workouts',
    name: 'Workouts',
    icon: 'dumbbell',
    tiers: [1, 10, 25, 50, 100, 250, 500],
    tierTitle: (n) => (n === 1 ? 'First workout' : `${n} workouts`),
    about: 'Finished workouts.',
    format: (v) => plural(v, 'workout'),
  },
  {
    id: 'streak',
    name: 'Week streak',
    icon: 'flame',
    tiers: [4, 8, 12, 26, 52],
    tierTitle: (n) => (n === 52 ? 'A whole year' : `${n} weeks in a row`),
    about: 'Weeks in a row that reached your weekly target.',
    format: (v) => plural(v, 'week'),
  },
  {
    id: 'volume',
    name: 'Total volume',
    icon: 'weight',
    tiers: [10, 100, 500, 1000],
    tierTitle: (n) => `${n} t lifted`,
    about: 'Everything you lifted, added up (weight × reps).',
    format: tonnes,
  },
  {
    id: 'prs',
    name: 'Records',
    icon: 'trophy',
    tiers: [10, 50, 100, 250],
    tierTitle: (n) => `${n} PRs`,
    about: 'Personal records: heavier, or more reps than ever.',
    format: (v) => plural(v, 'PR'),
  },
  {
    id: 'plates',
    name: 'Plate club',
    icon: 'plate',
    tiers: [60, 100, 140, 180, 220],
    tierTitle: (n) => PLATES[[60, 100, 140, 180, 220].indexOf(n)] ?? kg(n),
    about: 'Heaviest set of any lift: 20 kg plates per side on a 20 kg bar.',
    format: kg,
  },
  {
    id: 'bench',
    name: 'Bench club',
    icon: 'bench',
    tiers: [60, 80, 100, 120, 140],
    tierTitle: (n) => `Bench ${n} kg`,
    about: 'Heaviest Bench Press set.',
    format: kg,
  },
  {
    id: 'squat',
    name: 'Squat club',
    icon: 'squat',
    tiers: [60, 100, 140, 180, 220],
    tierTitle: (n) => `Squat ${n} kg`,
    about: 'Heaviest Squat set.',
    format: kg,
  },
  {
    id: 'deadlift',
    name: 'Deadlift club',
    icon: 'deadlift',
    tiers: [100, 140, 180, 220, 260],
    tierTitle: (n) => `Deadlift ${n} kg`,
    about: 'Heaviest Deadlift set.',
    format: kg,
  },
  {
    id: 'total',
    name: 'Total club',
    icon: 'crown',
    tiers: [300, 455, 600, 750],
    tierTitle: (n) => (n === 455 ? '1000 lb club' : `${n} kg total`),
    about: 'Heaviest Squat + Bench Press + Deadlift together.',
    format: kg,
  },
  {
    id: 'early',
    name: 'Early bird',
    icon: 'sunrise',
    tiers: [1, 10, 50],
    tierTitle: (n) => (n === 1 ? 'Early bird' : `${n} early workouts`),
    about: 'Workouts started before 7 am.',
    format: (v) => plural(v, 'workout'),
  },
  {
    id: 'night',
    name: 'Night owl',
    icon: 'moon',
    tiers: [1, 10, 50],
    tierTitle: (n) => (n === 1 ? 'Night owl' : `${n} late workouts`),
    about: 'Workouts started after 9 pm.',
    format: (v) => plural(v, 'workout'),
  },
  {
    id: 'weekend',
    name: 'Weekend warrior',
    icon: 'calendar',
    tiers: [10, 50, 100],
    tierTitle: (n) => `${n} weekend workouts`,
    about: 'Workouts on a Saturday or Sunday.',
    format: (v) => plural(v, 'workout'),
  },
  {
    id: 'marathon',
    name: 'Marathon',
    icon: 'clock',
    tiers: [90, 120, 180],
    tierTitle: (n) => `${n >= 120 ? `${n / 60} h` : `${n} min`} workout`,
    about: 'Your longest workout.',
    format: (v) => `${Math.round(v)} min`,
  },
  {
    id: 'bigday',
    name: 'Big day',
    icon: 'bolt',
    tiers: [5, 10, 20],
    tierTitle: (n) => `${n} t in one workout`,
    about: 'Most volume in a single workout.',
    format: tonnes,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    icon: 'compass',
    tiers: [10, 25, 50, 100],
    tierTitle: (n) => `${n} exercises`,
    about: 'Different exercises you have logged.',
    format: (v) => plural(v, 'exercise'),
  },
  {
    id: 'drops',
    name: 'Drop sets',
    icon: 'layers',
    tiers: [10, 50, 100],
    tierTitle: (n) => `${n} drop sets`,
    about: 'Drop sets done.',
    format: (v) => plural(v, 'drop set'),
  },
  {
    id: 'failure',
    name: 'To failure',
    icon: 'skull',
    tiers: [10, 50, 100],
    tierTitle: (n) => `${n} sets to failure`,
    about: 'Sets taken to failure.',
    format: (v) => plural(v, 'set'),
  },
  {
    id: 'supersets',
    name: 'Supersets',
    icon: 'link',
    tiers: [10, 50, 100],
    tierTitle: (n) => `${n} supersets`,
    about: 'Supersets done (counted per workout).',
    format: (v) => plural(v, 'superset'),
  },
  {
    id: 'comeback',
    name: 'Comeback',
    icon: 'rotate',
    tiers: [1, 5],
    tierTitle: (n) => (n === 1 ? 'Comeback' : `${n} comebacks`),
    about: 'Back in the gym after three weeks or more off.',
    format: (v) => plural(v, 'comeback'),
  },
  {
    id: 'friends',
    name: 'Squad',
    icon: 'users',
    tiers: [1, 5, 10],
    tierTitle: (n) => (n === 1 ? 'First friend' : `${n} friends`),
    about: 'Friends in Colosseum.',
    format: (v) => plural(v, 'friend'),
  },
];

export interface EarnedTier {
  threshold: number;
  /** When it was reached: the workout's start, or null when not tied to one (friends). */
  at: string | null;
  sessionId: string | null;
}

export interface BadgeStatus {
  def: BadgeDef;
  value: number;
  /** Tiers reached, lowest first. */
  earned: EarnedTier[];
  /** The next threshold, or null when every tier is reached. */
  next: number | null;
}

/** Visual level 1–5 for the n-th tier (0-based) of a ladder with `count` tiers. */
export function badgeLevel(tierIndex: number, count: number): number {
  if (count <= 1) return 5;
  return Math.round(1 + (4 * tierIndex) / (count - 1));
}

/** Longest run of weeks reaching `target` workouts, and when the run reached each length. */
function streakRuns(
  sessions: Session[],
  target: number,
): { at: string; id: string; len: number }[] {
  const byWeek = new Map<number, Session[]>();
  for (const s of sessions) {
    const k = startOfWeek(new Date(s.started_at)).getTime();
    byWeek.set(k, [...(byWeek.get(k) ?? []), s]);
  }
  const out: { at: string; id: string; len: number }[] = [];
  let len = 0;
  let prev: number | null = null;
  for (const k of [...byWeek.keys()].sort((a, b) => a - b)) {
    const list = byWeek.get(k)!;
    if (list.length < Math.max(1, target)) {
      len = 0;
      prev = k;
      continue;
    }
    const consecutive = prev != null && addDays(new Date(prev), 7).getTime() === k && len > 0;
    len = consecutive ? len + 1 : 1;
    prev = k;
    // Reached when the target-th workout of the week was done.
    const s = list[Math.max(1, target) - 1];
    out.push({ at: s.started_at, id: s.id, len });
  }
  return out;
}

const minutes = (s: Session) =>
  s.finished_at
    ? (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000
    : 0;

const LIFTS: Record<string, 'bench' | 'squat' | 'deadlift'> = {
  'bench press': 'bench',
  squat: 'squat',
  deadlift: 'deadlift',
};

/**
 * Every badge with its value and the tiers reached. `sessions` in any order (only finished
 * ones count); `nameOf` gives an exercise's name; `weeklyTarget` is the streak target.
 */
export function computeBadges(
  sessions: Session[],
  nameOf: (exerciseId: string) => string | undefined,
  options: { weeklyTarget?: number; friends?: number } = {},
): BadgeStatus[] {
  const done = sessions
    .filter((s) => s.finished_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const values: Record<string, number> = {};
  const earned: Record<string, EarnedTier[]> = {};
  const defs = new Map(BADGES.map((b) => [b.id, b]));

  const reach = (id: string, value: number, s: Session | null) => {
    const def = defs.get(id)!;
    values[id] = value;
    const got = (earned[id] ??= []);
    for (const t of def.tiers) {
      if (value >= t && !got.some((g) => g.threshold === t))
        got.push({ threshold: t, at: s?.started_at ?? null, sessionId: s?.id ?? null });
    }
  };

  let workouts = 0;
  let tonnes = 0;
  let prs = 0;
  let heaviest = 0;
  const lift = { bench: 0, squat: 0, deadlift: 0 };
  let early = 0;
  let night = 0;
  let weekend = 0;
  let longest = 0;
  let bigDay = 0;
  const seen = new Set<string>();
  let drops = 0;
  let failures = 0;
  let supersets = 0;
  let comebacks = 0;
  let last: Session | null = null;

  for (const s of done) {
    const work = s.sets.filter((x) => x.done && !x.warmup);
    const start = new Date(s.started_at);
    workouts++;
    const v = volume(s.sets) / 1000;
    tonnes += v;
    prs += s.pr_count;
    for (const x of work) {
      if (x.reps > 0) heaviest = Math.max(heaviest, x.weight_kg);
      seen.add(x.exercise_id);
      const which = LIFTS[(nameOf(x.exercise_id) ?? '').toLowerCase()];
      if (which && x.reps > 0) lift[which] = Math.max(lift[which], x.weight_kg);
    }
    if (start.getHours() < 7) early++;
    if (start.getHours() >= 21) night++;
    if (start.getDay() === 0 || start.getDay() === 6) weekend++;
    longest = Math.max(longest, minutes(s));
    bigDay = Math.max(bigDay, v);
    drops += work.filter((x) => !isMain(x)).length;
    failures += work.filter((x) => x.failure).length;
    supersets += new Set(work.map((x) => x.superset_id).filter(Boolean)).size;
    if (last && start.getTime() - new Date(last.started_at).getTime() >= 21 * 86400000) comebacks++;
    last = s;

    reach('workouts', workouts, s);
    reach('volume', tonnes, s);
    reach('prs', prs, s);
    reach('plates', heaviest, s);
    reach('bench', lift.bench, s);
    reach('squat', lift.squat, s);
    reach('deadlift', lift.deadlift, s);
    reach(
      'total',
      lift.bench && lift.squat && lift.deadlift ? lift.bench + lift.squat + lift.deadlift : 0,
      s,
    );
    reach('early', early, s);
    reach('night', night, s);
    reach('weekend', weekend, s);
    reach('marathon', longest, s);
    reach('bigday', bigDay, s);
    reach('explorer', seen.size, s);
    reach('drops', drops, s);
    reach('failure', failures, s);
    reach('supersets', supersets, s);
    reach('comeback', comebacks, s);
  }

  let best = 0;
  for (const run of streakRuns(done, options.weeklyTarget ?? 3)) {
    best = Math.max(best, run.len);
    const s = done.find((x) => x.id === run.id) ?? null;
    reach('streak', best, s);
  }
  reach('friends', options.friends ?? 0, null);

  return BADGES.map((def) => {
    const value = values[def.id] ?? 0;
    const got = earned[def.id] ?? [];
    return { def, value, earned: got, next: def.tiers.find((t) => value < t) ?? null };
  });
}

/** Tiers reached in one workout (for its summary), highest per badge. */
export function badgesFrom(
  statuses: BadgeStatus[],
  sessionId: string,
): { def: BadgeDef; tier: EarnedTier; index: number }[] {
  const out: { def: BadgeDef; tier: EarnedTier; index: number }[] = [];
  for (const b of statuses) {
    const mine = b.earned.filter((e) => e.sessionId === sessionId);
    const top = mine[mine.length - 1];
    if (top) out.push({ def: b.def, tier: top, index: b.def.tiers.indexOf(top.threshold) });
  }
  return out;
}
