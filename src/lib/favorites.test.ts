import { favoritesFirst } from './favorites';

const ex = (id: string, name = id) => ({ id, name });
const fav = (ids: string[]) => (id: string) => ids.includes(id);

describe('favoritesFirst', () => {
  it('moves favorites to the top and keeps the order otherwise', () => {
    const list = [ex('a'), ex('b'), ex('c'), ex('d')];
    expect(favoritesFirst(list, fav(['c', 'b'])).map((e) => e.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('keeps an exact name match first when searching', () => {
    const list = [ex('sq', 'Squat'), ex('fs', 'Front Squat'), ex('bs', 'Box Squat')];
    expect(favoritesFirst(list, fav(['bs']), 'squat').map((e) => e.id)).toEqual(['sq', 'bs', 'fs']);
  });

  it('changes nothing without favorites', () => {
    const list = [ex('a'), ex('b')];
    expect(favoritesFirst(list, fav([]))).toEqual(list);
  });
});
