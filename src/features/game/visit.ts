/** Scanning a gym poster: the first scan checks in, the next one at the same gym checks out. */
import { currentPosition } from '@/lib/geo';
import { openVisit, type GymVisit, type VisitCode } from '@/lib/game/visits';
import { uuid, nowIso } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { useGame } from '@/stores/game';
import { demoCheckVisit } from './api';

export type ScanResult =
  | { kind: 'in'; visit: GymVisit }
  | { kind: 'out'; visit: GymVisit }
  | { kind: 'again'; visit: GymVisit };

/** A second scan this soon after checking in is the same scan again, not a check-out. */
const REPEAT_MS = 2 * 60000;

export async function scanVisit(code: VisitCode, now: Date = new Date()): Promise<ScanResult> {
  const visits = Object.values(useGame.getState().visits);
  const open = openVisit(visits, now);
  if (
    open &&
    open.gym_id === code.gymId &&
    now.getTime() - new Date(open.in_at).getTime() < REPEAT_MS
  )
    return { kind: 'again', visit: open };

  const pos = await currentPosition();
  const { saveVisit } = useGame.getState();

  if (open && open.gym_id === code.gymId) {
    const out = demoCheckVisit({
      ...open,
      out_code: code.sig,
      out_at: now.toISOString(),
      out_lat: pos.lat,
      out_lng: pos.lng,
      out_acc: pos.acc,
    });
    saveVisit(out);
    return { kind: 'out', visit: out };
  }

  const visit = demoCheckVisit({
    id: uuid(),
    user_id: useData.getState().userId,
    gym_id: code.gymId,
    in_code: code.sig,
    in_at: now.toISOString(),
    in_lat: pos.lat,
    in_lng: pos.lng,
    in_acc: pos.acc,
    out_code: null,
    out_at: null,
    out_lat: null,
    out_lng: null,
    out_acc: null,
    in_ok: null,
    out_ok: null,
    updated_at: nowIso(),
  });
  saveVisit(visit);
  return { kind: 'in', visit };
}
