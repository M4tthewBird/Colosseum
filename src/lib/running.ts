/**
 * Running: pace, what counts as a run, best times on the standard distances, VDOT and the
 * anti-cheat checks. Pure — see running.test.ts. Rules in docs/GAME.md → 11. The database
 * repeats the pace limits (supabase/updates/2026-11-15-running.sql).
 */
import { RUN } from './game/config';
import type { Session } from './types';

/** A run as the rules see it. Sessions with kind 'run' carry these fields. */
export interface RunLike {
  id: string;
  started_at: string;
  distance_m: number;
  duration_s: number;
}

export type RunDistance = '5k' | '10k' | 'half' | 'marathon';

export const RUN_DISTANCES: { id: RunDistance; meters: number; label: string }[] = [
  { id: '5k', meters: 5000, label: '5 km' },
  { id: '10k', meters: 10000, label: '10 km' },
  { id: 'half', meters: 21097.5, label: 'Half marathon' },
  { id: 'marathon', meters: 42195, label: 'Marathon' },
];

/**
 * World-record pace (seconds per km) from a distance on: nobody runs faster. A step down the
 * records (1 km, 3000 m, 5 km, 10 km, half, marathon), so it errs on the lenient side.
 */
const WR_PACE: [number, number][] = [
  [0, 131],
  [3000, 146],
  [5000, 151],
  [10000, 157],
  [21097, 163],
  [42195, 171],
];

/** Arena leaderboard metrics for running (get_leaderboard on the server). */
export const RUN_METRICS: { id: string; label: string; about: string }[] = [
  { id: 'run_5k', label: 'Best 5 km', about: 'Fastest 5 km run (5–5.25 km, time scaled to 5 km)' },
  { id: 'run_10k', label: 'Best 10 km', about: 'Fastest 10 km run (10–10.5 km, time scaled)' },
  { id: 'vdot', label: 'VDOT', about: 'Running fitness from your best run (Jack Daniels)' },
  { id: 'run_km', label: 'Km run', about: 'Kilometres run. Only shows; it earns no points' },
];

export const isRunMetric = (m: string) => RUN_METRICS.some((r) => r.id === m);
/** Boards where lower is better. */
export const isTimeMetric = (m: string) => m === 'run_5k' || m === 'run_10k';

export function isRun(s: Pick<Session, 'kind'>): boolean {
  return s.kind === 'run';
}

/** The session as a run, or null when it is not one (or misses its numbers). */
export function asRun(s: Session): RunLike | null {
  if (!isRun(s) || !s.distance_m || !s.duration_s) return null;
  return { id: s.id, started_at: s.started_at, distance_m: s.distance_m, duration_s: s.duration_s };
}

/** Seconds per km. */
export function paceOf(distanceM: number, durationS: number): number {
  return distanceM > 0 ? (durationS / distanceM) * 1000 : 0;
}

/** "5:12 /km" */
export function formatPace(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

/** "5.2 km", "10 km", "21.1 km" */
export function formatKm(distanceM: number): string {
  const km = Math.round(distanceM / 10) / 100;
  return `${km.toFixed(2).replace(/\.?0+$/, '')} km`;
}

/** "24:05", "1:02:05" */
export function formatRunTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/**
 * Reads a time typed as "24:05", "1:02:05", "24" (minutes) or "24.5" (minutes). Null when it
 * cannot be read.
 */
export function parseRunTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const min = Number(t.replace(',', '.'));
    return min > 0 ? Math.round(min * 60) : null;
  }
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (s >= 60 || (nums.length === 3 && m >= 60)) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/** Reads "5.2" or "5,2" km as meters. */
export function parseKm(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const m = Math.round(Number(t) * 1000);
  return m > 0 ? m : null;
}

/** The fastest pace anyone has run over this distance, in seconds per km. */
export function worldRecordPace(distanceM: number): number {
  let pace = WR_PACE[0][1];
  for (const [from, p] of WR_PACE) if (distanceM >= from) pace = p;
  return pace;
}

export type RunProblem = 'too-fast' | 'too-slow' | 'too-long' | null;

/** Why a run cannot be saved or cannot count. 'too-slow' still saves (a walk earns nothing). */
export function runProblem(distanceM: number, durationS: number): RunProblem {
  if (distanceM > RUN.maxDistanceM || durationS > RUN.maxDurationS) return 'too-long';
  const pace = paceOf(distanceM, durationS);
  if (pace < worldRecordPace(distanceM)) return 'too-fast';
  if (pace > RUN.maxPace) return 'too-slow';
  return null;
}

/** A run that earns anything: long enough, a running pace, humanly possible. */
export function runQualifies(r: Pick<RunLike, 'distance_m' | 'duration_s'>): boolean {
  return (
    (r.distance_m >= RUN.minDistanceM || r.duration_s >= RUN.minDurationS) &&
    runProblem(r.distance_m, r.duration_s) === null
  );
}

