/**
 * The training grounds of a ludus and of a tribe, and your own house, as grids (Matyáš,
 * 2026-11-27: "build or buy what I want"). The heart stands at (0, 0): the ludus's school or the
 * tribe's arena (3×3), your house (2×2). Everything else goes next to something already built,
 * paid with hours: the fortress buildings (they keep their levels and effects, fortress.ts), drill
 * equipment, walls and decoration. Same catalogue as ground_minutes() / ground_size() in SQL
 * (supabase/updates/2026-11-27-grounds.sql). Pure — see grounds.test.ts.
 */
import { GYM_COST_FACTOR } from './config';
import { currentLevel, type Building, type BuildingId } from './fortress';
import { fits, type Placed } from './cityGrid';

export type GroundKind = 'ludus' | 'gym' | 'home';

export type GroundGroup = 'buildings' | 'drill' | 'walls' | 'decor' | 'house';

export interface GroundItem {
  id: string;
  name: string;
  size: number;
  /** Hours for a ludus or your house; a tribe pays GYM_COST_FACTOR times as much. */
  hours: number;
  group: GroundGroup;
  /** Where it can be built. */
  kinds: GroundKind[];
  /** Only one (the things by your house). */
  once?: boolean;
}

const LUDUS: GroundKind[] = ['ludus', 'gym'];
const ALL: GroundKind[] = ['ludus', 'gym', 'home'];

/** Everything that can be bought on a grid, besides the fortress buildings. */
export const GROUND_ITEMS: GroundItem[] = [
  // drill equipment
  { id: 'palus', name: 'Palus', size: 1, hours: 2, group: 'drill', kinds: ALL },
  { id: 'weapon-rack', name: 'Weapon rack', size: 1, hours: 2, group: 'drill', kinds: LUDUS },
  { id: 'brazier', name: 'Brazier', size: 1, hours: 2, group: 'drill', kinds: ALL },
  { id: 'water-trough', name: 'Water trough', size: 1, hours: 3, group: 'drill', kinds: ALL },
  { id: 'halteres-1', name: 'Stone dumbbells', size: 1, hours: 3, group: 'drill', kinds: ALL },
  { id: 'halteres-2', name: 'Iron dumbbells', size: 1, hours: 6, group: 'drill', kinds: LUDUS },
  { id: 'halteres-3', name: 'Bronze dumbbells', size: 1, hours: 10, group: 'drill', kinds: LUDUS },
  { id: 'pullup-1', name: 'Pull-up bar', size: 1, hours: 3, group: 'drill', kinds: ALL },
  { id: 'pullup-2', name: 'Pull-up frame', size: 1, hours: 6, group: 'drill', kinds: LUDUS },
  {
    id: 'pullup-3',
    name: 'Marble pull-up frame',
    size: 1,
    hours: 10,
    group: 'drill',
    kinds: LUDUS,
  },
  // walls: sections run across a tile, / or \, and towers join them
  { id: 'wall-1-a', name: 'Palisade /', size: 1, hours: 1, group: 'walls', kinds: LUDUS },
  { id: 'wall-1-b', name: 'Palisade \\', size: 1, hours: 1, group: 'walls', kinds: LUDUS },
  { id: 'wall-1-tower', name: 'Watchtower', size: 1, hours: 3, group: 'walls', kinds: LUDUS },
  { id: 'wall-2-a', name: 'Stone wall /', size: 1, hours: 2, group: 'walls', kinds: LUDUS },
  { id: 'wall-2-b', name: 'Stone wall \\', size: 1, hours: 2, group: 'walls', kinds: LUDUS },
  { id: 'wall-2-tower', name: 'Stone tower', size: 1, hours: 5, group: 'walls', kinds: LUDUS },
  { id: 'wall-3-a', name: 'Fortified wall /', size: 1, hours: 3, group: 'walls', kinds: LUDUS },
  { id: 'wall-3-b', name: 'Fortified wall \\', size: 1, hours: 3, group: 'walls', kinds: LUDUS },
  { id: 'wall-3-tower', name: 'Fortified tower', size: 1, hours: 8, group: 'walls', kinds: LUDUS },
  // decoration
  { id: 'tree-cypress', name: 'Cypresses', size: 1, hours: 1, group: 'decor', kinds: ALL },
  { id: 'tree-pine', name: 'Stone pine', size: 1, hours: 1, group: 'decor', kinds: ALL },
  { id: 'banner', name: 'Banner', size: 1, hours: 1, group: 'decor', kinds: ALL },
  { id: 'amphorae', name: 'Amphorae', size: 1, hours: 1, group: 'decor', kinds: ALL },
  { id: 'cart', name: 'Cart', size: 1, hours: 1, group: 'decor', kinds: ALL },
  { id: 'statue', name: 'Statue', size: 1, hours: 5, group: 'decor', kinds: ALL },
  { id: 'arch', name: 'Triumphal arch', size: 2, hours: 20, group: 'decor', kinds: ['home'] },
  { id: 'baths', name: 'Private baths', size: 2, hours: 30, group: 'decor', kinds: ['home'] },
  // the things by your house (once each)
  { id: 'hortus', name: 'Garden', size: 1, hours: 5, group: 'house', kinds: ['home'], once: true },
  {
    id: 'fountain',
    name: 'Fountain',
    size: 1,
    hours: 5,
    group: 'house',
    kinds: ['home'],
    once: true,
  },
  {
    id: 'pergola',
    name: 'Pergola',
    size: 1,
    hours: 5,
    group: 'house',
    kinds: ['home'],
    once: true,
  },
  {
    id: 'lararium',
    name: 'Household shrine',
    size: 1,
    hours: 5,
    group: 'house',
    kinds: ['home'],
    once: true,
  },
  {
    id: 'palaestra',
    name: 'Training corner',
    size: 1,
    hours: 5,
    group: 'house',
    kinds: ['home'],
    once: true,
  },
];

