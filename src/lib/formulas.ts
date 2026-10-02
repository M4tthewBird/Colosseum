/** Training formulas. Pure functions only — covered by formulas.test.ts. */
import { addDays, isInWeek, startOfWeek } from './dates';

export interface SetLike {
  weight_kg: number;
  reps: number;
  done: boolean;
}

/** Estimated 1RM (Epley). For 1 rep it is the weight itself. */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Σ weight × reps over completed sets. */
export function volume(sets: SetLike[]): number {
  return sets.reduce((sum, s) => (s.done ? sum + s.weight_kg * s.reps : sum), 0);
}

/**
 * DOTS coefficient (powerlifting): multiply a lift by it for a bodyweight-adjusted score, so a
 * 70 kg and a 130 kg lifter can be compared. Bodyweight is clamped to 40–210 kg (men) or
 * 40–150 kg (women). Returns null without a bodyweight or sex.
 */
export function dotsCoefficient(
  bodyweightKg: number | null,
  sex: 'male' | 'female' | null,
): number | null {
  if (!bodyweightKg || !sex) return null;
  const w = Math.min(Math.max(bodyweightKg, 40), sex === 'female' ? 150 : 210);
  const [a, b, c, d, e] =
    sex === 'female'
      ? [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]
      : [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
  return 500 / (a + b * w + c * w ** 2 + d * w ** 3 + e * w ** 4);
}

/** Bodyweight-adjusted DOTS score for a lift (kg), or null without bodyweight/sex. */
export function dots(
  liftKg: number,
  bodyweightKg: number | null,
  sex: 'male' | 'female' | null,
): number | null {
  const k = dotsCoefficient(bodyweightKg, sex);
  return k == null ? null : liftKg * k;
}

/** "18.4 t" at 1000 kg and more, otherwise "850 kg". */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

/** "97.5", "100", "62.5" */
export function formatKg(kg: number): string {
  const r = Math.round(kg * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Rounds to the nearest 0.5 kg, which is what plates allow. */
export function roundHalf(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Parses user input like "97,5" or "97.5". Returns null when empty or invalid. */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface Best {
  weight: number;
  e1rm: number;
}

/**
 * Marks PRs within one session, in order. A set is a PR when it is done and its weight or
 * estimated 1RM beats every earlier completed set of that exercise (history + earlier sets in
 * this session). The first time an exercise is ever logged is not a PR: there must be history.
 */
export function markPRs<T extends SetLike & { exercise_id: string }>(
  sets: T[],
  history: Record<string, Best | undefined>,
): boolean[] {
  const running: Record<string, Best | undefined> = { ...history };
  return sets.map((s) => {
    if (!s.done || s.reps <= 0) return false;
    const prev = running[s.exercise_id];
    const est = e1rm(s.weight_kg, s.reps);
    const isPr = !!prev && (s.weight_kg > prev.weight || est > prev.e1rm + 1e-9);
    running[s.exercise_id] = {
      weight: Math.max(prev?.weight ?? 0, s.weight_kg),
      e1rm: Math.max(prev?.e1rm ?? 0, est),
    };
    return isPr;
  });
}

/** Best weight and best e1RM per exercise over completed sets. */
export function bestsByExercise(sets: (SetLike & { exercise_id: string })[]): Record<string, Best> {
  const out: Record<string, Best> = {};
  for (const s of sets) {
    if (!s.done || s.reps <= 0) continue;
    const b = out[s.exercise_id] ?? { weight: 0, e1rm: 0 };
    b.weight = Math.max(b.weight, s.weight_kg);
    b.e1rm = Math.max(b.e1rm, e1rm(s.weight_kg, s.reps));
    out[s.exercise_id] = b;
  }
  return out;
}

/** Number of distinct exercises with at least one PR set. */
export function prCount(sets: { exercise_id: string; is_pr: boolean }[]): number {
  return new Set(sets.filter((s) => s.is_pr).map((s) => s.exercise_id)).size;
}

/**
 * Consecutive weeks that reached the target, counting back from last week. The current week
 * counts too once it has reached the target (an unfinished week does not break the streak).
 */
export function weekStreak(sessionDates: Date[], target: number, now: Date = new Date()): number {
  if (target <= 0) return 0;
  const counts = new Map<number, number>();
  for (const d of sessionDates) {
    const k = startOfWeek(d).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let week = startOfWeek(now);
  let streak = (counts.get(week.getTime()) ?? 0) >= target ? 1 : 0;
  week = addDays(week, -7);
  while ((counts.get(week.getTime()) ?? 0) >= target) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function countInWeek(dates: Date[], now: Date = new Date()): number {
  const ws = startOfWeek(now);
  return dates.filter((d) => isInWeek(d, ws)).length;
}

/** Estimated duration in minutes: sets × (45 s + rest). */
export function estimateMinutes(plan: { sets: number; rest_seconds: number }[]): number {
  const seconds = plan.reduce((sum, e) => sum + e.sets * (45 + e.rest_seconds), 0);
  return Math.round(seconds / 60);
}

/** "4 × 6–8" or "3 × 8" */
export function formatScheme(sets: number, repsMin: number, repsMax: number): string {
  return repsMin === repsMax ? `${sets} × ${repsMin}` : `${sets} × ${repsMin}–${repsMax}`;
}

/** "2:00" */
export function formatRest(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface PrKinds {
  /** Heavier than any earlier set of this exercise. */
  weight: boolean;
  /** Higher estimated one-rep max (Epley) — e.g. more reps with the same weight. */
  e1rm: boolean;
}

/** What kind of PR a set is against the previous bests (no history = no PR). */
export function prKinds(weightKg: number, reps: number, best: Best | undefined): PrKinds {
  if (!best || reps <= 0) return { weight: false, e1rm: false };
  return { weight: weightKg > best.weight, e1rm: e1rm(weightKg, reps) > best.e1rm + 1e-9 };
}

/** "Weight PR · 105 kg" / "1RM PR · ≈ 120 kg" / both. */
export function prLabel(weightKg: number, reps: number, kinds: PrKinds): string {
  const parts: string[] = [];
  if (kinds.weight) parts.push(`Weight PR · ${formatKg(weightKg)} kg`);
  if (kinds.e1rm) parts.push(`1RM PR · ≈ ${formatKg(roundHalf(e1rm(weightKg, reps)))} kg`);
  return parts.join('  ·  ');
}
