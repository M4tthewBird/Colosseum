import { buildSummary, percentChange, setsLine } from './summary';
import type { Session, SetEntry } from './types';

let n = 0;
const set = (sid: string, ex: string, pos: number, w: number, r: number, no = 1): SetEntry => ({
  id: `x${n++}`,
  session_id: sid,
  exercise_id: ex,
  exercise_position: pos,
  set_number: no,
  weight_kg: w,
  reps: r,
  done: true,
  is_pr: false,
  updated_at: '',
});
const session = (
  id: string,
  start: Date,
  mins: number,
  sets: SetEntry[],
  day = 'push',
): Session => ({
  id,
  user_id: 'u',
  program_day_id: day,
  name: 'Push',
  started_at: start.toISOString(),
  finished_at: new Date(start.getTime() + mins * 60000).toISOString(),
  volume_kg: sets.reduce((v, s) => v + s.weight_kg * s.reps, 0),
  set_count: sets.length,
  pr_count: 0,
  updated_at: '',
  sets,
});

const last = session('a', new Date(2025, 8, 22, 18), 60, [
  set('a', 'bench', 0, 100, 5, 1),
  set('a', 'bench', 0, 100, 5, 2),
]);
const now = session('b', new Date(2025, 8, 29, 18), 55, [
  set('b', 'bench', 0, 100, 7, 1), // 1RM PR (more reps)
  set('b', 'bench', 0, 102.5, 3, 2), // weight PR
  set('b', 'row', 1, 80, 10, 1), // first time: no PR
]);

describe('workout summary', () => {
  const s = buildSummary(now, [last, now], 3);

  it('totals the workout', () => {
    expect(s.sets).toBe(3);
    expect(s.reps).toBe(20);
    expect(s.volumeKg).toBe(700 + 307.5 + 800);
    expect(s.durationMs).toBe(55 * 60000);
  });

  it('lists PRs with both kinds and the old record', () => {
    expect(s.prs).toHaveLength(1);
    expect(s.prs[0].kinds).toEqual({ weight: true, e1rm: true });
    expect(s.prs[0].weight).toBe(102.5);
    expect(s.prs[0].before.weight).toBe(100);
  });

  it('compares with the same workout last time', () => {
    expect(s.previous?.volumeKg).toBe(1000);
    expect(percentChange(s.volumeKg, 1000)).toBe('+81 %');
  });

  it('breaks the workout down per exercise', () => {
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']);
    expect(s.exercises[0].top.reps).toBe(7);
    expect(setsLine(s.exercises[1].sets)).toBe('80 kg × 10');
  });

  it('counts the week', () => {
    expect(s.week.done).toBe(1);
  });
});