export const GROUND_ITEM = Object.fromEntries(GROUND_ITEMS.map((x) => [x.id, x]));

/** The fortress buildings on a grid: their size there. */
export const BUILDING_SIZE: Record<BuildingId, number> = {
  bench: 1,
  rack: 1,
  cable: 1,
  platform: 1,
  palisade: 2,
  barracks: 2,
  temple: 2,
};

export const isBuilding = (id: string): id is BuildingId => id in BUILDING_SIZE;

/** The heart of a grid, at (0, 0). */
export const ROOT = '__root';
export const rootSize = (kind: GroundKind) => (kind === 'home' ? 2 : 3);

export function groundSize(kind: GroundKind, id: string): number {
  if (id === ROOT) return rootSize(kind);
  if (isBuilding(id)) return BUILDING_SIZE[id];
  return GROUND_ITEM[id]?.size ?? 1;
}

/** Minutes a piece costs on this grid, or null when it cannot be built there. */
export function groundMinutes(kind: GroundKind, id: string): number | null {
  const item = GROUND_ITEM[id];
  if (!item || !item.kinds.includes(kind)) return null;
  return item.hours * 60 * (kind === 'gym' ? GYM_COST_FACTOR : 1);
}

/** Which picture a building shows at its level (3 painted stages; palisade as the gate). */
export function buildingPicture(b: Building | undefined, now = new Date()): string {
  if (!b) return 'plot-1';
  const level = currentLevel(b, now);
  const size = BUILDING_SIZE[b.building];
  if (level === 0) return `scaffold-${size}`;
  if (b.building === 'palisade') return `gate-${level >= 5 ? 3 : level >= 3 ? 2 : 1}`;
  if (b.building === 'barracks') return `barracks-${level >= 4 ? 3 : level >= 2 ? 2 : 1}`;
  return `${b.building}-${Math.min(3, level)}`;
}

/** The ludus's school by its fortress stage (0–3), the tribe's arena, or your house. */
export function rootPicture(kind: GroundKind, stage: number, houseLevel: number): string {
  if (kind === 'home') return `home-${Math.min(5, Math.max(1, houseLevel))}`;
  if (kind === 'gym') return `arena-${Math.min(3, Math.max(0, stage)) + 1}`;
  return `ludus-${stage >= 3 ? 3 : stage >= 2 ? 2 : 1}`;
}

/** A piece as the server keeps it. */
export interface GroundPiece {
  id: string;
  piece: string;
  i: number;
  j: number;
}

/** The grid as cityGrid sees it: the heart (key 0) and every piece (keys from 1). */
export function groundLayout(pieces: GroundPiece[]): Placed[] {
  return [
    { key: 0, id: ROOT, i: 0, j: 0 },
    ...pieces.map((p, n) => ({ key: n + 1, id: p.piece, i: p.i, j: p.j })),
  ];
}

/** How far from the heart a piece may stand (the server's limit too). */
export const GROUND_REACH = 15;

/** Can this piece stand at (i, j)? Free tiles, touching what is built, within reach. */
export function groundFits(
  kind: GroundKind,
  pieces: GroundPiece[],
  id: string,
  i: number,
  j: number,
  without?: string,
): boolean {
  const n = groundSize(kind, id);
  if (Math.abs(i) > GROUND_REACH || Math.abs(j) > GROUND_REACH) return false;
  if (Math.abs(i + n - 1) > GROUND_REACH || Math.abs(j + n - 1) > GROUND_REACH) return false;
  const list = groundLayout(pieces.filter((p) => p.id !== without));
  return fits(list, (x) => groundSize(kind, x), id, i, j);
}

/** Why it cannot be bought now, or null when it can. */
export function buyBlock(
  kind: GroundKind,
  pieces: GroundPiece[],
  id: string,
  minutesLeft: number,
): string | null {
  const cost = groundMinutes(kind, id);
  if (cost == null) return 'It cannot be built here';
  if (GROUND_ITEM[id]?.once && pieces.some((p) => p.piece === id)) return 'You have it already';
  if (minutesLeft < cost) return `Needs ${Math.ceil(cost / 60)} h`;
  return null;
}
