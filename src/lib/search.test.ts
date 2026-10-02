import catalog from '@/data/exercises.json';

import { distance, matchScore, searchExercises } from './search';

const items = catalog as { name: string; tier: 'S' | 'A' | 'B' | null }[];
const top = (q: string, n = 3) => searchExercises(q, items, n).map((e) => e.name);

describe('exercise search', () => {
  it('finds exact and prefix matches first', () => {
    expect(top('bench press')[0]).toBe('Bench Press');
    expect(top('squat')[0]).toBe('Squat');
    expect(top('lat pull')).toContain('Lat Pulldown');
  });

  it('accepts words in any order and hyphenated input', () => {
    expect(top('press bench')).toContain('Bench Press');
    expect(top('pull-up')[0]).toBe('Pull Up');
  });

  it('understands gym abbreviations', () => {
    expect(top('rdl')[0]).toBe('Romanian Deadlift');
    expect(top('ohp')[0]).toBe('Overhead Press');
    expect(top('db row')).toContain('Dumbbell Row');
  });

  it('forgives typos and glued words', () => {
    expect(top('benchpress')[0]).toBe('Bench Press');
    expect(top('romainan deadlift')[0]).toBe('Romanian Deadlift');
    expect(top('lateral rasie', 5)).toContain('Lateral Raise');
    expect(top('bayesain curl')[0]).toBe('Bayesian Cable Curl');
  });

  it('does not match unrelated names', () => {
    expect(matchScore('squat', 'Bench Press')).toBe(0);
    expect(matchScore('xyzxyz', 'Squat')).toBe(0);
  });

  it('measures edit distance', () => {
    expect(distance('squar', 'squat')).toBe(1);
    expect(distance('abc', 'xyz', 1)).toBe(2);
  });
});
