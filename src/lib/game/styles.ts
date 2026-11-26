/**
 * Fighting styles: the gladiator's look and the kind of training that earns a bonus. Chosen on
 * Forge → Style, changed once a season. Pure — see styles.test.ts. Rules in docs/GAME.md.
 */
import { mainGroup } from '../muscleGroups';
import type { SetEntry } from '../types';
import { STYLE } from './config';

export type StyleId =
  'murmillo' | 'thraex' | 'retiarius' | 'secutor' | 'hoplomachus' | 'bestiarius';

export interface FightingStyle {
  id: StyleId;
  name: string;
  /** What it rewards, short: "Strength · heavy compound lifts". */
  trait: string;
  /** When a workout earns the bonus. */
  rule: string;
}

export const STYLES: FightingStyle[] = [
  {
    id: 'murmillo',
    name: 'Murmillo',
    trait: 'Strength · heavy compound lifts',
    rule: `A working set of ${STYLE.heavyReps} reps or fewer`,
  },
  {
    id: 'thraex',
    name: 'Thraex',
    trait: 'Hypertrophy · 8–15 reps',
    rule: 'Most working sets in the 8–15 rep range',
  },
  {
    id: 'retiarius',
    name: 'Retiarius',
    trait: 'Endurance · runs, cardio and circuits',
    rule: 'A run, cardio or a superset in the workout',
  },
  {
    id: 'secutor',
    name: 'Secutor',
    trait: 'Discipline · steady attendance',
    rule: 'Training while last week hit your target',
  },
  {
    id: 'hoplomachus',
    name: 'Hoplomachus',
    trait: 'Versatility · a varied plan',
    rule: `${STYLE.groups} or more muscle groups in one workout`,
  },
  {
    id: 'bestiarius',
    name: 'Bestiarius',
    trait: 'Bodyweight · calisthenics',
    rule: 'Half the working sets with no added weight',
  },
];

export function styleDef(id: StyleId): FightingStyle {
  return STYLES.find((s) => s.id === id)!;
}

export const isStyle = (v: unknown): v is StyleId => STYLES.some((s) => s.id === v);

export interface StyleWorkout {
  /** Done working sets (no warm-ups). */
  sets: Pick<SetEntry, 'exercise_id' | 'weight_kg' | 'reps' | 'superset_id' | 'drop_of'>[];
  muscles: (exerciseId: string) => string[];
  /** Weeks in a row before this one that hit the weekly target. */
  streak: number;
  /** A run (no sets): Retiarius and Secutor can still match. */
  run?: boolean;
}

/** Whether a workout is trained the way the style rewards. */
export function styleMatches(style: StyleId, w: StyleWorkout): boolean {
  if (w.run) return style === 'retiarius' || (style === 'secutor' && w.streak >= 1);
  const sets = w.sets.filter((x) => !x.drop_of);
  if (!sets.length) return false;
  switch (style) {
    case 'murmillo':
      return sets.some((x) => x.weight_kg > 0 && x.reps > 0 && x.reps <= STYLE.heavyReps);
    case 'thraex':
      return (
        sets.filter((x) => x.reps >= 8 && x.reps <= 15).length >= sets.length * STYLE.volumeShare
      );
    case 'retiarius':
      return sets.some((x) => !!x.superset_id || w.muscles(x.exercise_id).includes('cardio'));
    case 'secutor':
      return w.streak >= 1;
    case 'hoplomachus':
      return (
        new Set(sets.map((x) => mainGroup(w.muscles(x.exercise_id))).filter(Boolean)).size >=
        STYLE.groups
      );
    case 'bestiarius':
      return sets.filter((x) => x.weight_kg <= 0).length >= sets.length * STYLE.bodyweightShare;
  }
}

/** The style can be changed when none is chosen yet or it was last chosen in an earlier season. */
export function canChangeStyle(chosenSeason: string | null, season: string): boolean {
  return !chosenSeason || chosenSeason < season;
}
