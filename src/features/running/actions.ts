/**
 * Logging a run, ride or swim: a finished session of that kind with no sets. It goes through
 * putSession, so it is saved offline first and synced like a workout; the heart rate goes to the
 * private session_ratings row.
 */
import { asCardio, cardioResults, type CardioLike, type Sport } from '@/lib/cardio';
import type { RunPlace, Session } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

export interface CardioInput {
  sport: Sport;
  /** Set when editing. */
  id?: string;
  startedAt: Date;
  distanceM: number;
  durationS: number;
  place: RunPlace;
  elevationM: number | null;
  avgHr: number | null;
  note: string;
}

/** "Run", "Treadmill run", "Ride", "Indoor ride", "Swim", "Open water swim". */
export function cardioName(sport: Sport, place: RunPlace | null | undefined): string {
  if (sport === 'ride') return place === 'indoor' ? 'Indoor ride' : 'Ride';
  if (sport === 'swim') return place === 'open' ? 'Open water swim' : 'Swim';
  return place === 'treadmill' ? 'Treadmill run' : 'Run';
}

/** Saves a new or edited run, ride or swim and returns its id. */
export function saveCardio(input: CardioInput): string {
  const { userId, sessions } = useData.getState();
  const id = input.id ?? uuid();
  const prev = sessions[id];
  const started = input.startedAt.toISOString();
  const mine: CardioLike = {
    id,
    sport: input.sport,
    started_at: started,
    distance_m: input.distanceM,
    duration_s: input.durationS,
  };
  const others = Object.values(sessions)
    .filter((s) => s.id !== id && s.finished_at)
    .map(asCardio)
    .filter((c): c is CardioLike => !!c && c.sport === input.sport);
  const pr = cardioResults([...others, mine]).get(id)?.pr ?? false;
  const note = input.note.trim();
  const s: Session = {
    id,
    user_id: userId,
    program_day_id: null,
    name: cardioName(input.sport, input.place),
    gym_id: prev?.gym_id ?? null,
    started_at: started,
    finished_at: new Date(input.startedAt.getTime() + input.durationS * 1000).toISOString(),
    volume_kg: 0,
    set_count: 0,
    pr_count: pr ? 1 : 0,
    notes: note ? { run: note } : {},
    kind: input.sport,
    distance_m: input.distanceM,
    duration_s: input.durationS,
    run_place: input.place,
    elevation_m: input.sport === 'swim' ? null : input.elevationM,
    avg_hr: input.avgHr,
    rpe: prev?.rpe ?? null,
    feel: prev?.feel ?? null,
    updated_at: nowIso(),
    sets: [],
  };
  useData.getState().putSession(s);
  return id;
}
