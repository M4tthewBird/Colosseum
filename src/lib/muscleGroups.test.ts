import { mainGroup, setCredit, weeklyLevel, weeklySets } from './muscleGroups';
import type { Exercise, Session, SetEntry } from './types';

const ex = (id: string, muscles: string[]): Exercise => ({
  id,
  name: id,
  muscles,
  image_key: null,
  created_by: null,
});
const exercises = {
  bench: ex('bench', ['chest', 'triceps', 'shoulders']),
  curl: ex('curl', ['biceps']),
  run: ex('run', ['cardio']),
};
const now = new Date(2026, 10, 4, 12); // a Wednesday

const set = (exercise_id: string, over: Partial<SetEntry> = {}): SetEntry => ({
  id: Math.random().toString(),
  session_id: 's',
  exercise_id,
  exercise_position: 0,
  set_number: 1,
  weight_kg: 50,
  reps: 8,
  done: true,
  is_pr: false,
  updated_at: '',
  ...over,
});

const session = (sets: SetEntry[], started: Date, finished = true): Session =>
  ({
    id: 's',
    user_id: 'u',
    program_day_id: null,
    name: 'x',
    gym_id: null,
    started_at: started.toISOString(),
    finished_at: finished ? started.toISOString() : null,
    volume_kg: 0,
    set_count: 0,
    pr_count: 0,
    updated_at: '',
    sets,
  }) as Session;

describe('setCredit', () => {
  it('gives 1 to the main muscle and 0.5 to those that assist', () => {
    expect(Object.fromEntries(setCredit(exercises.bench.muscles))).toEqual({
      Chest: 1,
      Triceps: 0.5,
      Shoulders: 0.5,
    });
  });

  it('keeps the higher value when two muscles share a group', () => {
    expect(setCredit(['chest', 'upper chest']).get('Chest')).toBe(1);
  });

  it('ignores muscles outside the groups', () => {
    expect(setCredit(['cardio']).size).toBe(0);
    expect(mainGroup(['cardio'])).toBeNull();
  });
});

describe('weeklySets', () => {
  it('counts done working sets of this week', () => {
    const out = weeklySets(
      [session([set('bench'), set('bench'), set('curl')], new Date(2026, 10, 3))],
      exercises,
      now,
    );
    expect(out.Chest).toBe(2);
    expect(out.Triceps).toBe(1);
    expect(out.Biceps).toBe(1);
  });

  it('leaves out warm-ups, drop sets and open sets', () => {
    const out = weeklySets(
      [
        session(
          [
            set('bench', { warmup: true }),
            set('bench', { drop_of: 'x' }),
            set('bench', { done: false }),
          ],
          new Date(2026, 10, 3),
        ),
      ],
      exercises,
      now,
    );
    expect(out.Chest).toBe(0);
  });

  it('leaves out other weeks and unfinished workouts', () => {
    const out = weeklySets(
      [
        session([set('bench')], new Date(2026, 9, 30)),
        session([set('bench')], new Date(2026, 10, 3), false),
      ],
      exercises,
      now,
    );
    expect(out.Chest).toBe(0);
  });
});

describe('weeklyLevel', () => {
  it('compares with 10 to 20 sets', () => {
    expect(weeklyLevel(9.5)).toBe('below');
    expect(weeklyLevel(10)).toBe('in range');
    expect(weeklyLevel(20)).toBe('in range');
    expect(weeklyLevel(20.5)).toBe('above');
  });
});
