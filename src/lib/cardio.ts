/**
 * Cardio: running, cycling and swimming (docs/GAME.md §11). Each is a session with distance and
 * time and no sets, worth one workout. Running keeps its own module (running.ts: VDOT and the
 * record paces); rides and swims follow the same rules with the numbers in RIDE and SWIM
 * (config.ts). Pure — see cardio.test.ts.
 */
import { RIDE, SWIM } from './game/config';
import {
  formatKm,
  formatPace,
  formatRunTime,
  RUN_DISTANCES,
  RUN_METRICS,
  runMetricValue,
  runProblem,
  runQualifies,
  runResults,
  runStrength,
  type RunLike,
  type RunProblem,
} from './running';
import type { RunPlace, Session } from './types';

export type Sport = 'run' | 'ride' | 'swim';
export const SPORTS: Sport[] = ['run', 'ride', 'swim'];

export type CardioPlace = RunPlace;

export interface SportInfo {
  id: Sport;
  /** "Run", "Ride", "Swim": a session's name and the XP line. */
  name: string;
  /** "Running", "Cycling", "Swimming". */
  title: string;
  /** "a run" */
  noun: string;
  places: { id: CardioPlace; label: string }[];
  /** Distance typed in km, or (swims) in metres. */
  unit: 'km' | 'm';
  /** What a session needs to earn anything. */
  minText: string;
}

export const SPORT: Record<Sport, SportInfo> = {
  run: {
    id: 'run',
    name: 'Run',
    title: 'Running',
    noun: 'a run',
    places: [
      { id: 'outdoor', label: 'Outdoor' },
      { id: 'treadmill', label: 'Treadmill' },
    ],
    unit: 'km',
    minText: 'Runs from 3 km or 20 minutes earn XP and laurels.',
  },
  ride: {
    id: 'ride',
    name: 'Ride',
    title: 'Cycling',
    noun: 'a ride',
    places: [
      { id: 'outdoor', label: 'Outdoor' },
      { id: 'indoor', label: 'Indoor bike' },
    ],
    unit: 'km',
    minText: 'Rides from 10 km or 30 minutes earn XP and laurels.',
  },
  swim: {
    id: 'swim',
    name: 'Swim',
    title: 'Swimming',
    noun: 'a swim',
    places: [
      { id: 'pool', label: 'Pool' },
      { id: 'open', label: 'Open water' },
    ],
    unit: 'm',
    minText: 'Swims from 750 m or 20 minutes earn XP and laurels.',
  },
};

export function sportOf(s: Pick<Session, 'kind'>): Sport | null {
  return s.kind === 'run' || s.kind === 'ride' || s.kind === 'swim' ? s.kind : null;
}

export function isCardio(s: Pick<Session, 'kind'>): boolean {
  return sportOf(s) != null;
}

/** A cardio session as the rules see it. */
export interface CardioLike extends RunLike {
  sport: Sport;
}

export function asCardio(s: Session): CardioLike | null {
  const sport = sportOf(s);
  if (!sport || !s.distance_m || !s.duration_s) return null;
  return {
    id: s.id,
    sport,
    started_at: s.started_at,
    distance_m: s.distance_m,
    duration_s: s.duration_s,
  };
}

// ───────────── Rides and swims ─────────────

type OtherSport = 'ride' | 'swim';
const RULES = { ride: RIDE, swim: SWIM } as const;

export type CardioDistance = 'ride20' | 'ride40' | 'swim400' | 'swim1500';

export const CARDIO_DISTANCES: Record<
  OtherSport,
  { id: CardioDistance; meters: number; label: string }[]
> = {
  ride: [
    { id: 'ride20', meters: 20000, label: '20 km' },
    { id: 'ride40', meters: 40000, label: '40 km' },
  ],
  swim: [
    { id: 'swim400', meters: 400, label: '400 m' },
    { id: 'swim1500', meters: 1500, label: '1500 m' },
  ],
};

/** Seconds per km. */
const paceOf = (distanceM: number, durationS: number) =>
  distanceM > 0 ? (durationS / distanceM) * 1000 : 0;

/** The fastest pace possible over this distance (seconds per km). */
export function fastestPace(sport: OtherSport, distanceM: number): number {
  let pace = RULES[sport].fastest[0][1];
  for (const [from, p] of RULES[sport].fastest) if (distanceM >= from) pace = p;
  return pace;
}

/** Why a session cannot be saved or cannot count. 'too-slow' still saves but earns nothing. */
export function cardioProblem(sport: Sport, distanceM: number, durationS: number): RunProblem {
  if (sport === 'run') return runProblem(distanceM, durationS);
  const r = RULES[sport];
  if (distanceM > r.maxDistanceM || durationS > r.maxDurationS) return 'too-long';
  const pace = paceOf(distanceM, durationS);
  if (pace < fastestPace(sport, distanceM)) return 'too-fast';
  if (pace > r.slowest) return 'too-slow';
  return null;
}

