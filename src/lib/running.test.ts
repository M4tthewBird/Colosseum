import { computeGame, qualifies, type GameInput } from './game/engine';
import { LAURELS, XP } from './game/config';
import { styleMatches } from './game/styles';
import {
  formatKm,
  formatPace,
  formatRunTime,
  paceOf,
  parseKm,
  parseRunTime,
  runBests,
  runProblem,
  runQualifies,
  runResults,
  runStrength,
  standardOf,
  vdot,
  type RunLike,
} from './running';
import type { Session } from './types';

let n = 0;
const run = (start: string, km: number, minutes: number): Session => ({
  id: `r${n++}`,
  user_id: 'u',
  program_day_id: null,
  name: 'Run',
  kind: 'run',
  distance_m: Math.round(km * 1000),
  duration_s: Math.round(minutes * 60),
  run_place: 'outdoor',
  started_at: new Date(start).toISOString(),
  finished_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
  volume_kg: 0,
  set_count: 0,
  pr_count: 0,
  updated_at: '',
  sets: [],
});
const like = (s: Session): RunLike => ({
  id: s.id,
  started_at: s.started_at,
  distance_m: s.distance_m!,
  duration_s: s.duration_s!,
});

const base = (sessions: Session[], extra: Partial<GameInput> = {}): GameInput => ({
  sessions,
  exerciseName: () => undefined,
  experience: 'beginner',
  weeklyTarget: 3,
  dotsCoefficient: null,
  verification: () => null,
  now: new Date('2026-11-20T12:00:00'),
  ...extra,
});

describe('formatting and parsing', () => {
  it('formats pace, distance and time', () => {
    expect(formatPace(paceOf(5000, 26 * 60))).toBe('5:12 /km');
    expect(formatKm(5000)).toBe('5 km');
    expect(formatKm(21097)).toBe('21.1 km');
    expect(formatKm(5230)).toBe('5.23 km');
    expect(formatRunTime(1445)).toBe('24:05');
    expect(formatRunTime(3725)).toBe('1:02:05');
  });
  it('reads times typed in several ways', () => {
    expect(parseRunTime('24:05')).toBe(1445);
    expect(parseRunTime('1:02:05')).toBe(3725);
    expect(parseRunTime('24')).toBe(1440);
    expect(parseRunTime('24,5')).toBe(1470);
    expect(parseRunTime('24:75')).toBeNull();
    expect(parseRunTime('abc')).toBeNull();
    expect(parseRunTime('0:00')).toBeNull();
  });
  it('reads kilometres with a dot or a comma', () => {
    expect(parseKm('5.2')).toBe(5200);
    expect(parseKm('10,05')).toBe(10050);
    expect(parseKm('0')).toBeNull();
    expect(parseKm('5 km')).toBeNull();
  });
});

describe('what counts', () => {
  it('needs 3 km or 20 minutes', () => {
    expect(runQualifies({ distance_m: 3000, duration_s: 15 * 60 })).toBe(true);
    expect(runQualifies({ distance_m: 2500, duration_s: 20 * 60 })).toBe(true);
    expect(runQualifies({ distance_m: 2500, duration_s: 15 * 60 })).toBe(false);
  });
  it('refuses walking and world-record paces', () => {
    expect(runProblem(3000, 40 * 60)).toBe('too-slow');
    expect(runQualifies({ distance_m: 3000, duration_s: 40 * 60 })).toBe(false);
    // 5 km in 12:00 is faster than the world record (12:35).
    expect(runProblem(5000, 12 * 60)).toBe('too-fast');
    expect(runProblem(5000, 13 * 60)).toBeNull();
    expect(runProblem(120000, 20 * 3600)).toBe('too-long');
  });
  it('counts a run as a qualifying workout', () => {
    expect(qualifies(run('2026-11-02T08:00', 5, 28))).toBe(true);
    expect(qualifies(run('2026-11-02T08:00', 1, 6))).toBe(false);
  });
});

