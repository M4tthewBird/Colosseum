import { drawOrder, edgeOfCity, fits, layOut, staysWhole, tilesOf, type Placed } from './cityGrid';

const SIZES: Record<string, number> = { arena: 3, house: 2, tree: 1 };
const size = (id: string) => SIZES[id];

describe('cityGrid', () => {
  const arena: Placed = { key: 1, id: 'arena', i: 0, j: 0 };

  it('counts a piece’s tiles by its plot size', () => {
    expect(tilesOf([arena], size).size).toBe(9);
    expect(tilesOf([{ key: 2, id: 'tree', i: 5, j: 5 }], size).size).toBe(1);
  });

  it('lets a piece stand only on free tiles touching the city', () => {
    expect(fits([arena], size, 'house', 3, 0)).toBe(true); // right next to it
    expect(fits([arena], size, 'house', 2, 0)).toBe(false); // on the arena
    expect(fits([arena], size, 'house', 4, 0)).toBe(false); // a tile apart
    expect(fits([arena], size, 'tree', 3, 3)).toBe(false); // corners only: no shared edge
    expect(fits([], size, 'house', 40, 40)).toBe(true); // the first piece goes anywhere
  });

  it('offers the free tiles around the city', () => {
    // a 3×3 arena has 12 tiles along its sides
    expect(edgeOfCity([arena], size).size).toBe(12);
  });

  it('keeps the city in one piece', () => {
    const city = layOut(
      [
        ['arena', 0, 0],
        ['house', 3, 0],
        ['tree', 5, 0],
      ],
      size,
    );
    expect(city.map((p) => p.id)).toEqual(['arena', 'house', 'tree']);
    expect(staysWhole(city, size, 1, 2)).toBe(false); // the house links the tree to the arena
    expect(staysWhole(city, size, 1, 3)).toBe(true);
    expect(staysWhole(city, size, 1, 1)).toBe(false); // the arena always stays
  });

  it('skips planned pieces that break the rules', () => {
    const city = layOut(
      [
        ['arena', 0, 0],
        ['house', 1, 1],
        ['house', 0, 3],
      ],
      size,
    );
    expect(city.map((p) => `${p.id}@${p.i},${p.j}`)).toEqual(['arena@0,0', 'house@0,3']);
  });

  it('draws back to front', () => {
    const front = { key: 2, id: 'house', i: 3, j: 0 };
    const left = { key: 3, id: 'tree', i: 0, j: 3 };
    const order = drawOrder([front, left, arena], size).map((p) => p.key);
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(2));
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(3));
  });
});
