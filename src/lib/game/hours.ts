/**
 * Hours: time in the gym pays for building (docs/GAME.md §5, Matyáš 2026-11-27). Every verified
 * visit adds its minutes to your house, your ludus and your tribe; the database keeps minutes.
 * Pure — see hours.test.ts.
 */

/** "37 h", "2 h 24 min", "45 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export type HouseItemId = 'hortus' | 'fountain' | 'pergola' | 'lararium' | 'palaestra';

/** Your house (§5a): five levels bought with your own hours. Same numbers as home_cost() in SQL. */
export const HOUSE = {
  maxLevel: 5,
  /** Name of each level, from level 1. */
  names: ['Hut', 'Small stone house', 'Domus', 'Villa', 'Palace'],
  /** Hours each level costs, from level 1 (free). */
  hours: [0, 10, 25, 50, 100],
  /** Things to build by the house: from this level, each for this many hours. */
  itemsFrom: 2,
  itemHours: 5,
} as const;

export const HOUSE_ITEMS: { id: HouseItemId; name: string; text: string }[] = [
  { id: 'hortus', name: 'Garden', text: 'Herbs and vegetables by the door' },
  { id: 'fountain', name: 'Fountain', text: 'A marble fountain' },
  { id: 'pergola', name: 'Pergola', text: 'Shade under a grape vine' },
  { id: 'lararium', name: 'Household shrine', text: 'For the gods of the house' },
  { id: 'palaestra', name: 'Training corner', text: 'Your own small palaestra' },
];

export function houseName(level: number): string {
  return HOUSE.names[Math.min(Math.max(level, 1), HOUSE.maxLevel) - 1];
}

/** Minutes the next level costs, or null at the top. */
export function houseUpgradeMinutes(level: number): number | null {
  if (level >= HOUSE.maxLevel) return null;
  return HOUSE.hours[Math.max(level, 1)] * 60;
}

export interface House {
  level: number;
  /** Your own hours not spent yet, in minutes. */
  minutes: number;
  items: HouseItemId[];
}

/** Why you cannot upgrade now (or null when you can). */
export function houseUpgradeBlock(house: House): string | null {
  const cost = houseUpgradeMinutes(house.level);
  if (cost == null) return 'Your house is at the top level';
  if (house.minutes < cost) return `You need ${formatMinutes(cost)} of your own`;
  return null;
}

/** Why you cannot build this item now (or null when you can). */
export function houseItemBlock(house: House, item: HouseItemId): string | null {
  if (house.items.includes(item)) return 'You have it already';
  if (house.level < HOUSE.itemsFrom) return 'Upgrade your house first';
  if (house.minutes < HOUSE.itemHours * 60) return `You need ${HOUSE.itemHours} h of your own`;
  return null;
}
