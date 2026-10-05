import { similarExercises } from './similar';
import type { Exercise } from './types';

const ex = (
  id: string,
  muscles: string[],
  tier: Exercise['tier'] = null,
  created_by: string | null = null,
): Exercise => ({
  id,
  name: id,
  muscles,
  image_key: null,
  created_by,
  tier,
});

describe('similarExercises', () => {
  const bench = ex('bench', ['chest', 'triceps', 'shoulders'], 'A');
  const all = [
    bench,
    ex('fly', ['chest'], 'S'),
    ex('machine', ['chest', 'triceps', 'shoulders'], 'S'),
    ex('db', ['chest', 'triceps'], 'A'),
    ex('dip', ['triceps', 'chest'], 'S'),
    ex('untiered', ['chest']),
    ex('mine', ['chest'], 'S', 'user'),
  ];

  it('suggests same-main-muscle exercises, best tier first, closest match first', () => {
    expect(similarExercises(bench, all).map((e) => e.id)).toEqual(['machine', 'fly', 'db']);
  });

  it('respects the limit', () => {
    expect(similarExercises(bench, all, 1).map((e) => e.id)).toEqual(['machine']);
  });
});
