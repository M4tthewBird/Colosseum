import {
  cardioBests,
  cardioMetricValue,
  cardioProblem,
  cardioQualifies,
  cardioResults,
  cardioStandardOf,
  cardioStrength,
  distanceText,
  paceText,
  parseDistance,
  sportOf,
  type CardioLike,
} from './cardio';
import type { Session } from './types';

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 7)).toISOString();
const c = (
  id: string,
  sport: CardioLike['sport'],
  day: number,
  m: number,
  s: number,
): CardioLike => ({
  id,
  sport,
  started_at: at(day),
  distance_m: m,
  duration_s: s,
});

describe('what counts', () => {
  it('counts rides from 10 km or 30 minutes, swims from 750 m or 20 minutes', () => {
    expect(cardioQualifies('ride', { distance_m: 10000, duration_s: 1500 })).toBe(true);
    expect(cardioQualifies('ride', { distance_m: 9000, duration_s: 1800 })).toBe(true);
    expect(cardioQualifies('ride', { distance_m: 9000, duration_s: 1500 })).toBe(false);
    expect(cardioQualifies('swim', { distance_m: 750, duration_s: 900 })).toBe(true);
    expect(cardioQualifies('swim', { distance_m: 500, duration_s: 1200 })).toBe(true);
    expect(cardioQualifies('swim', { distance_m: 500, duration_s: 600 })).toBe(false);
    // a run keeps its own rules
    expect(cardioQualifies('run', { distance_m: 3000, duration_s: 900 })).toBe(true);
  });

  it('refuses what nobody can do and does not reward what is not training', () => {
    expect(cardioProblem('ride', 40000, 1800)).toBe('too-fast'); // 80 km/h
    expect(cardioProblem('ride', 20000, 3 * 3600)).toBe('too-slow'); // under 10 km/h
    expect(cardioProblem('ride', 500000, 20 * 3600)).toBe('too-long');
    expect(cardioProblem('swim', 1500, 780)).toBe('too-fast'); // 0:52 per 100 m
    expect(cardioProblem('swim', 1000, 2700)).toBe('too-slow'); // 4:30 per 100 m
    expect(cardioProblem('swim', 1500, 1500)).toBeNull();
    expect(cardioQualifies('swim', { distance_m: 1000, duration_s: 2700 })).toBe(false);
  });
});

describe('bests and PRs', () => {
  it('scales a ride to 40 km and a swim to 1500 m within 5 %', () => {
    expect(cardioStandardOf('ride', { distance_m: 42000, duration_s: 4200 })).toEqual({
      id: 'ride40',
      time: 4000,
    });
    expect(cardioStandardOf('ride', { distance_m: 43000, duration_s: 4300 })).toBeNull();
    expect(cardioStandardOf('swim', { distance_m: 1500, duration_s: 1800 })?.id).toBe('swim1500');
  });

  it('gives a PR for a faster 40 km and keeps the sports apart', () => {
    const list = [
      c('a', 'ride', 1, 40000, 5400),
      c('b', 'ride', 30, 40000, 5100),
      c('s', 'swim', 30, 1500, 1800),
    ];
    const res = cardioResults(list);
    expect(res.get('a')?.pr).toBe(false);
    expect(res.get('b')?.pr).toBe(true);
    expect(res.get('b')?.baseline).toBe(false);
    expect(res.get('b')?.gain).toBeCloseTo(5400 / 5100 - 1);
    expect(res.get('s')?.pr).toBe(false);
    expect(cardioBests('ride', list).map((b) => [b.id, b.time])).toEqual([['ride40', 5100]]);
  });

  it('does not reward a jump too big to be true after a few rides', () => {
    const list = [
      c('a', 'ride', 1, 40000, 6000),
      c('b', 'ride', 2, 40000, 6000),
      c('c', 'ride', 3, 40000, 4800),
    ];
    expect(cardioResults(list).get('c')).toMatchObject({ pr: false, unusual: true });
  });
});

describe('strength laurels', () => {
  it('gives the full 5 for 35 km/h on a bike and 1:30 per 100 m in the water', () => {
    expect(cardioStrength('ride', 35)).toBe(5);
    expect(cardioStrength('ride', 26)).toBe(2);
    expect(cardioStrength('ride', 18)).toBe(0);
    expect(cardioStrength('swim', 90)).toBe(5);
    expect(cardioStrength('swim', 150)).toBe(1);
    expect(cardioStrength('swim', 200)).toBe(0);
  });

  it('takes the best speed of rides from 20 km in the last 90 days', () => {
    const list = [c('a', 'ride', 1, 30000, 3600), c('b', 'ride', 5, 12000, 1200)];
    const res = cardioResults(list);
    // 30 km/h from a; b is 36 km/h but shorter than 20 km
    expect(res.get('b')?.strength).toBe(3);
  });
});

describe('showing them', () => {
  it('writes distances and paces per sport', () => {
    expect(distanceText('swim', 1500)).toBe('1500 m');
    expect(distanceText('ride', 42195)).toBe('42.2 km');
    expect(paceText('ride', 30000, 3600)).toBe('30.0 km/h');
    expect(paceText('swim', 1500, 1680)).toBe('1:52 /100 m');
    expect(paceText('run', 5000, 1500)).toBe('5:00 /km');
    expect(parseDistance('swim', '1500')).toBe(1500);
    expect(parseDistance('ride', '42,2')).toBe(42200);
    expect(parseDistance('ride', 'x')).toBeNull();
  });

  it('knows a session’s sport', () => {
    expect(sportOf({ kind: 'ride' })).toBe('ride');
    expect(sportOf({ kind: 'lift' })).toBeNull();
    expect(sportOf({})).toBeNull();
  });
});

describe('Arena values', () => {
  it('finds my best 40 km and the km I swam', () => {
    const s = (id: string, kind: Session['kind'], m: number, t: number) =>
      ({
        id,
        kind,
        started_at: at(3),
        finished_at: at(3),
        distance_m: m,
        duration_s: t,
        sets: [],
      }) as unknown as Session;
    const sessions = [
      s('a', 'ride', 41000, 4920),
      s('b', 'swim', 1500, 1800),
      s('c', 'swim', 1000, 1300),
    ];
    expect(cardioMetricValue('ride_40k', sessions)).toBe(4800);
    expect(cardioMetricValue('swim_km', sessions)).toBe(2.5);
    expect(cardioMetricValue('swim_1500', sessions)).toBe(1800);
    expect(cardioMetricValue('ride_km', [])).toBeNull();
  });
});
