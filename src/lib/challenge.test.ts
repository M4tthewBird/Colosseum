import catalog from '@/data/exercises.json';

import { challengeExercisesText, challengeVariants } from './challenge';
import type { Exercise } from './types';

const all = catalog as {
  name: string;
  muscles: string[];
  tier: 'S' | 'A' | 'B' | null;
  core?: boolean;
}[];
const exercises: Exercise[] = all.map((e) => ({
  id: e.name,
  name: e.name,
  muscles: e.muscles,
  image_key: null,
  created_by: null,
  tier: e.tier,
}));
const curated = new Set(all.filter((e) => e.core).map((e) => e.name));
const byName = (n: string) => exercises.find((e) => e.name === n)!;
const variants = (...names: string[]) =>
  challengeVariants(names.map(byName), exercises, curated).map((e) => e.name);

describe('challengeVariants', () => {
  it('offers chin-ups and variations for pull-ups', () => {
    const names = variants('Pull Up');
    expect(names).toEqual(expect.arrayContaining(['Chin Up', 'Neutral Grip Pull Up']));
    expect(names).not.toContain('Pull Up');
  });

  it('offers pull-ups for chin-ups too', () => {
    expect(variants('Chin Up')).toContain('Pull Up');
  });

  it('stays with the same movement', () => {
    expect(variants('Pull Up').join()).not.toMatch(/squat|press|curl/i);
  });

  it('leaves out obscure catalog entries', () => {
    expect(variants('Pull Up').join()).not.toMatch(/rocky|l pull up/i);
  });

  it('does not offer what is already chosen', () => {
    expect(variants('Pull Up', 'Chin Up')).not.toContain('Chin Up');
  });

  it('offers nothing until something is chosen', () => {
    expect(challengeVariants([], exercises, curated)).toEqual([]);
  });

  it('keeps the list short', () => {
    expect(variants('Squat').length).toBeLessThanOrEqual(6);
  });
});

describe('challengeExercisesText', () => {
  it('names up to three', () => {
    expect(challengeExercisesText(['A', 'B', 'C'])).toBe('A, B, C');
  });

  it('shortens a longer list', () => {
    expect(challengeExercisesText(['A', 'B', 'C', 'D'])).toBe('A, B and 2 more');
  });
});
