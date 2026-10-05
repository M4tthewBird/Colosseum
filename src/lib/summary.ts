/** Numbers for the post-workout summary. Pure — covered by summary.test.ts. */
import { e1rm, formatKg, prKinds, volume, weekStreak, type Best, type PrKinds } from './formulas';
import { finished, historyBests } from './stats';
import { supersetLetters } from './supersets';
import type { Session, SetEntry } from './types';

export interface ExerciseLine {
  exerciseId: string;
  sets: SetEntry[];
  volumeKg: number;
  top: { weight: number; reps: number; e1rm: number };
  /** "A", "B"… when the exercise was done in a superset. */
  superset: string | null;
}

export interface PrLine {
  exerciseId: string;
  kinds: PrKinds;
  /** The set that beat the old record by the most. */
  weight: number;
  reps: number;
  e1rm: number;
  before: Best;
}

export interface WorkoutSummary {
  durationMs: number;
  volumeKg: number;
  sets: number;
  reps: number;
  exercises: ExerciseLine[];
  prs: PrLine[];
  /** Same workout last time (same program day, or same name). */
  previous: { volumeKg: number; durationMs: number; date: string } | null;
  week: { done: number; target: number; streak: number };
}

const duration = (s: Session) =>
  s.finished_at ? new Date(s.finished_at).getTime() - new Date(s.started_at).getTime() : 0;

export function buildSummary(
  session: Session,
  all: Session[],
  weeklyTarget: number,
): WorkoutSummary {
  const done = session.sets
    .filter((x) => x.done)
    .sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number);

  const byPos = new Map<number, SetEntry[]>();
  for (const s of done)
    byPos.set(s.exercise_position, [...(byPos.get(s.exercise_position) ?? []), s]);
  const exercises: ExerciseLine[] = [...byPos.values()].map((sets) => {
    const top = sets.reduce(
      (b, s) => {
        const est = e1rm(s.weight_kg, s.reps);
        return est > b.e1rm ? { weight: s.weight_kg, reps: s.reps, e1rm: est } : b;
      },
      { weight: 0, reps: 0, e1rm: 0 },
    );
    return { exerciseId: sets[0].exercise_id, sets, volumeKg: volume(sets), top, superset: null };
  });
  const letters = supersetLetters(exercises.map((e) => ({ superset: e.sets[0].superset_id })));
  exercises.forEach((e, i) => (e.superset = letters[i]));

  // PRs: per exercise, the best set against everything before this workout.
  const history = historyBests(all, session.id);
  const prs: PrLine[] = [];
  for (const line of exercises) {
    const before = history[line.exerciseId];
    if (!before) continue;
    let best: PrLine | null = null;
    for (const s of line.sets) {
      const kinds = prKinds(s.weight_kg, s.reps, before);
      if (!kinds.weight && !kinds.e1rm) continue;
      const est = e1rm(s.weight_kg, s.reps);
      if (!best || est > best.e1rm)
        best = {
          exerciseId: line.exerciseId,
          kinds,
          weight: s.weight_kg,
          reps: s.reps,
          e1rm: est,
          before,
        };
    }
    if (best) {
      // Report every kind beaten by any set of this exercise.
      for (const s of line.sets) {
        const k = prKinds(s.weight_kg, s.reps, before);
        best.kinds = { weight: best.kinds.weight || k.weight, e1rm: best.kinds.e1rm || k.e1rm };
        if (k.weight && s.weight_kg > best.weight) {
          best.weight = s.weight_kg;
          best.reps = s.reps;
        }
      }
      prs.push(best);
    }
  }

  const earlier = finished(all).filter(
    (s) =>
      s.id !== session.id &&
      s.started_at < session.started_at &&
      (session.program_day_id
        ? s.program_day_id === session.program_day_id
        : s.name === session.name),
  );
  const prev = earlier[0];

  const dates = finished(all).map((s) => new Date(s.started_at));
  if (!all.some((s) => s.id === session.id && s.finished_at))
    dates.push(new Date(session.started_at));
  const now = new Date(session.started_at);
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );

  return {
    durationMs: duration(session),
    volumeKg: volume(done),
    sets: done.length,
    reps: done.reduce((n, s) => n + s.reps, 0),
    exercises,
    prs,
    previous: prev
      ? {
          volumeKg: prev.volume_kg || volume(prev.sets),
          durationMs: duration(prev),
          date: prev.started_at,
        }
      : null,
    week: {
      done: dates.filter((d) => d >= weekStart).length,
      target: weeklyTarget,
      streak: weekStreak(dates, weeklyTarget, now),
    },
  };
}

/** "100 × 8, 100 × 7, 97.5 × 8" (same weight collapsed: "100 kg: 8, 7, 6"). */
export function setsLine(sets: SetEntry[]): string {
  if (sets.length && sets.every((s) => s.weight_kg === sets[0].weight_kg))
    return `${formatKg(sets[0].weight_kg)} kg × ${sets.map((s) => s.reps).join(', ')}`;
  return sets.map((s) => `${formatKg(s.weight_kg)} × ${s.reps}`).join(', ');
}

/** "+12 %" / "−3 %" / "same" */
export function percentChange(now: number, before: number): string {
  if (!before) return '';
  const p = Math.round(((now - before) / before) * 100);
  if (p === 0) return 'same';
  return `${p > 0 ? '+' : '−'}${Math.abs(p)} %`;
}
