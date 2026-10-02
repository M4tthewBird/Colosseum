import { exerciseSlug } from './slug';

describe('exerciseSlug', () => {
  it('matches the file names used by npm run images', () => {
    expect(exerciseSlug('Bench press')).toBe('bench-press');
    expect(exerciseSlug("Farmer's carry")).toBe('farmers-carry');
    expect(exerciseSlug('45-degree back extension')).toBe('45-degree-back-extension');
    expect(exerciseSlug('Super-ROM dumbbell lateral raise')).toBe(
      'super-rom-dumbbell-lateral-raise',
    );
    expect(exerciseSlug('Výpady s jednoručkami')).toBe('vypady-s-jednoruckami');
  });
});
