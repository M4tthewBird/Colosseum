import { deloadAdvice, feelAverage, feelTrend, isHard, suggestNext } from './progression';
import type { Session } from './types';

const plan = { reps_min: 6, reps_max: 8 };
const s = (weight_kg: number, reps: number, failure = false) => ({ weight_kg, reps, failure });
const easy = { rpe: 7, feel: null };

describe('suggestNext', () => {
  it('adds weight after the top of the range on every set', () => {
    expect(suggestNext([s(80, 8), s(80, 8), s(80, 9)], plan, easy, 'Bench Press')).toMatchObject({
      kind: 'up',
      weight: 82.5,
      reps: 6,
    });
    expect(suggestNext([s(30, 8)], plan, easy, 'Dumbbell Bench Press')?.weight).toBe(32);
  });

  it('holds when the top was reached at failure or in a hard workout', () => {
    expect(suggestNext([s(80, 8), s(80, 8, true)], plan, easy, 'Bench')).toMatchObject({
      kind: 'hold',
      weight: 80,
    });
    expect(suggestNext([s(80, 8)], plan, { rpe: 9, feel: null }, 'Bench')?.kind).toBe('hold');
  });

  it('goes lighter after missing the range at failure', () => {
    expect(suggestNext([s(100, 6), s(100, 4, true)], plan, easy, 'Squat')).toMatchObject({
      kind: 'down',
      weight: 95,
      reps: 6,
    });
  });

  it('asks for one more rep otherwise', () => {
    expect(suggestNext([s(80, 7), s(80, 6)], plan, easy, 'Bench')).toMatchObject({
      kind: 'hold',
      weight: 80,
      reps: 7,
    });
    // Only the top weight counts.
    expect(suggestNext([s(80, 7), s(60, 3)], plan, easy, 'Bench')?.reps).toBe(8);
  });

  it('gives nothing without history or for bodyweight', () => {
    expect(suggestNext([], plan, easy, 'Bench')).toBeNull();
    expect(suggestNext([s(0, 12)], plan, easy, 'Pull Up')).toBeNull();
  });
});

describe('feel', () => {
  const feel = (v: number) => ({ energy: v, sleep: v, pump: v, joints: v });
  it('averages and judges hard workouts', () => {
    expect(feelAverage({ energy: 4, sleep: 2, pump: 5, joints: 3 })).toBe(3.5);
    expect(feelAverage(null)).toBeNull();
    expect(isHard({ rpe: 9, feel: null })).toBe(true);
    expect(isHard({ rpe: 7, feel: feel(2) })).toBe(true);
    expect(isHard({ rpe: 8, feel: feel(3) })).toBe(false);
  });

  const session = (day: number, rpe: number | null, f: number | null): Session => ({
    id: `s${day}`,
    user_id: 'u',
    program_day_id: null,
    name: 'W',
    started_at: new Date(2026, 9, day, 18).toISOString(),
    finished_at: new Date(2026, 9, day, 19).toISOString(),
    volume_kg: 0,
    set_count: 0,
    pr_count: 0,
    rpe,
    feel: f == null ? null : feel(f),
    updated_at: '',
    sets: [],
  });
  const now = new Date(2026, 9, 11, 20);

  it('suggests a deload after three hard workouts in a row', () => {
    const hard = [session(10, 9, null), session(8, null, 2), session(6, 10, 3)];
    expect(deloadAdvice(hard, now)).toEqual({ hard: 3 });
    expect(deloadAdvice([session(10, 7, 4), ...hard], now)).toBeNull();
    // Unrated workouts are skipped, old ones do not count.
    expect(deloadAdvice([session(10, null, null), ...hard], now)).toEqual({ hard: 3 });
    expect(deloadAdvice(hard, new Date(2026, 10, 20))).toBeNull();
  });

  it('builds the trend oldest first', () => {
    const t = feelTrend([session(10, 8, 4), session(9, null, null), session(8, 6, null)]);
    expect(t.map((p) => p.rpe)).toEqual([6, 8]);
    expect(t[1].feel).toBe(4);
  });
});
