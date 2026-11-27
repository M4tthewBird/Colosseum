/**
 * What the painted city is made of: the pieces a player can build (by family and level), the
 * places that open a part of the game, the effects drawn over some pictures, and the city a new
 * player starts with. Pictures and plots come from pieces.ts (generated).
 */
import type { Href } from 'expo-router';

import type { Placed } from '@/lib/game/cityGrid';
import { CITY_PIECES } from './pieces';

export type CityGroup = 'building' | 'machine' | 'decor';

export interface CityPiece {
  id: string;
  name: string;
  /** The palette's name: the family's, or the piece's own. */
  label: string;
  group: CityGroup | 'arena' | 'build';
  /** Upgrades go up a family, one level at a time. */
  family?: string;
}

const FAMILIES: [string | null, string, CityPiece['group'], [string, string][]][] = [
  [
    'arena',
    'Arena',
    'arena',
    [
      ['arena-1', 'Training ground'],
      ['arena-2', 'Wooden fort'],
      ['arena-3', 'Stone arena'],
      ['arena-4', 'Colosseum'],
    ],
  ],
  [
    'temple',
    'Temple',
    'building',
    [
      ['temple-1', 'Altar'],
      ['temple-2', 'Small temple'],
      ['temple-3', 'Great temple'],
    ],
  ],
  [
    'home',
    'Domus',
    'building',
    [
      ['home-1', 'Hut'],
      ['home-2', 'Small stone house'],
      ['home-3', 'Domus'],
      ['home-4', 'Villa'],
      ['home-5', 'Palace'],
    ],
  ],
  [
    'barracks',
    'Barracks',
    'building',
    [
      ['barracks-1', 'Wooden barracks'],
      ['barracks-2', 'Stone barracks'],
      ['barracks-3', 'Ludus barracks'],
    ],
  ],
  [
    'gate',
    'Walls',
    'building',
    [
      ['gate-1', 'Wooden gate'],
      ['gate-2', 'Stone gate'],
      ['gate-3', 'Towered gate'],
    ],
  ],
  [
    null,
    '',
    'building',
    [
      ['forge', 'Forge'],
      ['market', 'Market'],
      ['baths', 'Baths'],
      ['arch', 'Triumphal arch'],
    ],
  ],
  [
    'rack',
    'Squat rack',
    'machine',
    [
      ['rack-1', 'Squat rack I'],
      ['rack-2', 'Squat rack II'],
      ['rack-3', 'Squat rack III'],
    ],
  ],
  [
    'bench',
    'Bench',
    'machine',
    [
      ['bench-1', 'Bench I'],
      ['bench-2', 'Bench II'],
      ['bench-3', 'Bench III'],
    ],
  ],
  [
    'cable',
    'Cable station',
    'machine',
    [
      ['cable-1', 'Cable station I'],
      ['cable-2', 'Cable station II'],
      ['cable-3', 'Cable station III'],
    ],
  ],
  [
    'platform',
    'Deadlift',
    'machine',
    [
      ['platform-1', 'Deadlift platform I'],
      ['platform-2', 'Deadlift platform II'],
      ['platform-3', 'Deadlift platform III'],
    ],
  ],
  [
    null,
    '',
    'decor',
    [
      ['tree-cypress', 'Cypresses'],
      ['tree-pine', 'Stone pine'],
      ['statue', 'Statue'],
      ['banner', 'Banner'],
      ['cart', 'Cart'],
      ['amphorae', 'Amphorae'],
      // the aqueduct (Matyáš, 2026-11-27): its bonus waits for who owns the city (GAME.md §5b)
      ['aqueduct-a', 'Aqueduct /'],
      ['aqueduct-b', 'Aqueduct \\'],
      ['aqueduct-pier', 'Aqueduct corner'],
      ['castellum', 'Water tower'],
    ],
  ],
  [
    null,
    '',
    'build',
    [
      ['scaffold-1', 'Scaffolding'],
      ['scaffold-2', 'Scaffolding'],
      ['scaffold-3', 'Scaffolding'],
    ],
  ],
];

