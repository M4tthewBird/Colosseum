/**
 * Warm-up sets: lighter sets before the working sets. They are logged but never count to
 * volume, set counts, PRs or next-time suggestions. Pure — covered by warmups.test.ts.
 */

export const isWarmup = (s: { warmup?: boolean | null }) => !!s.warmup;

/** A set that counts: not a warm-up. (Drop sets count too; see isMain for those.) */
export const isWork = (s: { warmup?: boolean | null }) => !s.warmup;

/** Rest after a warm-up set, in seconds: short, the muscles only need a moment. */
export const WARMUP_REST = 60;

/** Smallest plate step the suggestions round to. */
const STEP = 2.5;

/**
 * Warm-up ramp for a working weight, lightest first: 50 % × 8, 70 % × 5, 85 % × 2 (rounded to
 * 2.5 kg). Light working weights get fewer sets; nothing under 20 kg (or for bodyweight).
 */
export function warmupPlan(workKg: number): { weight_kg: number; reps: number }[] {
  if (workKg < 20) return [];
  const ramp =
    workKg < 40
      ? [[0.5, 10]]
      : workKg < 70
        ? [
            [0.5, 8],
            [0.75, 4],
          ]
        : [
            [0.5, 8],
            [0.7, 5],
            [0.85, 2],
          ];
  const out: { weight_kg: number; reps: number }[] = [];
  for (const [pct, reps] of ramp) {
    const w = Math.round((workKg * pct) / STEP) * STEP;
    if (w > 0 && w < workKg && !out.some((x) => x.weight_kg === w))
      out.push({ weight_kg: w, reps });
  }
  return out;
}
