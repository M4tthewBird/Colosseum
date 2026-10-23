import { bestsByExercise, markPRs, volume } from './formulas';
import { warmupPlan } from './warmups';

describe('warmupPlan', () => {
  it('ramps up to a heavy working weight', () => {
    expect(warmupPlan(100)).toEqual([
      { weight_kg: 50, reps: 8 },
      { weight_kg: 70, reps: 5 },
      { weight_kg: 85, reps: 2 },
    ]);
  });

  it('rounds to 2.5 kg', () => {
    expect(warmupPlan(97.5).map((s) => s.weight_kg)).toEqual([50, 67.5, 82.5]);
  });

  it('uses fewer sets for lighter weights', () => {
    expect(warmupPlan(60)).toEqual([
      { weight_kg: 30, reps: 8 },
      { weight_kg: 45, reps: 4 },
    ]);
    expect(warmupPlan(30)).toEqual([{ weight_kg: 15, reps: 10 }]);
  });

  it('suggests nothing for light or bodyweight work', () => {
    expect(warmupPlan(15)).toEqual([]);
    expect(warmupPlan(0)).toEqual([]);
  });
});

describe('warm-ups in the numbers', () => {
  const warm = { exercise_id: 'b', weight_kg: 60, reps: 8, done: true, warmup: true };
  const work = { exercise_id: 'b', weight_kg: 100, reps: 5, done: true };

  it('do not count to volume', () => {
    expect(volume([warm, work])).toBe(500);
  });

  it('are never PRs and do not set bests', () => {
    expect(markPRs([{ ...warm, weight_kg: 200 }], { b: { weight: 100, e1rm: 110 } })).toEqual([
      false,
    ]);
    expect(bestsByExercise([{ ...warm, weight_kg: 200 }, work]).b.weight).toBe(100);
  });
});