/** Every piece that has a picture, in palette order. */
export const PIECES: CityPiece[] = FAMILIES.flatMap(([family, label, group, members]) =>
  members
    .filter(([id]) => CITY_PIECES[id])
    .map(([id, name]) => ({
      id,
      name,
      label: family ? label : name,
      group,
      family: family ?? undefined,
    })),
);
export const PIECE: Record<string, CityPiece> = Object.fromEntries(PIECES.map((p) => [p.id, p]));

/** The family's levels, lowest first (one entry for a piece without a family). */
export const levelsOf = (id: string): CityPiece[] =>
  PIECE[id]?.family ? PIECES.filter((p) => p.family === PIECE[id].family) : [PIECE[id]];

/** The palette: the first level of each family, and every piece without one. */
export const PALETTE: CityPiece[] = PIECES.filter(
  (p) =>
    (p.group === 'building' || p.group === 'machine' || p.group === 'decor') &&
    levelsOf(p.id)[0] === p,
);

export const sizeOf = (id: string): number => CITY_PIECES[id]?.size ?? 1;

/** The places that open a part of the game; `status` is filled in from the player's game. */
export type PlaceId =
  'colosseum' | 'temple' | 'forge' | 'market' | 'baths' | 'home' | 'ludus' | 'walls';
export interface Place {
  id: PlaceId;
  title: string;
  text: string;
  to?: Href;
}
export const PLACES: Record<PlaceId, Place> = {
  colosseum: {
    id: 'colosseum',
    title: 'Colosseum',
    text: 'The heart of the tribe: the league, duels with friends and Bellum, the war of the gyms in your city.',
    to: '/city/colosseum',
  },
  temple: {
    id: 'temple',
    title: 'Temple',
    text: 'Your gym’s tribe and its fortress, built with the denarii its members give.',
    to: '/city/temple',
  },
  forge: {
    id: 'forge',
    title: 'Forge',
    text: 'Gear and weapons, earned with denarii, levels and verified workouts.',
    to: '/forge',
  },
  market: { id: 'market', title: 'Market', text: 'Trade for denarii. Coming soon.' },
  baths: { id: 'baths', title: 'Baths', text: 'A bonus for a rest day. Coming soon.' },
  home: {
    id: 'home',
    title: 'Your domus',
    text: 'Your gladiator’s home, growing with your rank.',
    to: '/city/domus',
  },
  ludus: {
    id: 'ludus',
    title: 'Ludus',
    text: 'Your ludus’s barracks: its members, treasury, fortress and wars.',
    to: '/city/ludus',
  },
  walls: {
    id: 'walls',
    title: 'Walls',
    text: 'The tribe’s palisade: it adds points in defence.',
    to: '/city/temple',
  },
};
export function placeOf(id: string): Place | null {
  const fam = PIECE[id]?.family ?? id;
  const map: Record<string, PlaceId> = {
    arena: 'colosseum',
    temple: 'temple',
    forge: 'forge',
    market: 'market',
    baths: 'baths',
    home: 'home',
    barracks: 'ludus',
    gate: 'walls',
  };
  return map[fam] ? PLACES[map[fam]] : null;
}

/** Effects over a picture, in its own pixels (docs/PAINTED-UI.md §5). */
export type Effect =
  | { kind: 'glow'; x: number; y: number; w: number; h: number }
  | { kind: 'fire'; x: number; y: number; w: number; h: number }
  | { kind: 'smoke'; x: number; y: number };
export const EFFECTS: Record<string, Effect[]> = {
  'arena-4': [{ kind: 'glow', x: 490, y: 245, w: 330, h: 175 }],
  forge: [
    { kind: 'fire', x: 256, y: 268, w: 70, h: 60 },
    { kind: 'smoke', x: 226, y: 132 },
  ],
};

/**
 * The city a new player starts with (tiles): the tribe's arena, their own home and the
 * barracks that lead into the ludus (Matyáš, 2026-11-27). Everything else is built later.
 */
export const START: [string, number, number][] = [
  ['arena-1', 0, 0],
  ['home-1', -2, 0],
  ['barracks-1', 0, -2],
];

/** Pieces that grow with the game, not by hand: the arena with the tribe, the home with the rank. */
export const GROWS: Record<string, string> = {
  arena: 'Grows with your tribe’s fortress',
  home: 'Upgrade it in Your domus, with your own hours',
};

export type { Placed };
