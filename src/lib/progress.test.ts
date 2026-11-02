import {
  breakBefore,
  changeText,
  currentBreak,
  durationText,
  gainText,
  workoutProgress,
} from './progress';
import type { Session, SetEntry } from './types';

const day = (n: number) => new Date(2026, 5, n, 12).toISOString();

const set = (exercise_id: string, weight_kg: number, reps: number, over: Partial<SetEntry> = {}) =>
  ({
    id: `${exercise_id}-${weight_kg}-${reps}-${Math.random()}`,
    session_id: 's',
    exercise_id,
    exercise_position: 0,
    set_number: 1,
    weight_kg,
    reps,
    done: true,
    is_pr: false,
    updated_at: '',
    ...over,
  }) as SetEntry;

const workout = (n: number, sets: SetEntry[]) =>
  ({
    id: `w${n}`,
    user_id: 'u',
    program_day_id: null,
    name: 'W',
    gym_id: null,
    started_at: day(n),
    finished_at: day(n),
    volume_kg: 0,
    set_count: 0,
    pr_count: 0,
    updated_at: '',
    sets,
  }) as Session;

const run = (...list: Session[]) => workoutProgress(list[list.length - 1], list);

describe('workoutProgress', () => {
  it('reports more weight against recent times', () => {
    const { recent } = run(
      workout(1, [set('bench', 80, 8)]),
      workout(3, [set('bench', 82.5, 8)]),
      workout(5, [set('bench', 87.5, 8)]),
    );
    expect(recent).toHaveLength(1);
    expect(gainText(recent[0])).toBe('+7.5 kg');
  });

  it('reports more reps at the same weight', () => {
    const { recent } = run(
      workout(1, [set('bench', 80, 6)]),
      workout(3, [set('bench', 80, 7)]),
      workout(5, [set('bench', 80, 8)]),
    );
    expect(gainText(recent[0])).toBe('+2 reps at 80 kg');
  });

  it('counts reps for bodyweight', () => {
    const { recent } = run(
      workout(1, [set('pushup', 0, 8)]),
      workout(3, [set('pushup', 0, 10)]),
      workout(5, [set('pushup', 0, 12)]),
    );
    expect(gainText(recent[0])).toBe('+4 reps');
  });

  it('stays quiet when things went down or stayed the same', () => {
    expect(
      run(
        workout(1, [set('bench', 90, 8)]),
        workout(3, [set('bench', 85, 8)]),
        workout(5, [set('bench', 80, 8)]),
      ).recent,
    ).toEqual([]);
    expect(
      run(
        workout(1, [set('bench', 80, 8)]),
        workout(3, [set('bench', 80, 8)]),
        workout(5, [set('bench', 80, 8)]),
      ).recent,
    ).toEqual([]);
  });

  it('does not call more weight for far fewer reps progress', () => {
    expect(
      run(
        workout(1, [set('bench', 80, 12)]),
        workout(3, [set('bench', 80, 12)]),
        workout(5, [set('bench', 85, 3)]),
      ).recent,
    ).toEqual([]);
  });

  it('needs at least two earlier times', () => {
    expect(
      run(workout(1, [set('bench', 80, 8)]), workout(3, [set('bench', 100, 8)])).recent,
    ).toEqual([]);
  });

  it('leaves out warm-ups, drop sets and open sets', () => {
    const { recent } = run(
      workout(1, [set('bench', 80, 8)]),
      workout(3, [set('bench', 80, 8)]),
      workout(5, [
        set('bench', 80, 8),
        set('bench', 200, 8, { warmup: true }),
        set('bench', 200, 8, { drop_of: 'x' }),
        set('bench', 200, 8, { done: false }),
      ]),
    );
    expect(recent).toEqual([]);
  });

  it('compares with the last few times only', () => {
    const { recent, sinceFirst } = run(
      workout(1, [set('bench', 60, 8)]),
      workout(3, [set('bench', 80, 8)]),
      workout(5, [set('bench', 80, 8)]),
      workout(7, [set('bench', 80, 8)]),
      workout(9, [set('bench', 80, 8)]),
      workout(21, [set('bench', 85, 8)]),
    );
    expect(gainText(recent[0])).toBe('+5 kg');
    expect(changeText(sinceFirst!)).toBe('60 → 85 kg');
    expect(Math.round(sinceFirst!.days)).toBe(20);
  });

  it('wants two weeks of history before saying since your first time', () => {
    const { sinceFirst } = run(
      workout(1, [set('bench', 60, 8)]),
      workout(3, [set('bench', 70, 8)]),
      workout(5, [set('bench', 80, 8)]),
    );
    expect(sinceFirst).toBeNull();
  });

  it('puts the biggest gain first', () => {
    const { recent } = run(
      workout(1, [set('bench', 100, 8), set('curl', 10, 8)]),
      workout(3, [set('bench', 100, 8), set('curl', 10, 8)]),
      workout(5, [set('bench', 105, 8), set('curl', 15, 8)]),
    );
    expect(recent.map((l) => l.exerciseId)).toEqual(['curl', 'bench']);
  });

  it('handles someone who only just started', () => {
    expect(run(workout(1, [set('bench', 80, 8)]))).toEqual({ recent: [], sinceFirst: null });
  });
});

describe('durationText', () => {
  it('reads naturally', () => {
    expect(durationText(14)).toBe('2 weeks');
    expect(durationText(7)).toBe('1 week');
    expect(durationText(90)).toBe('3 months');
  });
});

describe('currentBreak', () => {
  const now = new Date(2026, 5, 30, 12);

  it('finds a break of two weeks or more', () => {
    expect(currentBreak([workout(16, [])], now)).toEqual({ lastSessionId: 'w16', days: 14 });
    expect(currentBreak([workout(17, [])], now)).toBeNull();
  });

  it('looks at the newest workout', () => {
    expect(currentBreak([workout(1, []), workout(29, [])], now)).toBeNull();
  });

  it('says nothing to a new user', () => {
    expect(currentBreak([], now)).toBeNull();
  });
});

describe('breakBefore', () => {
  it('finds the break before a workout', () => {
    const back = workout(25, []);
    expect(breakBefore(back, [workout(1, []), back])).toBe(24);
  });

  it('says nothing after a normal gap or for a first workout', () => {
    const next = workout(8, []);
    expect(breakBefore(next, [workout(1, []), next])).toBeNull();
    expect(breakBefore(next, [next])).toBeNull();
  });
});
