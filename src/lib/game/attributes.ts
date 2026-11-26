/** The character sheet (0–99 each) and the cell, the cosmetic home. Pure — see attributes.test.ts. */
import { addDays, startOfWeek } from '../dates';
import { e1rm } from '../formulas';
import type { Session } from '../types';
import { big3Of, qualifies, workingSets } from './engine';
import type { RankId } from './levels';

export interface Attributes {
  /** Null without bodyweight and sex (DOTS needs both). */
  strength: number | null;
  endurance: number;
  discipline: number;
}

const clamp99 = (n: number) => Math.max(0, Math.min(99, Math.round(n)));

/** Best squat + bench + deadlift e1RM (kg). */
export function big3Total(sessions: Session[], exerciseName: (id: string) => string | undefined) {
  const best = new Map<string, number>();
  for (const s of sessions) {
    if (!s.finished_at) continue;
    for (const x of workingSets(s)) {
      const lift = big3Of(exerciseName(x.exercise_id));
      if (!lift || x.drop_of || x.reps <= 0) continue;
      best.set(lift, Math.max(best.get(lift) ?? 0, e1rm(x.weight_kg, x.reps)));
    }
  }
  return [...best.values()].reduce((a, b) => a + b, 0);
}

export function attributes(
  sessions: Session[],
  exerciseName: (id: string) => string | undefined,
  dotsCoefficient: number | null,
  weeklyTarget: number,
  now: Date = new Date(),
): Attributes {
  const done = sessions.filter(qualifies);
  const since = addDays(now, -90).getTime();
  const sets = done
    .filter((s) => new Date(s.started_at).getTime() >= since)
    .reduce((n, s) => n + workingSets(s).length, 0);

  const thisWeek = startOfWeek(now).getTime();
  const counts = new Map<number, number>();
  for (const s of done) {
    const w = startOfWeek(new Date(s.started_at)).getTime();
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let hit = 0;
  for (let i = 1; i <= 12; i++) {
    const w = addDays(new Date(thisWeek), -7 * i).getTime();
    if ((counts.get(w) ?? 0) >= Math.max(1, weeklyTarget)) hit++;
  }

  return {
    strength:
      dotsCoefficient == null
        ? null
        : clamp99((big3Total(sessions, exerciseName) * dotsCoefficient) / 5),
    endurance: clamp99(sets / 12),
    discipline: clamp99((hit / 12) * 99),
  };
}

export interface CellItem {
  id: string;
  name: string;
  level: number;
}

/** Things in the cell, each opening at a level. */
export const CELL_ITEMS: CellItem[] = [
  { id: 'bed', name: 'Straw bed', level: 1 },
  { id: 'lamp', name: 'Oil lamp', level: 3 },
  { id: 'palus', name: 'Training post', level: 5 },
  { id: 'shield', name: 'Shield', level: 8 },
  { id: 'helmet', name: 'Helmet', level: 12 },
  { id: 'trident', name: 'Trident', level: 16 },
  { id: 'amphora', name: 'Amphora', level: 20 },
  { id: 'armour', name: 'Armour', level: 25 },
  { id: 'wreath', name: 'Laurel wreath', level: 30 },
  { id: 'rudis', name: 'The rudis', level: 40 },
  { id: 'bust', name: 'Marble bust', level: 50 },
];

/** The room grows with the rank. */
export const CELL_ROOMS: Record<RankId, string> = {
  tiro: 'Cell',
  gladiator: 'Barracks room',
  veteranus: 'Private room',
  primus: 'Quarters',
  rudiarius: 'Villa',
};

export function cellItems(level: number): { item: CellItem; unlocked: boolean }[] {
  return CELL_ITEMS.map((item) => ({ item, unlocked: level >= item.level }));
}

/** The picture of the home: hut → wooden house → stone domus → villa. */
export type HomeStage = 0 | 1 | 2 | 3;

const HOME_STAGES: Record<RankId, HomeStage> = {
  tiro: 0,
  gladiator: 1,
  veteranus: 2,
  primus: 2,
  rudiarius: 3,
};

export function homeStage(rank: RankId): HomeStage {
  return HOME_STAGES[rank];
}
