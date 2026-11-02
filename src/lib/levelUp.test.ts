import { askAgainAt, levelUpDue } from './levelUp';

describe('levelUpDue', () => {
  it('asks a beginner at 10 workouts', () => {
    expect(levelUpDue('beginner', 9)).toBe(false);
    expect(levelUpDue('beginner', 10)).toBe(true);
  });

  it('asks someone who never chose a level', () => {
    expect(levelUpDue(null, 10)).toBe(true);
    expect(levelUpDue(undefined, 10)).toBe(true);
  });

  it('leaves everyone else alone', () => {
    expect(levelUpDue('intermediate', 50)).toBe(false);
    expect(levelUpDue('advanced', 50)).toBe(false);
  });

  it('waits after "Not yet"', () => {
    const next = askAgainAt(10);
    expect(next).toBe(20);
    expect(levelUpDue('beginner', 15, next)).toBe(false);
    expect(levelUpDue('beginner', 20, next)).toBe(true);
  });
});
