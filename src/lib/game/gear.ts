/**
 * Gear: the pieces a gladiator unlocks and wears. Every piece is earned by training: bought with
 * denarii, or opened by a level, verified workouts or a league; never for money. Gear power adds
 * up to GEAR.maxWarBonus to a member's points in tribe attacks. Pure — see gear.test.ts.
 */
import { GEAR } from './config';
import type { LeagueId } from './levels';

export type GearSlot = 'helmet' | 'weapon' | 'shield' | 'guard' | 'armour';

export const GEAR_SLOTS: { id: GearSlot; name: string; plural: string }[] = [
  { id: 'helmet', name: 'Helmet', plural: 'Helmets' },
  { id: 'weapon', name: 'Weapon', plural: 'Weapons' },
  { id: 'shield', name: 'Shield', plural: 'Shields' },
  { id: 'guard', name: 'Guards', plural: 'Guards' },
  { id: 'armour', name: 'Armour', plural: 'Armour' },
];

export type GearUnlock =
  | { kind: 'start' }
  | { kind: 'denarii'; price: number }
  | { kind: 'level'; level: number }
  | { kind: 'verified'; count: number }
  | { kind: 'league'; league: LeagueId };

export interface GearItem {
  id: string;
  slot: GearSlot;
  name: string;
  power: number;
  unlock: GearUnlock;
}

const item = (
  slot: GearSlot,
  id: string,
  name: string,
  power: number,
  unlock: GearUnlock,
): GearItem => ({ id, slot, name, power, unlock });
const start: GearUnlock = { kind: 'start' };
const den = (price: number): GearUnlock => ({ kind: 'denarii', price });
const lv = (level: number): GearUnlock => ({ kind: 'level', level });
const ver = (count: number): GearUnlock => ({ kind: 'verified', count });

/**
 * The catalog. Ids match the art in components/art/svgsF.ts (gear_<id>) and the server's
 * gear_power() in supabase/updates/2026-11-14-city.sql.
 */
export const GEAR_ITEMS: GearItem[] = [
  item('helmet', 'helmet_galea', 'Galea', 40, start),
  item('helmet', 'helmet_murmillo', 'Murmillo', 60, den(200)),
  item('helmet', 'helmet_secutor', 'Secutor', 70, den(320)),
  item('helmet', 'helmet_thraex', 'Thraex', 70, lv(15)),
  item('helmet', 'helmet_hoplomachus', 'Hoplomachus', 75, ver(50)),
  item('helmet', 'helmet_provocator', 'Provocator', 80, lv(25)),
  item('helmet', 'helmet_galea_gold', 'Golden galea', 90, { kind: 'league', league: 'gold' }),
  item('helmet', 'helmet_laurel', 'Laurel wreath', 100, lv(40)),

  item('weapon', 'weapon_rudis', 'Rudis', 20, start),
  item('weapon', 'weapon_pugio', 'Pugio', 50, den(100)),
  item('weapon', 'weapon_sica', 'Sica', 60, lv(10)),
  item('weapon', 'weapon_net', 'Rete', 65, lv(20)),
  item('weapon', 'weapon_trident', 'Fuscina', 70, ver(30)),
  item('weapon', 'weapon_hasta', 'Hasta', 75, den(250)),
  item('weapon', 'weapon_gladius', 'Gladius', 80, den(150)),
  item('weapon', 'weapon_two_gladii', 'Two gladii', 100, ver(75)),

  item('shield', 'shield_parmula', 'Parmula', 30, start),
  item('shield', 'shield_parma', 'Parma', 50, den(120)),
  item('shield', 'shield_bronze', 'Bronze shield', 60, lv(8)),
  item('shield', 'shield_scutum', 'Scutum', 110, den(350)),

  item('guard', 'guard_fasciae', 'Fasciae', 20, start),
  item('guard', 'guard_ocreae', 'Ocreae', 60, lv(12)),
  item('guard', 'guard_galerus', 'Galerus', 65, ver(40)),
  item('guard', 'guard_manica', 'Manica', 70, den(180)),

  item('armour', 'armour_tunic', 'Tunic', 10, start),
  item('armour', 'armour_exomis', 'Exomis', 30, den(80)),
  item('armour', 'armour_subligaculum', 'Subligaculum', 40, lv(5)),
  item('armour', 'armour_straps', 'Leather straps', 60, ver(25)),
  item('armour', 'armour_leopard', 'Leopard skin', 70, den(300)),
  item('armour', 'armour_cardiophylax', 'Cardiophylax', 80, lv(18)),
  item('armour', 'armour_cloak', 'Red cloak', 90, lv(25)),
  item('armour', 'armour_lorica', 'Lorica', 110, { kind: 'league', league: 'imperator' }),
];

