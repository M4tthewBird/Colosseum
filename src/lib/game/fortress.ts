/** Fortress buildings of a ludus or a gym. Pure — see fortress.test.ts. */
import { GYM_COST_FACTOR, LUDUS, REPAIR_SHARE } from './config';

export type OwnerKind = 'ludus' | 'gym';

export type BuildingId =
  'bench' | 'rack' | 'cable' | 'platform' | 'palisade' | 'barracks' | 'temple';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  maxLevel: number;
  /** Cost of level 1 for a ludus; level n costs n times this. */
  baseCost: number;
  /** Machines: the exercises they boost (by name). */
  boosts?: RegExp;
  /** Not built by gyms. */
  ludusOnly?: boolean;
  effect: (level: number, owner: OwnerKind) => string;
}

const pct = (n: number) => `+${Math.round(n * 100)} %`;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'bench',
    name: 'Bench',
    maxLevel: 3,
    baseCost: 150,
    boosts: /bench|chest press|push-?up|dip/i,
    effect: (l) => `${pct(0.05 * l)} denarii for bench and chest presses`,
  },
  {
    id: 'rack',
    name: 'Squat rack',
    maxLevel: 3,
    baseCost: 150,
    boosts: /squat|lunge|split squat|step-?up/i,
    effect: (l) => `${pct(0.05 * l)} denarii for squats and lunges`,
  },
  {
    id: 'cable',
    name: 'Cable station',
    maxLevel: 3,
    baseCost: 150,
    boosts: /cable|pulldown|pushdown|face pull|seated row/i,
    effect: (l) => `${pct(0.05 * l)} denarii for cable exercises`,
  },
  {
    id: 'platform',
    name: 'Deadlift platform',
    maxLevel: 3,
    baseCost: 150,
    boosts: /deadlift|hip thrust|good morning|rack pull/i,
    effect: (l) => `${pct(0.05 * l)} denarii for deadlifts and hip thrusts`,
  },
  {
    id: 'palisade',
    name: 'Palisade',
    maxLevel: 5,
    baseCost: 120,
    effect: (l, owner) =>
      owner === 'gym' ? `${pct(0.02 * l)} Bellum score` : `${pct(0.05 * l)} war points in defence`,
  },
  {
    id: 'barracks',
    name: 'Barracks',
    maxLevel: 5,
    baseCost: 200,
    ludusOnly: true,
    effect: (l) => `Room for ${LUDUS.baseMembers + l} members`,
  },
  {
    id: 'temple',
    name: 'Temple',
    maxLevel: 3,
    baseCost: 250,
    effect: () => 'Prestige: shows your records',
  },
];

export function buildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS.find((b) => b.id === id)!;
}

export function buildingsFor(owner: OwnerKind): BuildingDef[] {
  return BUILDINGS.filter((b) => owner === 'ludus' || !b.ludusOnly);
}

export interface Building {
  owner_kind: OwnerKind;
  owner_id: string;
  building: BuildingId;
  level: number;
  /** Being built to this level until ready_at. */
  target_level: number | null;
  ready_at: string | null;
  damaged: boolean;
}

/** Cost of building a level. */
export function levelCost(id: BuildingId, level: number, owner: OwnerKind): number {
  return buildingDef(id).baseCost * level * (owner === 'gym' ? GYM_COST_FACTOR : 1);
}

export function repairCost(id: BuildingId, level: number, owner: OwnerKind): number {
  return Math.ceil(levelCost(id, level, owner) * REPAIR_SHARE);
}

/** Days a level takes to build. */
export function buildDays(level: number): number {
  return level;
}

/** The level that stands now (a finished construction counts from its ready time). */
export function currentLevel(b: Building | undefined, now: Date = new Date()): number {
  if (!b) return 0;
  if (b.target_level && b.ready_at && new Date(b.ready_at).getTime() <= now.getTime())
    return b.target_level;
  return b.level;
}

/** The level that gives its effect: a damaged building gives none. */
export function workingLevel(b: Building | undefined, now: Date = new Date()): number {
  return b?.damaged ? 0 : currentLevel(b, now);
}

export function underConstruction(b: Building | undefined, now: Date = new Date()): boolean {
  return !!b?.target_level && !!b.ready_at && new Date(b.ready_at).getTime() > now.getTime();
}

export function memberLimit(buildings: Building[], now: Date = new Date()): number {
  const barracks = buildings.find((b) => b.building === 'barracks');
  return Math.min(LUDUS.maxMembers, LUDUS.baseMembers + workingLevel(barracks, now));
}

export function palisadeLevel(buildings: Building[], now: Date = new Date()): number {
  return workingLevel(
    buildings.find((b) => b.building === 'palisade'),
    now,
  );
}

/**
 * Extra denarii share for a workout from the machines of the fortresses the user belongs to:
 * +5 % per working level of each machine whose exercise is in the workout.
 */
export function machineBonus(
  buildings: Building[],
  exerciseNames: string[],
  now: Date = new Date(),
): number {
  let bonus = 0;
  for (const b of buildings) {
    const def = buildingDef(b.building);
    if (!def?.boosts) continue;
    const level = workingLevel(b, now);
    if (level && exerciseNames.some((n) => def.boosts!.test(n))) bonus += 0.05 * level;
  }
  return bonus;
}

/** "2 d 4 h", "5 h 10 min", "12 min". */
export function timeLeftText(readyAt: string, now: Date = new Date()): string {
  const ms = Math.max(0, new Date(readyAt).getTime() - now.getTime());
  const min = Math.ceil(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

/** What the fortress looks like: training ground → palisade ludus → stone arena → Colosseum. */
export type FortressStage = 0 | 1 | 2 | 3;

export const FORTRESS_STAGES: { name: string; from: number }[] = [
  { name: 'Training ground', from: 0 },
  { name: 'Wooden fort', from: 3 },
  { name: 'Stone arena', from: 6 },
  { name: 'Colosseum', from: 10 },
];

/** The fortress level: every standing building level added up (damaged ones still stand). */
export function fortressLevel(buildings: Building[], now: Date = new Date()): number {
  return buildings.reduce((sum, b) => sum + currentLevel(b, now), 0);
}

export function fortressStage(level: number): FortressStage {
  let stage = 0;
  FORTRESS_STAGES.forEach((s, i) => {
    if (level >= s.from) stage = i;
  });
  return stage as FortressStage;
}