/** A run, ride or swim that earns anything: long enough, fast enough, humanly possible. */
export function cardioQualifies(
  sport: Sport,
  c: Pick<RunLike, 'distance_m' | 'duration_s'>,
): boolean {
  if (sport === 'run') return runQualifies(c);
  const r = RULES[sport];
  return (
    (c.distance_m >= r.minDistanceM || c.duration_s >= r.minDurationS) &&
    cardioProblem(sport, c.distance_m, c.duration_s) === null
  );
}

/** The best distance a ride or swim counts for (d to d × 1.05 long), its time scaled to d. */
export function cardioStandardOf(
  sport: OtherSport,
  c: Pick<RunLike, 'distance_m' | 'duration_s'>,
): { id: CardioDistance; time: number } | null {
  for (const d of CARDIO_DISTANCES[sport])
    if (c.distance_m >= d.meters && c.distance_m <= d.meters * RULES[sport].distanceSlack)
      return { id: d.id, time: (c.duration_s * d.meters) / c.distance_m };
  return null;
}

/** Average speed in km/h. */
export const speedKmh = (distanceM: number, durationS: number) =>
  durationS > 0 ? distanceM / 1000 / (durationS / 3600) : 0;

/** Seconds per 100 m. */
export const swimPace = (distanceM: number, durationS: number) =>
  distanceM > 0 ? (durationS / distanceM) * 100 : 0;

/**
 * Strength laurels for a ride (from the best average speed) or a swim (from the best pace per
 * 100 m): 35 km/h or 1:30 per 100 m give the full 5, like DOTS 300 and VDOT 50.
 */
export function cardioStrength(sport: OtherSport, best: number): number {
  const r = RULES[sport];
  const raw =
    sport === 'ride'
      ? (best - r.strengthBase) / r.strengthStep
      : (r.strengthBase - best) / r.strengthStep;
  return Math.max(0, Math.min(r.maxStrength, Math.floor(raw)));
}

/** The session's own figure for strength: km/h (rides) or seconds per 100 m (swims). */
function strengthFigure(sport: OtherSport, c: RunLike): number | null {
  if (c.distance_m < RULES[sport].strengthMinM) return null;
  return sport === 'ride'
    ? speedKmh(c.distance_m, c.duration_s)
    : swimPace(c.distance_m, c.duration_s);
}

export interface CardioResult {
  sport: Sport;
  /** The best distance it counts for. */
  distance: string | null;
  /** Its time scaled to that distance. */
  time: number | null;
  pr: boolean;
  /** A PR too far below the old best to reward (anti-cheat). */
  unusual: boolean;
  /** How much faster than the old best: 0.05 = 5 %. */
  gain: number;
  /** Inside the first weeks on that distance: no progress reward. */
  baseline: boolean;
  /** Strength laurels it can earn (VDOT for runs, speed for rides, pace for swims). */
  strength: number;
}

const DAY = 86400000;

/** Each qualifying ride or swim against the ones before it. */
function otherResults(sport: OtherSport, list: RunLike[]): Map<string, CardioResult> {
  const r = RULES[sport];
  const sorted = list
    .filter((c) => cardioQualifies(sport, c))
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const best = new Map<CardioDistance, { time: number; firstAt: number; count: number }>();
  const figures: { at: number; v: number }[] = [];
  const out = new Map<string, CardioResult>();
  for (const c of sorted) {
    const at = new Date(c.started_at).getTime();
    const std = cardioStandardOf(sport, c);
    let pr = false;
    let unusual = false;
    let gain = 0;
    let baseline = false;
    if (std) {
      const h = best.get(std.id);
      if (h && std.time < h.time - 1e-9) {
        gain = h.time / std.time - 1;
        if (gain > r.unusualGain && h.count >= r.unusualMinRuns) unusual = true;
        else {
          pr = true;
          baseline = at - h.firstAt < r.baselineDays * DAY;
        }
      }
      best.set(std.id, {
        time: unusual ? h!.time : Math.min(h?.time ?? Infinity, std.time),
        firstAt: h?.firstAt ?? at,
        count: (h?.count ?? 0) + 1,
      });
    }
    const fig = unusual ? null : strengthFigure(sport, c);
    if (fig != null) figures.push({ at, v: fig });
    const recent = figures.filter((x) => at - x.at <= r.strengthDays * DAY).map((x) => x.v);
    const top = recent.length
      ? sport === 'ride'
        ? Math.max(...recent)
        : Math.min(...recent)
      : null;
    out.set(c.id, {
      sport,
      distance: std?.id ?? null,
      time: std?.time ?? null,
      pr,
      unusual,
      gain,
      baseline,
      strength: top == null ? 0 : cardioStrength(sport, top),
    });
  }
  return out;
}

/** Every qualifying run, ride and swim against the earlier ones of its sport, keyed by id. */
export function cardioResults(list: CardioLike[]): Map<string, CardioResult> {
  const out = new Map<string, CardioResult>();
  for (const [id, r] of runResults(list.filter((c) => c.sport === 'run')))
    out.set(id, { ...r, sport: 'run', strength: runStrength(r.vdot) });
  for (const sport of ['ride', 'swim'] as const)
    for (const [id, r] of otherResults(
      sport,
      list.filter((c) => c.sport === sport),
    ))
      out.set(id, r);
  return out;
}

