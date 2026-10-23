/**
 * Forum posts carry a snapshot of the workout (exercises, sets, totals), so anyone can read and
 * copy it without access to the author's own rows. Pure — covered by forum.test.ts.
 */
import { isMain, withDrops } from './dropsets';
import { isSideSet, volume } from './formulas';
import type { ProgramExercise, Session } from './types';

export interface ForumSet {
  kg: number;
  /** For a per-side set, the weaker side. */
  reps: number;
  /** Logged per side: [left, right] reps. */
  sides?: [number, number];
  failure?: boolean;
  /** Drop sets done right after this set. */
  drops?: { kg: number; reps: number }[];
}

export interface ForumExercise {
  exercise_id: string;
  name: string;
  muscles: string[];
  /** Exercises of one superset share this id. */
  superset: string | null;
  sets: ForumSet[];
}

export interface ForumWorkout {
  name: string;
  duration_min: number;
  volume_kg: number;
  /** "Push", "Legs", "Upper"… */
  kind: string | null;
  exercises: ForumExercise[];
}

/** The done sets of a finished workout, grouped per exercise in order. */
export function snapshotOf(
  session: Session,
  exercises: Record<string, { name: string; muscles: string[] }>,
  kind: string | null,
): ForumWorkout {
  const done = session.sets
    .filter((s) => s.done && !s.warmup)
    .sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number);
  const positions = [...new Set(done.filter(isMain).map((s) => s.exercise_position))];
  const minutes = session.finished_at
    ? Math.round(
        (new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 60000,
      )
    : 0;
  return {
    name: session.name,
    duration_min: minutes,
    volume_kg: Math.round(volume(done)),
    kind,
    exercises: positions.map((pos) => {
      const sets = done.filter((s) => s.exercise_position === pos);
      const ex = exercises[sets[0].exercise_id];
      return {
        exercise_id: sets[0].exercise_id,
        name: ex?.name ?? 'Exercise',
        muscles: ex?.muscles ?? [],
        superset: sets[0].superset_id ?? null,
        sets: withDrops(sets).map(({ set, drops }) => ({
          kg: set.weight_kg,
          reps: set.reps,
          ...(isSideSet(set)
            ? { sides: [set.left_reps!, set.right_reps!] as [number, number] }
            : null),
          ...(set.failure ? { failure: true } : null),
          ...(drops.length
            ? { drops: drops.map((d) => ({ kg: d.weight_kg, reps: d.reps })) }
            : null),
        })),
      };
    }),
  };
}

/**
 * Program exercises for a copy of the workout: as many sets as were done, the rep range that was
 * done, and the same supersets (with new ids). `idOf` maps the post's exercise to one of mine.
 */
export function copyExercises(
  w: ForumWorkout,
  idOf: (e: ForumExercise) => string,
  newId: () => string,
  restSeconds = 120,
): ProgramExercise[] {
  const groups = new Map<string, string>();
  return w.exercises
    .filter((e) => e.sets.length > 0)
    .map((e, i) => {
      const reps = e.sets.map((s) => s.reps);
      let superset: string | null = null;
      if (e.superset) {
        superset = groups.get(e.superset) ?? newId();
        groups.set(e.superset, superset);
      }
      return {
        id: newId(),
        exercise_id: idOf(e),
        position: i,
        sets: e.sets.length,
        reps_min: Math.min(...reps),
        reps_max: Math.max(...reps),
        rest_seconds: restSeconds,
        superset_id: superset,
      };
    });
}

/** "6 exercises · 18 sets" */
export function postSummary(w: ForumWorkout): string {
  const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const ex = w.exercises.length;
  return `${ex} exercise${ex === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`;
}
