import { chainIds, dropChain, dropWeight, withDrops } from './dropsets';

const sets = [
  { id: 'a' },
  { id: 'b' },
  { id: 'a2', drop_of: 'a1' },
  { id: 'a1', drop_of: 'a' },
  { id: 'b1', drop_of: 'b' },
];

describe('drop sets', () => {
  it('follows the chain in order', () => {
    expect(dropChain(sets, 'a').map((s) => s.id)).toEqual(['a1', 'a2']);
    expect(chainIds(sets, 'b')).toEqual(['b', 'b1']);
  });

  it('groups drops under their main set', () => {
    expect(withDrops(sets).map((g) => [g.set.id, g.drops.map((d) => d.id)])).toEqual([
      ['a', ['a1', 'a2']],
      ['b', ['b1']],
    ]);
  });

  it('suggests about 20 % lighter', () => {
    expect(dropWeight(100)).toBe(80);
    expect(dropWeight(42.5)).toBe(32.5);
    expect(dropWeight(0)).toBe(0);
  });
});
