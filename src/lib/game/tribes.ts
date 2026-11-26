/**
 * Tribe attacks and the city map: a gym's tribe attacks another tribe in the same city, wins its
 * territory, spoils from its treasury and damages its walls. The server settles the real wars
 * (settle_tribe_war); these mirror it for demo mode and the screens. Pure — see tribes.test.ts.
 */
import { TRIBE_WAR } from './config';
import { gearWarBonus } from './gear';

export interface TribeMember {
  /** Verified workouts in the last 14 days. */
  workouts: number;
  gearPower: number;
}

/** Active members: trained (verified) in the last 14 days. */
export function activeMembers(members: TribeMember[]): TribeMember[] {
  return members.filter((m) => m.workouts > 0);
}

/** A tribe's strength: points per recent verified workout plus the gear of its active members. */
export function tribeStrength(members: TribeMember[]): number {
  return activeMembers(members).reduce(
    (sum, m) => sum + m.workouts * TRIBE_WAR.strengthPerWorkout + m.gearPower,
    0,
  );
}

/** The side's gear bonus: the average bonus of its active members. */
export function sideGearBonus(gearPowers: number[]): number {
  if (!gearPowers.length) return 0;
  const avg = gearPowers.reduce((s, p) => s + gearWarBonus(p), 0) / gearPowers.length;
  return Math.round(avg * 1000) / 1000;
}

export interface TribeSide {
  /** Raw war points (same as a ludus war: see warPoints). */
  points: number;
  active: number;
  gearBonus: number;
  /** Defender only. */
  palisade?: number;
  revenge?: boolean;
}

/** Points per active member (at least 3), with gear, walls and the revenge bonus. */
export function tribeScore(side: TribeSide): number {
  const per = side.points / Math.max(TRIBE_WAR.minActive, side.active);
  const bonus =
    1 +
    side.gearBonus +
    TRIBE_WAR.wallBonus * (side.palisade ?? 0) +
    (side.revenge ? TRIBE_WAR.revengeBonus : 0);
  return Math.round(per * bonus * 10) / 10;
}

export function tribeSpoils(loserTreasury: number): number {
  return Math.min(
    TRIBE_WAR.maxSpoils,
    Math.floor(Math.max(0, loserTreasury) * TRIBE_WAR.spoilsShare),
  );
}

export interface TribeWarTimes {
  declared_at: string;
  starts_at: string;
  ends_at: string;
}

export function tribeWarTimes(declared: Date): TribeWarTimes {
  const starts = new Date(declared.getTime() + TRIBE_WAR.warningHours * 3600000);
  const ends = new Date(starts.getTime() + TRIBE_WAR.days * 86400000);
  return {
    declared_at: declared.toISOString(),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
  };
}

export type TribeWarPhase = 'warning' | 'battle' | 'over';

export function tribeWarPhase(w: TribeWarTimes, now: Date = new Date()): TribeWarPhase {
  if (now.getTime() < new Date(w.starts_at).getTime()) return 'warning';
  if (now.getTime() < new Date(w.ends_at).getTime()) return 'battle';
  return 'over';
}

/** Until when a lost defence can be answered with a revenge attack. */
export function revengeUntil(endsAt: string): Date {
  return new Date(new Date(endsAt).getTime() + TRIBE_WAR.revengeHours * 3600000);
}

/** "5 h 42 min", "2 d 3 h", "12 min". */
export function countdownText(to: string | Date, now: Date = new Date()): string {
  const ms = Math.max(0, new Date(to).getTime() - now.getTime());
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

// ───────────── The map ─────────────

export interface MapGym {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Fortress level (all building levels together). */
  level: number;
}

export interface MapPoint {
  id: string;
  x: number;
  y: number;
  /** Radius of the territory around the gym. */
  r: number;
}

/** Territory radius grows with the fortress level. */
export function influenceRadius(level: number, size: number): number {
  return Math.round(size * (0.07 + Math.min(level, 15) * 0.006));
}

/**
 * Places gyms on a square map of `size`: real positions scaled to fit, gyms without a position
 * on a ring around the middle. Points keep a margin so their territory stays on the map.
 */
export function placeGyms(gyms: MapGym[], size: number): MapPoint[] {
  const known = gyms.filter((g) => g.lat != null && g.lng != null);
  const margin = size * 0.16;
  const inner = size - 2 * margin;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const g of known) {
    minLat = Math.min(minLat, g.lat!);
    maxLat = Math.max(maxLat, g.lat!);
    minLng = Math.min(minLng, g.lng!);
    maxLng = Math.max(maxLng, g.lng!);
  }
  // Longitude degrees are shorter than latitude ones away from the equator.
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)) || 1;
  const span = Math.max(maxLat - minLat || 0, (maxLng - minLng || 0) * k, 1e-6);
  const unknown = gyms.filter((g) => g.lat == null || g.lng == null);
  return gyms.map((g) => {
    const r = influenceRadius(g.level, size);
    if (g.lat != null && g.lng != null && known.length > 1) {
      const x = margin + (((g.lng - minLng) * k) / span) * inner;
      const y = margin + ((maxLat - g.lat) / span) * inner;
      // Center the smaller dimension.
      const dx = (inner - (((maxLng - minLng) * k) / span) * inner) / 2;
      const dy = (inner - ((maxLat - minLat) / span) * inner) / 2;
      return { id: g.id, x: Math.round(x + dx), y: Math.round(y + dy), r };
    }
    const i = unknown.indexOf(g);
    if (i < 0) return { id: g.id, x: size / 2, y: size / 2, r };
    const a = (i / Math.max(1, unknown.length)) * Math.PI * 2 - Math.PI / 2;
    const ring = known.length ? size * 0.42 : unknown.length > 1 ? size * 0.32 : 0;
    return {
      id: g.id,
      x: Math.round(size / 2 + Math.cos(a) * ring),
      y: Math.round(size / 2 + Math.sin(a) * ring),
      r,
    };
  });
}

/** Distance in km between two positions (haversine), one decimal. */
export function distanceKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export interface CityTribe {
  id: string;
  level: number;
  /** Territories the tribe holds (its own counts while nobody took it). */
  territories: number;
}

/** City ranking: most territories, then the highest fortress. 1-based places by id. */
export function cityPlaces(tribes: CityTribe[]): Map<string, number> {
  const sorted = [...tribes].sort(
    (a, b) => b.territories - a.territories || b.level - a.level || a.id.localeCompare(b.id),
  );
  return new Map(sorted.map((t, i) => [t.id, i + 1]));
}

export type Strength = 'weaker' | 'even' | 'stronger';

/** How another tribe compares with mine (within 10 % counts as even). */
export function compareStrength(mine: number, theirs: number): Strength {
  if (theirs < mine * 0.9) return 'weaker';
  if (theirs > mine * 1.1) return 'stronger';
  return 'even';
}
