/** Admin stats as the server returns them (admin_stats), and how the Admin screen reads them. Pure. */

export interface AdminStats {
  today: string;
  users: number;
  new_today: number;
  new_7d: number;
  new_30d: number;
  installed_30d: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  signups_by_week: { week: string; count: number }[];
  retention: { days: number; eligible: number; back: number }[];
  funnel: {
    /** First day with usage events; the funnel counts people who signed up from then on. */
    since: string | null;
    signed_up: number;
    tour_done: number;
    first_workout: number;
    week2_eligible: number;
    week2: number;
  };
}

/** "62 %" (a no-break space, so it never wraps), or "–" when there is nobody to count yet. */
export function pct(part: number, whole: number): string {
  if (whole <= 0) return '–';
  return `${Math.round((part / whole) * 100)} %`;
}

export interface FunnelStep {
  label: string;
  count: number;
  /** Out of how many it is counted (week 2 only counts people who signed up 2+ weeks ago). */
  of: number;
  /** Share of the people the step is counted from, 0–1. */
  share: number;
}

/** Sign-up → tour → first workout → back in week 2, each step as a share of sign-ups. */
export function funnelSteps(f: AdminStats['funnel']): FunnelStep[] {
  const step = (label: string, count: number, of: number): FunnelStep => ({
    label,
    count,
    of,
    share: of > 0 ? Math.min(1, count / of) : 0,
  });
  return [
    step('Signed up', f.signed_up, f.signed_up),
    step('Finished the tour', f.tour_done, f.signed_up),
    step('First workout', f.first_workout, f.signed_up),
    step('Back in week 2', f.week2, f.week2_eligible),
  ];
}

/** The step that loses the most people, as an index into funnelSteps (null: nothing to say). */
export function biggestDrop(steps: FunnelStep[]): number | null {
  let worst: number | null = null;
  let worstLoss = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].of === 0) continue;
    const loss = steps[i - 1].share - steps[i].share;
    if (loss > worstLoss) {
      worstLoss = loss;
      worst = i;
    }
  }
  return worst;
}
