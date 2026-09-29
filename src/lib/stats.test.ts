import { exerciseHistory, historyBests, lastTimeSets, liftsSummary, weekStats } from './stats';
import type { Session, SetEntry } from './types';

let n = 0;
const set = (
  session_id: string,
  exercise_id: string,
  weight_kg: number,
  reps: number,
  set_number = 1,
): SetEntry => ({
  id: `s${n++}`,
  session_id,
  exercise_id,
  exercise_position: 0,
  set_number,
  weight_kg,
  reps,
  done: true,
  is_pr: false,
  updated_at: '',
});

const session = (
  id: string,
  date: Date,
  sets: SetEntry[],
  finishedAt = true,
  pr_count = 0,
): Session => ({
  id,
  user_id: 'u',
  program_day_id: null,
  name: id,
  started_at: date.toISOString(),
  finished_at: finishedAt ? date.toISOString() : null,
  volume_kg: 0,
  set_count: sets.length,
  pr_count,
  updated_at: '',
  sets,
});

const now = new Date(2025, 8, 30, 12); // Tue
const a = session('a', new Date(2025, 8, 22, 18), [
  set('a', 'bench', 90, 8, 1),
  set('a', 'bench', 90, 7, 2),
]);
const b = session('b', new Date(2025, 8, 29, 18), [set('b', 'bench', 95, 8, 1)], true, 1);
const live = session('c', new Date(2025, 8, 30, 10), [set('c', 'bench', 200, 1)], false);
const all = [a, b, live];

describe('stats', () => {
  it('ignores unfinished sessions in bests', () => {
    expect(historyBests(all).bench.weight).toBe(95);
  });

  it('finds last time sets from the latest finished session', () => {
    expect(lastTimeSets(all, 'bench').map((s) => s.weight_kg)).toEqual([95]);
    expect(lastTimeSets(all, 'bench', 'b').map((s) => s.reps)).toEqual([8, 7]);
  });

  it('computes this week', () => {
    const w = weekStats(all, now);
    expect(w.workouts).toBe(1);
    expect(w.volumeKg).toBe(760);
    expect(w.prs).toBe(1);
  });

  it('lists exercise history oldest first', () => {
    expect(exerciseHistory(all, 'bench').map((h) => h.sessionId)).toEqual(['a', 'b']);
  });

  it('summarises lifts with a gain', () => {
    const [l] = liftsSummary(all, now);
    expect(l.best.weight).toBe(95);
    expect(l.spark).toHaveLength(2);
    expect(l.gain).toBe(6.5); // 95×8 (120.3) − 90×8 (114) = 6.3 → 6.5
  });
});
