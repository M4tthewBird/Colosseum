import { lastActivity, realMinutes, staleWorkoutEnd } from './workoutLimits';

const start = new Date(2026, 10, 2, 10).getTime();
const at = (hours: number) => new Date(start + hours * 3600000).toISOString();
const workout = (activity: number[] = []) => ({
  started_at: at(0),
  updated_at: at(0),
  sets: activity.map((h) => ({ updated_at: at(h) })),
});
const now = (hours: number) => start + hours * 3600000;

describe('lastActivity', () => {
  it('takes the newest change', () => {
    expect(lastActivity(workout([0.5, 1.5, 1]))).toBe(now(1.5));
    expect(lastActivity(workout())).toBe(now(0));
    expect(lastActivity({ ...workout([1]), updated_at: at(2) })).toBe(now(2));
  });
});

describe('staleWorkoutEnd', () => {
  it('leaves a workout in use alone', () => {
    expect(staleWorkoutEnd(workout(), now(2.9))).toBeNull();
    expect(staleWorkoutEnd(workout([3, 5]), now(5.9))).toBeNull();
  });

  it('ends it 3 hours after the last activity, dated at that activity', () => {
    expect(staleWorkoutEnd(workout([1.5]), now(4.5))).toBe(at(1.5));
  });

  it('ends a workout started and never touched at its start', () => {
    expect(staleWorkoutEnd(workout(), now(3))).toBe(at(0));
  });

  it('never lasts past 6 hours, even with activity', () => {
    expect(staleWorkoutEnd(workout([5, 7]), now(7.5))).toBe(at(6));
  });

  it('turns a workout left for 350 hours into its real length', () => {
    expect(staleWorkoutEnd(workout([1.2]), now(350))).toBe(at(1.2));
  });
});

describe('realMinutes', () => {
  it('is the length of a normal workout', () => {
    expect(realMinutes({ started_at: at(0), finished_at: at(1.5) })).toBe(90);
  });

  it('ignores open workouts and nonsense', () => {
    expect(realMinutes({ started_at: at(0), finished_at: null })).toBe(0);
    expect(realMinutes({ started_at: at(0), finished_at: at(350) })).toBe(0);
  });
});
