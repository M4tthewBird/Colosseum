/**
 * Gym visits: a check-in and a check-out scan of the gym's QR poster, with GPS. The server checks
 * the code's signature and the distance (in_ok / out_ok); everything else follows from the times.
 * Pure — see visits.test.ts. The same rules run in SQL (visit_status in the game update).
 */
import { VISIT } from './config';

export interface GymVisit {
  id: string;
  user_id: string;
  gym_id: string;
  /** The signature part of the scanned code. */
  in_code: string;
  in_at: string;
  in_lat: number | null;
  in_lng: number | null;
  in_acc: number | null;
  out_code: string | null;
  out_at: string | null;
  out_lat: number | null;
  out_lng: number | null;
  out_acc: number | null;
  /** Set by the server: the code was signed for this gym and the scan was close enough. */
  in_ok?: boolean | null;
  out_ok?: boolean | null;
  updated_at: string;
}

/**
 * - open: checked in, not out yet
 * - checking: done, waiting for the server to check the scans (offline or not synced)
 * - verified: both scans fine, 20 min – 4 h
 * - incomplete: no check-out within 3 h, or the check-out scan failed
 * - uncounted: under 20 min or over 4 h
 * - rejected: the check-in code or place was wrong
 */
export type VisitStatus =
  'open' | 'checking' | 'verified' | 'incomplete' | 'uncounted' | 'rejected';

const MIN = 60000;

export function visitMinutes(v: Pick<GymVisit, 'in_at' | 'out_at'>): number | null {
  if (!v.out_at) return null;
  return Math.round((new Date(v.out_at).getTime() - new Date(v.in_at).getTime()) / MIN);
}

export function visitStatus(v: GymVisit, now: Date = new Date()): VisitStatus {
  if (v.in_ok === false) return 'rejected';
  const inAt = new Date(v.in_at).getTime();
  if (!v.out_at) {
    return now.getTime() - inAt < VISIT.autoCloseHours * 60 * MIN ? 'open' : 'incomplete';
  }
  if (v.out_ok === false) return 'incomplete';
  const minutes = visitMinutes(v) ?? 0;
  if (minutes < VISIT.minMinutes || minutes > VISIT.maxMinutes) return 'uncounted';
  if (v.in_ok && v.out_ok) return 'verified';
  return 'checking';
}

/** The end of a visit: the check-out, else when it closes by itself. */
export function visitEnd(v: GymVisit): Date {
  if (v.out_at) return new Date(v.out_at);
  return new Date(new Date(v.in_at).getTime() + VISIT.autoCloseHours * 60 * MIN);
}

export type Verification = 'verified' | 'incomplete' | null;

/**
 * How a workout was verified: by the visit it started in. Visits still being checked count as
 * unverified until the server confirms them.
 */
export function sessionVerification(
  startedAt: string,
  visits: GymVisit[],
  now: Date = new Date(),
): Verification {
  const t = new Date(startedAt).getTime();
  let found: Verification = null;
  for (const v of visits) {
    const from = new Date(v.in_at).getTime() - VISIT.earlyMinutes * MIN;
    if (t < from || t > visitEnd(v).getTime()) continue;
    const st = visitStatus(v, now);
    if (st === 'verified') return 'verified';
    if (st === 'incomplete' && v.in_ok) found = 'incomplete';
  }
  return found;
}

/** The visit still open right now, if any. */
export function openVisit(visits: GymVisit[], now: Date = new Date()): GymVisit | null {
  return (
    visits
      .filter((v) => visitStatus(v, now) === 'open')
      .sort((a, b) => b.in_at.localeCompare(a.in_at))[0] ?? null
  );
}

export interface VisitCode {
  gymId: string;
  sig: string;
}

/** Reads ".../visit/<gym id>.<signature>" (the poster's link). */
export function parseVisitCode(text: string): VisitCode | null {
  const m = /\/visit\/([0-9a-f-]{36})\.([A-Za-z0-9_-]{6,64})(?:[/?#]|$)/i.exec(text.trim());
  return m ? { gymId: m[1].toLowerCase(), sig: m[2] } : null;
}

/** The path the poster's link opens. */
export function visitPath(gymId: string, sig: string): string {
  return `/visit/${gymId}.${sig}`;
}

/** Metres between two points (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "1 h 05 min", "42 min". */
export function minutesText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export const STATUS_TEXT: Record<VisitStatus, string> = {
  open: 'Checked in',
  checking: 'Checking…',
  verified: 'Verified',
  incomplete: 'Incomplete',
  uncounted: 'Not counted',
  rejected: 'Not verified',
};
