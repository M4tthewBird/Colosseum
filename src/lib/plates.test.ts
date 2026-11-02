import { isBarbellLift, platesFor } from './plates';

describe('platesFor', () => {
  it('uses the heaviest plates first', () => {
    expect(platesFor(100, 20)).toEqual({ perSide: [25, 15], short: 0 });
    expect(platesFor(137.5, 20)).toEqual({ perSide: [25, 25, 5, 2.5, 1.25], short: 0 });
  });

  it('works with other bars', () => {
    expect(platesFor(50, 15)).toEqual({ perSide: [15, 2.5], short: 0 });
  });

  it('shows an empty bar', () => {
    expect(platesFor(20, 20)).toEqual({ perSide: [], short: 0 });
  });

  it('says what cannot be loaded', () => {
    expect(platesFor(21, 20)).toEqual({ perSide: [], short: 1 });
  });

  it('refuses a weight below the bar', () => {
    expect(platesFor(15, 20)).toBeNull();
  });
});

describe('isBarbellLift', () => {
  it('knows barbell lifts', () => {
    for (const n of ['Bench Press', 'Squat', 'Deadlift', 'Barbell Row', 'Romanian Deadlift'])
      expect(isBarbellLift(n)).toBe(true);
  });

  it('leaves out the rest', () => {
    for (const n of [
      'Dumbbell Bench Press',
      'Smith Machine Squat',
      'Machine Chest Press',
      'Hack Squat',
      'Goblet Squat',
      'Lat Pulldown',
    ])
      expect(isBarbellLift(n)).toBe(false);
  });
});
