import { copyExercises, postSummary, snapshotOf } from './forum';
import type { Session, SetEntry } from './types';

const set = (p: Partial<SetEntry> & { id: string }): SetEntry => ({
  session_id: 's',
  exercise_id: 'bench',
  exercise_position: 0,
  set_number: 1,
  weight_kg: 100,
  reps: 8,
  done: true,
  is_pr: false,
  updated_at: '',
  ...p,
});

const session: Session = {
  id: 's',
  user_id: 'u',
  program_day_id: null,
  name: 'Push',
  started_at: '2026-10-10T18:00:00Z',
  finished_at: '2026-10-10T19:05:00Z',
  volume_kg: 0,
  set_count: 0,
  pr_count: 0,
  updated_at: '',
  sets: [
    set({ id: 'a', set_number: 1, reps: 8 }),
    set({ id: 'b', set_number: 2, reps: 6, failure: true }),
    set({ id: 'b1', set_number: 2, weight_kg: 80, reps: 5, drop_of: 'b' }),
    set({ id: 'c', set_number: 3, done: false }),
    set({
      id: 'd',
      exercise_id: 'fly',
      exercise_position: 1,
      weight_kg: 20,
      reps: 12,
      superset_id: 'x',
    }),
    set({
      id: 'e',
      exercise_id: 'raise',
      exercise_position: 2,
      weight_kg: 10,
      reps: 15,
      superset_id: 'x',
    }),
  ],
};
const names = {
  bench: { name: 'Bench Press', muscles: ['chest'] },
  fly: { name: 'Pec Deck', muscles: ['chest'] },
};

describe('forum snapshot', () => {
  const w = snapshotOf(session, names, 'Push');

  it('keeps done sets per exercise with drops and failure', () => {
    expect(w.duration_min).toBe(65);
    expect(w.volume_kg).toBe(100 * 8 + 100 * 6 + 80 * 5 + 20 * 12 + 10 * 15);
    expect(w.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Pec Deck', 'Exercise']);
    expect(w.exercises[0].sets).toEqual([
      { kg: 100, reps: 8 },
      { kg: 100, reps: 6, failure: true, drops: [{ kg: 80, reps: 5 }] },
    ]);
    expect(postSummary(w)).toBe('3 exercises · 4 sets');
  });

  it('copies into program exercises with new superset ids', () => {
    let n = 0;
    const ex = copyExercises(
      w,
      (e) => `my-${e.exercise_id}`,
      () => `id${n++}`,
    );
    expect(ex.map((e) => [e.exercise_id, e.sets, e.reps_min, e.reps_max])).toEqual([
      ['my-bench', 2, 6, 8],
      ['my-fly', 1, 12, 12],
      ['my-raise', 1, 15, 15],
    ]);
    expect(ex[0].superset_id).toBeNull();
    expect(ex[1].superset_id).toBe(ex[2].superset_id);
    expect(ex[1].superset_id).not.toBe('x');
  });
});
