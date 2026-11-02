import { swapSets } from './swap';
import type { SetEntry } from './types';

const set = (id: string, over: Partial<SetEntry> = {}): SetEntry => ({
  id,
  session_id: 's',
  exercise_id: 'old',
  exercise_position: 1,
  set_number: 1,
  weight_kg: 100,
  reps: 5,
  done: false,
  is_pr: false,
  updated_at: 'then',
  ...over,
});

const fresh = (id: string, weight_kg: number): SetEntry =>
  set(id, { exercise_id: 'new', weight_kg, reps: 10 });

describe('swapSets', () => {
  it('refills open sets for the new exercise and keeps their numbers', () => {
    const out = swapSets(
      [set('a'), set('b', { set_number: 2 })],
      1,
      'new',
      [fresh('x', 40), fresh('y', 42.5)],
      'now',
    );
    expect(out.map((s) => [s.id, s.exercise_id, s.set_number, s.weight_kg])).toEqual([
      ['x', 'new', 1, 40],
      ['y', 'new', 2, 42.5],
    ]);
  });

  it('moves done sets along as logged', () => {
    const out = swapSets(
      [set('a', { done: true, is_pr: true }), set('b', { set_number: 2 })],
      1,
      'new',
      [fresh('y', 40)],
      'now',
    );
    expect(out[0]).toMatchObject({
      id: 'a',
      exercise_id: 'new',
      weight_kg: 100,
      done: true,
      updated_at: 'now',
    });
    expect(out[1]).toMatchObject({ id: 'y', set_number: 2, weight_kg: 40 });
  });

  it('drops open warm-ups and drop sets, and a done drop set without its main set', () => {
    const out = swapSets(
      [
        set('w', { warmup: true, set_number: 0 }),
        set('main'),
        set('drop', { drop_of: 'main', done: true }),
        set('done', { set_number: 2, done: true }),
        set('open-drop', { set_number: 2, drop_of: 'done' }),
      ],
      1,
      'new',
      [fresh('x', 40)],
      'now',
    );
    expect(out.map((s) => s.id)).toEqual(['done', 'x']);
  });

  it('leaves other exercises alone and keeps the superset', () => {
    const other = set('o', { exercise_position: 2, exercise_id: 'other' });
    const out = swapSets(
      [other, set('a', { superset_id: 'ss' })],
      1,
      'new',
      [fresh('x', 40)],
      'now',
    );
    expect(out[0]).toBe(other);
    expect(out[1]).toMatchObject({ id: 'x', superset_id: 'ss' });
  });
});
