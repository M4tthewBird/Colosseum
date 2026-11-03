import { biggestDrop, funnelSteps, pct, type AdminStats } from './adminStats';

const funnel = (f: Partial<AdminStats['funnel']>): AdminStats['funnel'] => ({
  since: '2026-11-03',
  signed_up: 0,
  tour_done: 0,
  first_workout: 0,
  week2_eligible: 0,
  week2: 0,
  ...f,
});

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(31, 50)).toBe('62 %');
    expect(pct(1, 3)).toBe('33 %');
  });
  it('says nothing when there is nobody to count', () => {
    expect(pct(0, 0)).toBe('–');
  });
});

describe('funnelSteps', () => {
  it('counts each step against sign-ups, week 2 against those old enough', () => {
    const steps = funnelSteps(
      funnel({ signed_up: 40, tour_done: 30, first_workout: 20, week2_eligible: 10, week2: 4 }),
    );
    expect(steps.map((s) => [s.count, s.of])).toEqual([
      [40, 40],
      [30, 40],
      [20, 40],
      [4, 10],
    ]);
    expect(steps.map((s) => s.share)).toEqual([1, 0.75, 0.5, 0.4]);
  });

  it('is all zero before anyone signs up', () => {
    expect(funnelSteps(funnel({})).every((s) => s.share === 0)).toBe(true);
  });
});

describe('biggestDrop', () => {
  it('finds the step that loses the most people', () => {
    const steps = funnelSteps(
      funnel({ signed_up: 40, tour_done: 36, first_workout: 12, week2_eligible: 10, week2: 3 }),
    );
    expect(biggestDrop(steps)).toBe(2);
  });

  it('skips week 2 while nobody is two weeks in', () => {
    const steps = funnelSteps(funnel({ signed_up: 10, tour_done: 9, first_workout: 8 }));
    expect(biggestDrop(steps)).toBe(1);
  });

  it('has nothing to say without sign-ups', () => {
    expect(biggestDrop(funnelSteps(funnel({})))).toBeNull();
  });
});
