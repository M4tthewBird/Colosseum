/**
 * Logging a run: a finished session of kind 'run' with no sets. It goes through putSession, so
 * it is saved offline first and synced like a workout; the heart rate goes to the private
 * session_ratings row.
 */
import { asRun, runResults, type RunLike } from '@/lib/running';
import type { RunPlace, Session } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

export interface RunInput {
  /** Set when editing a run. */
  id?: string;
  startedAt: Date;
  distanceM: number;
  durationS: number;
  place: RunPlace;
  elevationM: number | null;
  avgHr: number | null;
  note: string;
}

/** Saves a new or edited run and returns its id. */
export function saveRun(input: RunInput): string {
  const { userId, sessions } = useData.getState();
  const id = input.id ?? uuid();
  const prev = sessions[id];
  const started = input.startedAt.toISOString();
  const run: RunLike = {
    id,
    started_at: started,
    distance_m: input.distanceM,
    duration_s: input.durationS,
  };
  const others = Object.values(sessions)
    .filter((s) => s.id !== id && s.finished_at)
    .map(asRun)
    .filter((r): r is RunLike => !!r);
  const pr = runResults([...others, run]).get(id)?.pr ?? false;
  const note = input.note.trim();
  const s: Session = {
    id,
    user_id: userId,
    program_day_id: null,
    name: input.place === 'treadmill' ? 'Treadmill run' : 'Run',
    gym_id: prev?.gym_id ?? null,
    started_at: started,
    finished_at: new Date(input.startedAt.getTime() + input.durationS * 1000).toISOString(),
    volume_kg: 0,
    set_count: 0,
    pr_count: pr ? 1 : 0,
    notes: note ? { run: note } : {},
    kind: 'run',
    distance_m: input.distanceM,
    duration_s: input.durationS,
    run_place: input.place,
    elevation_m: input.elevationM,
    avg_hr: input.avgHr,
    rpe: prev?.rpe ?? null,
    feel: prev?.feel ?? null,
    updated_at: nowIso(),
    sets: [],
  };
  useData.getState().putSession(s);
  return id;
}