describe('standard distances and VDOT', () => {
  it('scales a slightly longer run to its distance', () => {
    expect(standardOf({ distance_m: 5100, duration_s: 1530 })).toEqual({ id: '5k', time: 1500 });
    expect(standardOf({ distance_m: 5300, duration_s: 1530 })).toBeNull();
    expect(standardOf({ distance_m: 4990, duration_s: 1530 })).toBeNull();
  });
  it('matches the Daniels tables', () => {
    expect(vdot(5000, 20 * 60)).toBeCloseTo(49.8, 0);
    expect(vdot(10000, 50 * 60)).toBeCloseTo(39.9, 0);
  });
  it('turns VDOT into strength laurels like DOTS', () => {
    expect(runStrength(29)).toBe(0);
    expect(runStrength(38)).toBe(2);
    expect(runStrength(50)).toBe(5);
    expect(runStrength(70)).toBe(5);
  });
});

describe('run PRs', () => {
  it('finds a PR against the best before it, not the first run', () => {
    const a = run('2026-10-01T08:00', 5, 30);
    const b = run('2026-10-29T08:00', 5, 28);
    const res = runResults([b, a].map(like));
    expect(res.get(a.id)!.pr).toBe(false);
    expect(res.get(b.id)!.pr).toBe(true);
    expect(res.get(b.id)!.gain).toBeCloseTo(30 / 28 - 1);
    expect(res.get(b.id)!.baseline).toBe(false);
  });
  it('gives no progress in the first 3 weeks on a distance', () => {
    const a = run('2026-10-01T08:00', 5, 30);
    const b = run('2026-10-08T08:00', 5, 29);
    expect(runResults([a, b].map(like)).get(b.id)!.baseline).toBe(true);
  });
  it('does not reward a jump of more than 10 %', () => {
    const a = run('2026-10-01T08:00', 5, 30);
    const b = run('2026-10-05T08:00', 5, 30);
    const c = run('2026-10-29T08:00', 5, 25);
    const res = runResults([a, b, c].map(like));
    expect(res.get(c.id)!.unusual).toBe(true);
    expect(res.get(c.id)!.pr).toBe(false);
    expect(runBests([a, b, c].map(like))['5k']!.time).toBe(30 * 60);
  });
});

describe('runs in the game', () => {
  it('earns what a workout earns, nothing per km', () => {
    const short = computeGame(base([run('2026-11-02T08:00', 5, 28)]));
    const long = computeGame(base([run('2026-11-02T08:00', 42.2, 240)]));
    expect(short.xp).toBe(XP.workout);
    expect(long.xp).toBe(XP.workout);
    expect(Object.values(short.sessions)[0].xpParts[0].label).toBe('Run');
  });
  it('shares the daily caps with lifting', () => {
    const runs = [0, 1, 2, 3].map((h) => run(`2026-11-02T0${h * 2}:00`, 5, 28));
    const g = computeGame(base(runs));
    expect(g.days['2026-11-02'].xp).toBe(XP.dailyCap);
    expect(g.days['2026-11-02'].laurels).toBeLessThanOrEqual(LAURELS.dailyCap);
  });
  it('rewards a PR with XP and progress laurels', () => {
    const a = run('2026-10-01T08:00', 5, 30);
    const b = run('2026-10-29T08:00', 5, 28);
    const g = computeGame(base([a, b]));
    const r = g.sessions[b.id];
    expect(r.prs).toBe(1);
    expect(r.xpParts.some((p) => p.label === 'New PR')).toBe(true);
    expect(r.laurelParts.find((p) => p.label === 'Progress')!.amount).toBe(7);
  });
  it('gives strength laurels from VDOT', () => {
    const g = computeGame(base([run('2026-11-02T08:00', 5, 20)]));
    expect(Object.values(g.sessions)[0].laurelParts).toContainEqual({
      label: 'Strength',
      amount: 4,
    });
  });
  it('earns the Retiarius bonus', () => {
    expect(styleMatches('retiarius', { sets: [], muscles: () => [], streak: 0, run: true })).toBe(
      true,
    );
    expect(styleMatches('murmillo', { sets: [], muscles: () => [], streak: 0, run: true })).toBe(
      false,
    );
  });
});
