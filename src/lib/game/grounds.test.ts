import type { Building } from './fortress';
import {
  buildingPicture,
  buyBlock,
  groundFits,
  groundMinutes,
  groundSize,
  rootPicture,
  ROOT,
  type GroundPiece,
} from './grounds';

const b = (
  building: Building['building'],
  level: number,
  extra: Partial<Building> = {},
): Building => ({
  owner_kind: 'ludus',
  owner_id: 'x',
  building,
  level,
  target_level: null,
  ready_at: null,
  damaged: false,
  ...extra,
});

describe('the grid', () => {
  it('has a 3×3 heart on a training ground and a 2×2 house at home', () => {
    expect(groundSize('ludus', ROOT)).toBe(3);
    expect(groundSize('home', ROOT)).toBe(2);
    expect(groundSize('ludus', 'barracks')).toBe(2);
    expect(groundSize('ludus', 'bench')).toBe(1);
  });

  it('puts a piece only on free tiles next to what is built', () => {
    const none: GroundPiece[] = [];
    expect(groundFits('ludus', none, 'palus', 3, 0)).toBe(true); // touches the school
    expect(groundFits('ludus', none, 'palus', 1, 1)).toBe(false); // on the school
    expect(groundFits('ludus', none, 'palus', 5, 5)).toBe(false); // alone
    expect(groundFits('home', none, 'hortus', 2, 0)).toBe(true);
    expect(groundFits('home', none, 'hortus', 3, 0)).toBe(false);
    const one: GroundPiece[] = [{ id: 'p', piece: 'palus', i: 3, j: 0 }];
    expect(groundFits('ludus', one, 'brazier', 4, 0)).toBe(true);
    expect(groundFits('ludus', one, 'brazier', 3, 0)).toBe(false);
    expect(groundFits('ludus', one, 'brazier', 3, 0, 'p')).toBe(true); // moving it
    expect(groundFits('ludus', none, 'palus', 16, 0)).toBe(false); // too far
  });
});

describe('prices', () => {
  it('costs hours, three times as much for a tribe, and only fits where it belongs', () => {
    expect(groundMinutes('ludus', 'palus')).toBe(120);
    expect(groundMinutes('gym', 'palus')).toBe(360);
    expect(groundMinutes('home', 'palus')).toBe(120);
    expect(groundMinutes('home', 'weapon-rack')).toBeNull();
    expect(groundMinutes('ludus', 'hortus')).toBeNull();
    expect(groundMinutes('ludus', 'bench')).toBeNull(); // a building: start_building pays
  });

  it('says why it cannot be bought', () => {
    expect(buyBlock('home', [], 'hortus', 299)).toBe('Needs 5 h');
    expect(buyBlock('home', [], 'hortus', 300)).toBeNull();
    expect(buyBlock('home', [{ id: 'a', piece: 'hortus', i: 2, j: 0 }], 'hortus', 900)).toBe(
      'You have it already',
    );
    expect(buyBlock('home', [], 'banner', 60)).toBeNull();
  });
});

describe('pictures', () => {
  it('shows a building by its level, the palisade as the gate', () => {
    expect(buildingPicture(b('bench', 2))).toBe('bench-2');
    expect(buildingPicture(b('palisade', 3))).toBe('gate-2');
    expect(buildingPicture(b('barracks', 5))).toBe('barracks-3');
    expect(buildingPicture(b('temple', 0, { target_level: 1, ready_at: '2999-01-01' }))).toBe(
      'scaffold-2',
    );
  });

  it('draws the heart by the fortress stage or the house level', () => {
    expect(rootPicture('ludus', 0, 1)).toBe('ludus-1');
    expect(rootPicture('ludus', 3, 1)).toBe('ludus-3');
    expect(rootPicture('gym', 2, 1)).toBe('arena-3');
    expect(rootPicture('home', 0, 4)).toBe('home-4');
  });
});