export function gearItem(id: string | null | undefined): GearItem | undefined {
  return GEAR_ITEMS.find((g) => g.id === id);
}

export function gearInSlot(slot: GearSlot): GearItem[] {
  return GEAR_ITEMS.filter((g) => g.slot === slot);
}

export type Loadout = Partial<Record<GearSlot, string | null>>;

/** What a new gladiator wears: the start piece of each slot. */
export const START_LOADOUT = Object.fromEntries(
  GEAR_SLOTS.map((s) => [s.id, gearInSlot(s.id).find((g) => g.unlock.kind === 'start')!.id]),
) as Record<GearSlot, string>;

/** The piece worn in a slot; an empty slot wears its start piece. */
export function worn(loadout: Loadout, slot: GearSlot): GearItem {
  return gearItem(loadout[slot]) ?? gearItem(START_LOADOUT[slot])!;
}

/** The strongest gear there is, one piece per slot. */
export const MAX_POWER = GEAR_SLOTS.reduce(
  (sum, s) => sum + Math.max(...gearInSlot(s.id).map((g) => g.power)),
  0,
);

export function gearPower(loadout: Loadout): number {
  return GEAR_SLOTS.reduce((sum, s) => sum + worn(loadout, s.id).power, 0);
}

/** A member's extra share of war points from gear, 0 – GEAR.maxWarBonus. */
export function gearWarBonus(power: number): number {
  return Math.round(GEAR.maxWarBonus * Math.min(1, Math.max(0, power) / MAX_POWER) * 1000) / 1000;
}

export interface GearProgress {
  level: number;
  verified: number;
  /** The best league ever reached. */
  league: LeagueId;
  /** Bought with denarii. */
  bought: ReadonlySet<string>;
}

const LEAGUE_ORDER: LeagueId[] = ['bronze', 'silver', 'gold', 'imperator'];

/** Whether the gladiator owns a piece (bought, or opened by training). */
export function owns(g: GearItem, p: GearProgress): boolean {
  const u = g.unlock;
  switch (u.kind) {
    case 'start':
      return true;
    case 'denarii':
      return p.bought.has(g.id);
    case 'level':
      return p.level >= u.level;
    case 'verified':
      return p.verified >= u.count;
    case 'league':
      return LEAGUE_ORDER.indexOf(p.league) >= LEAGUE_ORDER.indexOf(u.league);
  }
}

/** "320 denarii", "From level 15", "50 verified workouts", "Gold league". */
export function unlockText(u: GearUnlock): string {
  switch (u.kind) {
    case 'start':
      return 'From the start';
    case 'denarii':
      return `${u.price} denarii`;
    case 'level':
      return `From level ${u.level}`;
    case 'verified':
      return `${u.count} verified workouts`;
    case 'league':
      return u.league === 'imperator' ? 'Imperator’s Arena' : 'Gold league';
  }
}

/** The best league reached in any season. */
export function bestLeague(leagues: LeagueId[]): LeagueId {
  let best = 0;
  for (const l of leagues) best = Math.max(best, LEAGUE_ORDER.indexOf(l));
  return LEAGUE_ORDER[best];
}

/** The slot where the strongest piece would add the most power. */
export function weakestSlot(loadout: Loadout): { slot: GearSlot; gain: number } {
  let out = { slot: GEAR_SLOTS[0].id, gain: -1 };
  for (const s of GEAR_SLOTS) {
    const gain = Math.max(...gearInSlot(s.id).map((g) => g.power)) - worn(loadout, s.id).power;
    if (gain > out.gain) out = { slot: s.id, gain };
  }
  return out;
}
