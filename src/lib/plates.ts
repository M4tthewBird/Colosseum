/** Which plates to load on a barbell. Pure — see plates.test.ts. */
import { isMachine } from './exerciseName';

/** What a normal gym has, heaviest first (kg). */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BARS = [20, 15, 10] as const;
export type BarKg = (typeof BARS)[number];

export interface PlateLoad {
  /** Plates on each side, heaviest first. */
  perSide: number[];
  /** What the plates cannot reach (a total, 0 when the weight is exact). */
  short: number;
}

/** Heaviest plates first. Null when the weight is below the bar. */
export function platesFor(totalKg: number, barKg: number): PlateLoad | null {
  if (totalKg < barKg) return null;
  let side = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const p of PLATES) {
    while (side >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  return { perSide, short: Math.round(side * 2 * 100) / 100 };
}

const NOT_A_BAR =
  /dumbbell|cable|band|kettlebell|push up|pull up|chin up|dip|sissy|goblet|bulgarian|nordic/i;
const BARBELL =
  /barbell|bench press|squat|deadlift|overhead press|good morning|hip thrust|jm press|rack pull|pendlay/i;

/** True for lifts done with a loaded barbell, going by the exercise's name. */
export function isBarbellLift(name: string): boolean {
  return BARBELL.test(name) && !NOT_A_BAR.test(name) && !isMachine(name);
}