/** Best time per distance of a sport (counted sessions only), with the session it came from. */
export function cardioBests(
  sport: Sport,
  list: CardioLike[],
): { id: string; label: string; time: number; sessionId: string; at: string }[] {
  const results = cardioResults(list.filter((c) => c.sport === sport));
  const best = new Map<string, { time: number; sessionId: string; at: string }>();
  for (const c of list) {
    const res = results.get(c.id);
    if (!res?.distance || res.time == null || res.unusual) continue;
    const cur = best.get(res.distance);
    if (!cur || res.time < cur.time)
      best.set(res.distance, { time: res.time, sessionId: c.id, at: c.started_at });
  }
  const distances = sport === 'run' ? RUN_DISTANCES : CARDIO_DISTANCES[sport];
  return distances.flatMap((d) => {
    const b = best.get(d.id);
    return b ? [{ id: d.id, label: d.label, ...b }] : [];
  });
}

/** The distances a sport has bests for. */
export function sportDistances(sport: Sport): { id: string; label: string; meters: number }[] {
  return sport === 'run' ? RUN_DISTANCES : CARDIO_DISTANCES[sport];
}

// ───────────── Showing them ─────────────

/** "1500 m", "2.4 km" for swims; "5.2 km" for runs and rides. */
export function distanceText(sport: Sport, distanceM: number): string {
  if (sport === 'swim' && distanceM < 10000) return `${Math.round(distanceM)} m`;
  return formatKm(distanceM);
}

/** "5:12 /km", "28.4 km/h", "1:52 /100 m". */
export function paceText(sport: Sport, distanceM: number, durationS: number): string {
  if (sport === 'ride') return `${speedKmh(distanceM, durationS).toFixed(1)} km/h`;
  if (sport === 'swim') {
    const s = Math.round(swimPace(distanceM, durationS));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /100 m`;
  }
  return formatPace(paceOf(distanceM, durationS));
}

/** "Average pace" or "Average speed". */
export const paceLabel = (sport: Sport) => (sport === 'ride' ? 'Average speed' : 'Average pace');

/** The slowest that still counts, for the form's hint. */
export function slowestText(sport: Sport): string {
  if (sport === 'ride') return '10 km/h';
  if (sport === 'swim') return '4:00 /100 m';
  return formatPace(12 * 60);
}

/** Reads a distance as typed: km for runs and rides ("5.2"), metres for swims ("1500"). */
export function parseDistance(sport: Sport, text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  const m = Math.round(SPORT[sport].unit === 'm' ? n : n * 1000);
  return m > 0 ? m : null;
}

/** "1:02:05" */
export const timeText = formatRunTime;

// ───────────── Arena ─────────────

/** Arena boards for rides and swims (get_leaderboard on the server). */
export const OTHER_METRICS: { id: string; label: string; about: string }[] = [
  { id: 'ride_40k', label: 'Best 40 km ride', about: 'Fastest 40 km ride (40–42 km, time scaled)' },
  { id: 'ride_km', label: 'Km ridden', about: 'Kilometres ridden. Only shows; it earns no points' },
  {
    id: 'swim_1500',
    label: 'Best 1500 m swim',
    about: 'Fastest 1500 m swim (1500–1575 m, time scaled)',
  },
  { id: 'swim_km', label: 'Km swum', about: 'Kilometres swum. Only shows; it earns no points' },
];

/** Every cardio board: running, cycling, swimming. */
export const CARDIO_METRICS = [...RUN_METRICS, ...OTHER_METRICS];
export const isCardioMetric = (m: string) => CARDIO_METRICS.some((r) => r.id === m);
/** Boards where lower is better. */
export const isCardioTimeMetric = (m: string) =>
  m === 'run_5k' || m === 'run_10k' || m === 'ride_40k' || m === 'swim_1500';
/** Boards in kilometres. */
export const isKmMetric = (m: string) => m === 'run_km' || m === 'ride_km' || m === 'swim_km';

/** My value on a cardio board from my own sessions (demo mode; the server computes the same). */
export function cardioMetricValue(metric: string, sessions: Session[]): number | null {
  if (RUN_METRICS.some((r) => r.id === metric)) return runMetricValue(metric, sessions);
  const sport: OtherSport | null = metric.startsWith('ride_')
    ? 'ride'
    : metric.startsWith('swim_')
      ? 'swim'
      : null;
  if (!sport) return null;
  const list = sessions
    .filter((s) => s.finished_at)
    .map(asCardio)
    .filter((c): c is CardioLike => !!c && c.sport === sport && cardioQualifies(sport, c));
  if (!list.length) return null;
  if (metric.endsWith('_km'))
    return Math.round(list.reduce((sum, c) => sum + c.distance_m, 0) / 100) / 10;
  const id: CardioDistance = metric === 'ride_40k' ? 'ride40' : 'swim1500';
  const times = list
    .map((c) => cardioStandardOf(sport, c))
    .filter((x) => x && x.id === id)
    .map((x) => x!.time);
  return times.length ? Math.round(Math.min(...times)) : null;
}