/** The standard distance a run counts for (d to d × 1.05 long), with its time scaled to d. */
export function standardOf(r: Pick<RunLike, 'distance_m' | 'duration_s'>): {
  id: RunDistance;
  time: number;
} | null {
  for (const d of RUN_DISTANCES)
    if (r.distance_m >= d.meters && r.distance_m <= d.meters * RUN.distanceSlack)
      return { id: d.id, time: (r.duration_s * d.meters) / r.distance_m };
  return null;
}

/**
 * VDOT (Jack Daniels): the aerobic fitness a race result shows, from distance and time alone.
 * A 20:00 5 km is about 50.
 */
export function vdot(distanceM: number, durationS: number): number {
  const t = durationS / 60;
  if (t <= 0 || distanceM <= 0) return 0;
  const v = distanceM / t;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const share = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / share;
}

export interface RunResult {
  /** The standard distance it counts for. */
  distance: RunDistance | null;
  /** Its time scaled to that distance. */
  time: number | null;
  /** Beat the best before it on that distance. */
  pr: boolean;
  /** A PR too far below the old best to reward (anti-cheat). */
  unusual: boolean;
  /** How much faster than the old best: 0.05 = 5 %. */
  gain: number;
  /** Inside the first weeks on that distance: no progress reward. */
  baseline: boolean;
  /** Best VDOT of the counted runs in the last 90 days, this one included. */
  vdot: number;
}

const DAY = 86400000;

/**
 * Each qualifying run against the ones before it: PR, gain and VDOT. Runs in any order; the
 * result is keyed by id.
 */
export function runResults(runs: RunLike[]): Map<string, RunResult> {
  const list = runs.filter(runQualifies).sort((a, b) => a.started_at.localeCompare(b.started_at));
  const best = new Map<RunDistance, { time: number; firstAt: number; runs: number }>();
  const vdots: { at: number; v: number }[] = [];
  const out = new Map<string, RunResult>();
  for (const r of list) {
    const at = new Date(r.started_at).getTime();
    const std = standardOf(r);
    let pr = false;
    let unusual = false;
    let gain = 0;
    let baseline = false;
    if (std) {
      const h = best.get(std.id);
      if (h && std.time < h.time - 1e-9) {
        gain = h.time / std.time - 1;
        if (gain > RUN.unusualGain && h.runs >= RUN.unusualMinRuns) unusual = true;
        else {
          pr = true;
          baseline = at - h.firstAt < RUN.baselineDays * DAY;
        }
      }
      best.set(std.id, {
        // An unusual jump does not lower the bar it is measured against.
        time: unusual ? h!.time : Math.min(h?.time ?? Infinity, std.time),
        firstAt: h?.firstAt ?? at,
        runs: (h?.runs ?? 0) + 1,
      });
    }
    if (!unusual) vdots.push({ at, v: vdot(r.distance_m, r.duration_s) });
    const recent = vdots.filter((x) => at - x.at <= RUN.vdotDays * DAY).map((x) => x.v);
    out.set(r.id, {
      distance: std?.id ?? null,
      time: std?.time ?? null,
      pr,
      unusual,
      gain,
      baseline,
      vdot: recent.length ? Math.max(...recent) : 0,
    });
  }
  return out;
}

/** Laurels for running strength: (VDOT − 30) ÷ 4, at most 5 (VDOT 50 like DOTS 300). */
export function runStrength(v: number): number {
  return Math.max(0, Math.min(RUN.maxStrength, Math.floor((v - RUN.vdotBase) / RUN.vdotStep)));
}

/**
 * My value on a running board from my own sessions (demo mode; the server computes the same):
 * best 5 or 10 km time in seconds, best VDOT, or km run. Null when there is none.
 */
export function runMetricValue(metric: string, sessions: Session[]): number | null {
  const runs = sessions
    .filter((s) => s.finished_at)
    .map(asRun)
    .filter((r): r is RunLike => !!r && runQualifies(r));
  if (!runs.length) return null;
  if (metric === 'run_km') return runs.reduce((sum, r) => sum + r.distance_m, 0) / 1000;
  if (metric === 'vdot')
    return Math.round(Math.max(...runs.map((r) => vdot(r.distance_m, r.duration_s))) * 10) / 10;
  const id = metric === 'run_5k' ? '5k' : metric === 'run_10k' ? '10k' : null;
  const times = runs
    .map(standardOf)
    .filter((x) => x && x.id === id)
    .map((x) => x!.time);
  return times.length ? Math.round(Math.min(...times)) : null;
}

/** Best time per standard distance (counted runs only), with the run it came from. */
export function runBests(
  runs: RunLike[],
): Partial<Record<RunDistance, { time: number; runId: string; at: string }>> {
  const results = runResults(runs);
  const out: Partial<Record<RunDistance, { time: number; runId: string; at: string }>> = {};
  for (const r of runs) {
    const res = results.get(r.id);
    if (!res?.distance || res.time == null || res.unusual) continue;
    const cur = out[res.distance];
    if (!cur || res.time < cur.time)
      out[res.distance] = { time: res.time, runId: r.id, at: r.started_at };
  }
  return out;
}
