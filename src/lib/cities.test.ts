import { BUILT_IN_CITIES, normalizeCity, suggestCities } from './cities';

describe('city suggestions', () => {
  it('ignores diacritics and case', () => {
    expect(normalizeCity('Plzeň')).toBe('plzen');
    expect(suggestCities('plzen')[0]).toBe('Plzeň');
    expect(suggestCities('USTI')).toContain('Ústí nad Labem');
  });

  it('puts prefix matches first, then word matches', () => {
    const s = suggestCities('bud');
    expect(s).toContain('České Budějovice');
    expect(suggestCities('br')[0]).toBe('Brno');
  });

  it('merges cities of existing gyms, keeping the bundled spelling', () => {
    expect(suggestCities('lond', ['London'])).toEqual(['London']);
    expect(suggestCities('brno', ['brno ', 'BRNO'])).toEqual(['Brno']);
  });

  it('returns nothing for empty input and caps the list', () => {
    expect(suggestCities('  ')).toEqual([]);
    expect(suggestCities('a', [], 4)).toHaveLength(4);
  });

  it('has no duplicates in the bundled list', () => {
    const keys = BUILT_IN_CITIES.map(normalizeCity);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
