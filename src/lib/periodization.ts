/**
 * Program periodization: the weeks of a program are split into phases that scale the planned
 * sets and set a target effort (RPE). Pure functions — covered by periodization.test.ts.
 *
 * Default block (8 weeks): Intro 1–2 (fewer sets, further from failure), Build 3–5,
 * Push 6–7 (more sets, close to failure), Deload 8 (half the sets, easy).
 */
export interface Phase {
  name: string;
  /** First and last program week of the phase, 1-based and inclusive. */
  from: number;
  to: number;
  /** Multiplier for the planned sets (rounded, at least 1). */
  sets: number;
  /** Target RPE: 10 = failure, 8 = about 2 reps left. */
  rpe: number;
}

export function defaultPhases(weeks: number): Phase[] {
  if (weeks < 4) return [{ name: 'Build', from: 1, to: weeks, sets: 1, rpe: 8 }];
  const intro = Math.max(1, Math.round(weeks * 0.25));
  const push = Math.max(1, Math.round(weeks * 0.25));
  const deload = 1;
  const build = weeks - intro - push - deload;
  const list: Phase[] = [];
  let w = 1;
  const add = (name: string, len: number, sets: number, rpe: number) => {
    if (len <= 0) return;
    list.push({ name, from: w, to: w + len - 1, sets, rpe });
    w += len;
  };
  add('Intro', intro, 0.75, 7);
  add('Build', build, 1, 8);
  add('Push', push, 1.25, 9);
  add('Deload', deload, 0.5, 6);
  return list;
}

export function phaseFor(phases: Phase[] | undefined, week: number): Phase | null {
  if (!phases?.length) return null;
  return phases.find((p) => week >= p.from && week <= p.to) ?? phases[phases.length - 1];
}

export function phasedSets(baseSets: number, phase: Phase | null): number {
  if (!phase) return baseSets;
  return Math.max(1, Math.round(baseSets * phase.sets));
}

/** "about 2 reps left" for RPE 8. */
export function rpeHint(rpe: number): string {
  const left = 10 - rpe;
  if (left <= 0) return 'to failure';
  return `about ${left} rep${left === 1 ? '' : 's'} left`;
}

/** "Weeks 3–5" or "Week 8". */
export function phaseWeeks(p: Phase): string {
  return p.from === p.to ? `Week ${p.from}` : `Weeks ${p.from}–${p.to}`;
}

export const PHASE_NOTES: Record<string, string> = {
  Intro: 'Ease in: fewer sets, stop a few reps short of failure.',
  Build: 'Main work: full sets, about 2 reps left in the tank.',
  Push: 'Hardest block: an extra set and go close to failure.',
  Deload: 'Recover: half the sets, keep the weights, stay far from failure.',
};

/** New week ranges for a changed program length, keeping each phase's own sets and RPE. */
export function resizePhases(phases: Phase[], weeks: number): Phase[] {
  const own = new Map(phases.map((p) => [p.name, p]));
  return defaultPhases(weeks).map((p) => {
    const mine = own.get(p.name);
    return mine ? { ...p, sets: mine.sets, rpe: mine.rpe } : p;
  });
}
