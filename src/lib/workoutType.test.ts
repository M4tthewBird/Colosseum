import type { Session, SetEntry } from './types';
import { comparableWorkout, muscleVector, similarity, workoutKind } from './workoutType';

const MUSCLES: Record<string, string[]> = {
  bench: ['chest', 'triceps', 'shoulders'],
  ohp: ['shoulders', 'triceps'],
  pushdown: ['triceps'],
  row: ['back', 'upper back', 'biceps'],
  pulldown: ['back', 'biceps'],
  curl: ['biceps'],
  squat: ['quads', 'glutes'],
  rdl: ['hamstrings', 'glutes'],
  calf: ['calves'],
};
const musclesOf = (id: string) => MUSCLES[id] ?? [];

let n = 0;
const sets = (sid: string, ...ex: string[]): SetEntry[] =>
  ex.flatMap((e, pos) =>
    [1, 2, 3].map((no) => ({
      id: `s${n++}`,
      session_id: sid,
      exercise_id: e,
      exercise_position: pos,
      set_number: no,
      weight_kg: 50,
      reps: 8,
      done: true,
      is_pr: false,
      updated_at: '',
    })),
  );
const session = (id: string, day: string | null, name: string, ...ex: string[]): Session => ({
  id,
  user_id: 'u',
  program_day_id: day,
  name,
  started_at: `2026-10-0${id.length}T18:00:00Z`,
  finished_at: `2026-10-0${id.length}T19:00:00Z`,
  volume_kg: 0,
  set_count: 0,
  pr_count: 0,
  updated_at: '',
  sets: sets(id, ...ex),
});
const kindOf = (...ex: string[]) => workoutKind(muscleVector(sets('k', ...ex), musclesOf));

describe('workout kind', () => {
  it('reads the kind from the muscles', () => {
    expect(kindOf('bench', 'ohp', 'pushdown')).toBe('Push');
    expect(kindOf('row', 'pulldown', 'curl')).toBe('Pull');
    expect(kindOf('squat', 'rdl', 'calf')).toBe('Legs');
    expect(kindOf('bench', 'row', 'ohp', 'pulldown')).toBe('Upper');
    expect(kindOf('curl', 'pushdown')).toBe('Arms');
    expect(kindOf('squat', 'bench', 'row')).toBe('Full body');
    expect(kindOf()).toBeNull();
  });

  it('ignores drop sets and undone sets', () => {
    const s = sets('d', 'squat');
    s.push({ ...s[0], id: 'drop', exercise_id: 'bench', drop_of: s[0].id });
    s.push({ ...s[0], id: 'undone', exercise_id: 'bench', done: false });
    expect(muscleVector(s, musclesOf)).toEqual({ quads: 3, glutes: 1.5 });
  });

  it('measures similarity', () => {
    expect(similarity({ chest: 1 }, { chest: 2 })).toBeCloseTo(1);
    expect(similarity({ chest: 1 }, { quads: 1 })).toBe(0);
  });
});

describe('comparable workout', () => {
  it('prefers the same program day', () => {
    const now = session('aaaa', 'upper-a', 'Upper A', 'bench', 'row');
    const legs = session('aaa', 'legs', 'Legs', 'squat', 'rdl');
    const same = session('aa', 'upper-a', 'Upper A', 'bench', 'row');
    expect(comparableWorkout(now, [legs, same], musclesOf)).toMatchObject({
      session: { id: 'aa' },
      match: 'same',
    });
  });

  it('skips legs day when comparing an upper workout', () => {
    const now = session('aaaa', null, 'Workout', 'bench', 'row', 'ohp');
    const legs = session('aaa', null, 'Workout', 'squat', 'rdl', 'calf');
    const upper = session('aa', 'upper-b', 'Upper B', 'bench', 'pulldown', 'ohp');
    expect(comparableWorkout(now, [legs, upper], musclesOf)).toMatchObject({
      session: { id: 'aa' },
      kind: 'Upper',
      match: 'similar',
    });
  });

  it('finds nothing comparable', () => {
    const now = session('aaaa', null, 'Workout', 'bench', 'ohp');
    const legs = session('aaa', null, 'Workout', 'squat');
    expect(comparableWorkout(now, [legs], musclesOf)).toBeNull();
  });
});
