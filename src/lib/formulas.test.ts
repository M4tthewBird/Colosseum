import {
  bestsByExercise,
  dots,
  e1rm,
  estimateMinutes,
  formatKg,
  formatScheme,
  formatVolume,
  markPRs,
  parseNumber,
  prCount,
  prKinds,
  prLabel,
  volume,
  weekStreak,
} from './formulas';

describe('e1rm', () => {
  it('is the weight for a single', () => expect(e1rm(100, 1)).toBe(100));
  it('uses Epley', () => expect(e1rm(100, 5)).toBeCloseTo(116.67, 2));
  it('is 0 for 0 reps', () => expect(e1rm(100, 0)).toBe(0));
});

describe('volume', () => {
  it('sums completed sets only', () => {
    expect(
      volume([
        { weight_kg: 100, reps: 5, done: true },
        { weight_kg: 100, reps: 5, done: false },
        { weight_kg: 60, reps: 10, done: true },
      ]),
    ).toBe(1100);
  });
  it('formats tonnes from 1000 kg', () => {
    expect(formatVolume(999)).toBe('999 kg');
    expect(formatVolume(18400)).toBe('18.4 t');
  });
});

describe('formatting', () => {
  it('formats kg', () => {
    expect(formatKg(97.5)).toBe('97.5');
    expect(formatKg(100)).toBe('100');
  });
  it('formats schemes', () => {
    expect(formatScheme(4, 6, 8)).toBe('4 × 6–8');
    expect(formatScheme(3, 8, 8)).toBe('3 × 8');
  });
  it('parses decimal commas', () => {
    expect(parseNumber('97,5')).toBe(97.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('estimates duration', () => {
    // 4 sets × (45 + 120) s = 660 s = 11 min
    expect(estimateMinutes([{ sets: 4, rest_seconds: 120 }])).toBe(11);
  });
});

describe('PR detection', () => {
  const s = (exercise_id: string, weight_kg: number, reps: number, done = true) => ({
    exercise_id,
    weight_kg,
    reps,
    done,
  });

  it('needs history: the first time is not a PR', () => {
    expect(markPRs([s('bench', 100, 5)], {})).toEqual([false]);
  });

  it('flags a heavier weight', () => {
    expect(markPRs([s('bench', 102.5, 1)], { bench: { weight: 100, e1rm: 116 } })).toEqual([true]);
  });

  it('flags a better e1RM at a lower weight', () => {
    // 95 × 10 → 126.7 e1RM beats 116
    expect(markPRs([s('bench', 95, 10)], { bench: { weight: 100, e1rm: 116 } })).toEqual([true]);
  });

  it('ignores undone sets and ties', () => {
    const h = { bench: { weight: 100, e1rm: 100 } };
    expect(markPRs([s('bench', 110, 1, false), s('bench', 100, 1)], h)).toEqual([false, false]);
  });

  it('compares with earlier sets in the same session', () => {
    const h = { bench: { weight: 100, e1rm: 100 } };
    expect(markPRs([s('bench', 105, 1), s('bench', 105, 1), s('bench', 107.5, 1)], h)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('computes bests', () => {
    const b = bestsByExercise([s('a', 100, 1), s('a', 90, 10), s('a', 200, 1, false)]);
    expect(b.a.weight).toBe(100);
    expect(b.a.e1rm).toBeCloseTo(120);
  });

  it('counts PR exercises, not PR sets', () => {
    expect(
      prCount([
        { exercise_id: 'a', is_pr: true },
        { exercise_id: 'a', is_pr: true },
        { exercise_id: 'b', is_pr: true },
        { exercise_id: 'c', is_pr: false },
      ]),
    ).toBe(2);
  });
});

describe('weekStreak', () => {
  // Wednesday 1 Oct 2025
  const now = new Date(2025, 9, 1, 12);
  const d = (m: number, day: number) => new Date(2025, m, day, 18);

  it('counts past full weeks and ignores an unfinished current week', () => {
    const dates = [d(8, 22), d(8, 24), d(8, 26), d(8, 15), d(8, 17), d(8, 19)];
    expect(weekStreak(dates, 3, now)).toBe(2);
  });

  it('includes the current week once reached', () => {
    const dates = [d(8, 29), d(8, 30), d(9, 1), d(8, 22), d(8, 24), d(8, 26)];
    expect(weekStreak(dates, 3, now)).toBe(2);
  });

  it('breaks on a missed week', () => {
    const dates = [d(8, 22), d(8, 24), d(8, 26), d(8, 8), d(8, 10), d(8, 12)];
    expect(weekStreak(dates, 3, now)).toBe(1);
  });
});

describe('DOTS', () => {
  it('uses the OpenPowerlifting coefficients', () => {
    expect(dots(600, 90, 'male')!).toBeCloseTo(387.96, 1);
    expect(dots(350, 60, 'female')!).toBeCloseTo(387.99, 1);
  });
  it('clamps bodyweight', () => {
    expect(dots(100, 250, 'male')).toBeCloseTo(dots(100, 210, 'male')!, 6);
    expect(dots(100, 30, 'female')).toBeCloseTo(dots(100, 40, 'female')!, 6);
  });
  it('rewards the lighter lifter for the same lift', () => {
    expect(dots(150, 70, 'male')!).toBeGreaterThan(dots(150, 130, 'male')!);
  });
  it('needs bodyweight and sex', () => {
    expect(dots(100, null, 'male')).toBeNull();
    expect(dots(100, 80, null)).toBeNull();
  });
});

describe('PR kinds', () => {
  const best = { weight: 100, e1rm: 116.7 }; // 100 × 5
  it('tells a weight PR from a 1RM PR', () => {
    expect(prKinds(102.5, 1, best)).toEqual({ weight: true, e1rm: false });
    expect(prKinds(100, 7, best)).toEqual({ weight: false, e1rm: true });
    expect(prKinds(105, 5, best)).toEqual({ weight: true, e1rm: true });
    expect(prKinds(90, 5, best)).toEqual({ weight: false, e1rm: false });
  });
  it('needs history', () => {
    expect(prKinds(200, 1, undefined)).toEqual({ weight: false, e1rm: false });
  });
  it('labels them', () => {
    expect(prLabel(100, 7, { weight: false, e1rm: true })).toBe('1RM PR · ≈ 123.5 kg');
  });
});
