import { suggestNextExercises } from './nextExercise';
import type { Exercise, Session, SetEntry } from './types';

const ex = (id: string, muscles: string[], tier: Exercise['tier'] = null): Exercise => ({
  id,
  name: id,
  muscles,
  image_key: null,
  created_by: null,
  tier,
});

const catalog: Record<string, Exercise> = Object.fromEntries(
  [
    ex('bench', ['chest', 'triceps']),
    ex('incline', ['upper chest', 'triceps']),
    ex('ohp', ['shoulders', 'triceps']),
    ex('lateral', ['shoulders'], 'S'),
    ex('pushdown', ['triceps'], 'A'),
    ex('squat', ['quads', 'glutes']),
    ex('legcurl', ['hamstrings'], 'S'),
    ex('row', ['back', 'biceps']),
  ].map((e) => [e.id, e]),
);

let n = 0;
const session = (ids: string[]): Session => ({
  id: `s${n++}`,
  user_id: 'u',
  program_day_id: null,
  name: 'W',
  started_at: '2026-10-01T10:00:00Z',
  finished_at: '2026-10-01T11:00:00Z',
  volume_kg: 0,
  set_count: 0,
  pr_count: 0,
  updated_at: '',
  sets: ids.map((id, i): SetEntry => ({
    id: `${id}${n}`,
    session_id: '',
    exercise_id: id,
    exercise_position: i,
    set_number: 1,
    weight_kg: 50,
    reps: 8,
    done: true,
    is_pr: false,
    updated_at: '',
  })),
});

describe('suggestNextExercises', () => {
  it('suggests what usually comes right after the last exercise', () => {
    const history = [
      session(['bench', 'incline', 'lateral']),
      session(['bench', 'incline', 'pushdown']),
      session(['squat', 'legcurl']),
    ];
    const picks = suggestNextExercises(['bench'], history, catalog, 2);
    expect(picks[0]).toEqual({ exerciseId: 'incline', reason: 'After bench in 2 workouts' });
    expect(picks).toHaveLength(2);
    // Leg day shares nothing with today, so it suggests nothing.
    expect(picks.map((p) => p.exerciseId)).not.toContain('legcurl');
  });

  it('never suggests what is already in the workout', () => {
    const history = [session(['bench', 'incline'])];
    const picks = suggestNextExercises(['bench', 'incline'], history, catalog, 3);
    expect(picks.map((p) => p.exerciseId)).not.toContain('incline');
    expect(picks.map((p) => p.exerciseId)).not.toContain('bench');
  });

  it('suggests how you usually start an empty workout', () => {
    const history = [session(['squat', 'legcurl']), session(['squat']), session(['bench'])];
    expect(suggestNextExercises([], history, catalog, 1)).toEqual([
      { exerciseId: 'squat', reason: 'How you usually start (2 workouts)' },
    ]);
  });

  it('fills up with top-rated exercises for untrained muscles of the same regions', () => {
    const picks = suggestNextExercises(['bench'], [], catalog, 3);
    // Push region: shoulders (lateral, S) is untrained; triceps is already trained by bench.
    expect(picks).toEqual([{ exerciseId: 'lateral', reason: 'Top-rated for shoulders' }]);
  });
});
