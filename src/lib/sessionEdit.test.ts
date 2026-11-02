import { addEditedSet, hasEmptySet, reflagPRs, removeEditedSet, withTotals } from './sessionEdit';
import type { Session, SetEntry } from './types';

const set = (over: Partial<SetEntry> & { id: string }): SetEntry =>
  ({
    session_id: 's',
    exercise_id: 'bench',
    exercise_position: 0,
    set_number: 1,
    weight_kg: 100,
    reps: 5,
    done: true,
    is_pr: false,
    ...over,
  }) as SetEntry;

const session = (id: string, day: number, sets: SetEntry[]): Session =>
  ({
    id,
    name: id,
    started_at: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    finished_at: `2026-10-${String(day).padStart(2, '0')}T11:00:00.000Z`,
    sets,
    volume_kg: 0,
    set_count: 0,
    pr_count: 0,
  }) as unknown as Session;

describe('removeEditedSet', () => {
  it('moves the later sets up a number', () => {
    const left = removeEditedSet(
      [set({ id: 'a' }), set({ id: 'b', set_number: 2 }), set({ id: 'c', set_number: 3 })],
      'b',
    );
    expect(left.map((x) => [x.id, x.set_number])).toEqual([
      ['a', 1],
      ['c', 2],
    ]);
  });

  it('takes the drop sets with it', () => {
    const left = removeEditedSet(
      [set({ id: 'a' }), set({ id: 'd', drop_of: 'a' }), set({ id: 'b', set_number: 2 })],
      'a',
    );
    expect(left.map((x) => [x.id, x.set_number])).toEqual([['b', 1]]);
  });

  it('removing a drop set or warm-up leaves the numbers alone', () => {
    const sets = [
      set({ id: 'w', warmup: true }),
      set({ id: 'a' }),
      set({ id: 'd', drop_of: 'a' }),
      set({ id: 'b', set_number: 2 }),
    ];
    expect(removeEditedSet(sets, 'd').find((x) => x.id === 'b')!.set_number).toBe(2);
    expect(removeEditedSet(sets, 'w').find((x) => x.id === 'b')!.set_number).toBe(2);
  });

  it('leaves other exercises alone', () => {
    const other = set({ id: 'o', exercise_position: 1, set_number: 2 });
    expect(removeEditedSet([set({ id: 'a' }), other], 'a')[0].set_number).toBe(2);
  });
});

describe('addEditedSet', () => {
  it('copies the last working set as a done set', () => {
    const sets = addEditedSet(
      [set({ id: 'a', weight_kg: 80, failure: true, is_pr: true })],
      0,
      'new',
    );
    expect(sets[1]).toMatchObject({
      id: 'new',
      set_number: 2,
      weight_kg: 80,
      done: true,
      failure: false,
      is_pr: false,
    });
  });

  it('never copies a drop set or a warm-up', () => {
    const sets = addEditedSet(
      [
        set({ id: 'w', warmup: true, set_number: 5, weight_kg: 20 }),
        set({ id: 'a', weight_kg: 80 }),
        set({ id: 'd', drop_of: 'a', weight_kg: 60 }),
      ],
      0,
      'new',
    );
    expect(sets[3]).toMatchObject({ weight_kg: 80, set_number: 2 });
  });
});

it('hasEmptySet finds a set without reps', () => {
  expect(hasEmptySet([set({ id: 'a' })])).toBe(false);
  expect(hasEmptySet([set({ id: 'a', reps: 0 })])).toBe(true);
});

it('withTotals counts volume, sets and PRs, not warm-ups', () => {
  const s = withTotals(
    session('x', 1, [
      set({ id: 'w', warmup: true, weight_kg: 50 }),
      set({ id: 'a', is_pr: true }),
      set({ id: 'b', set_number: 2 }),
    ]),
  );
  expect(s).toMatchObject({ volume_kg: 1000, set_count: 2, pr_count: 1 });
});

describe('reflagPRs', () => {
  const only = new Set(['bench']);

  it('a corrected typo gives back the PR it hid', () => {
    const typo = session('typo', 2, [set({ id: 'a', weight_kg: 1000, is_pr: true })]);
    const later = session('later', 3, [set({ id: 'b', weight_kg: 110 })]);
    const first = session('first', 1, [set({ id: 'f' })]);
    const fixed = { ...typo, sets: [set({ id: 'a', weight_kg: 105, is_pr: true })] };
    const out = reflagPRs([first, fixed, later], 'typo', only);
    expect(out.map((s) => s.id)).toEqual(['typo', 'later']);
    expect(out[0].sets[0].is_pr).toBe(true);
    expect(out[1].sets[0].is_pr).toBe(true);
    expect(out[1].pr_count).toBe(1);
  });

  it('lowering a set takes its PR away', () => {
    const first = session('first', 1, [set({ id: 'f' })]);
    const edited = session('e', 2, [set({ id: 'a', weight_kg: 90, is_pr: true })]);
    const [out] = reflagPRs([first, edited], 'e', only);
    expect(out.sets[0].is_pr).toBe(false);
    expect(out.pr_count).toBe(0);
  });

  it('raising an old set takes the PR from a later one that no longer beats it', () => {
    const first = session('first', 1, [set({ id: 'f' })]);
    const edited = session('e', 2, [set({ id: 'a', weight_kg: 120 })]);
    const later = session('l', 3, [set({ id: 'b', weight_kg: 110, is_pr: true })]);
    const out = reflagPRs([later, first, edited], 'e', only);
    expect(out.find((s) => s.id === 'l')!.sets[0].is_pr).toBe(false);
  });

  it('earlier workouts and other exercises stay as they were', () => {
    const first = session('first', 1, [set({ id: 'f', is_pr: true })]);
    const edited = session('e', 2, [
      set({ id: 'a' }),
      set({ id: 'x', exercise_id: 'squat', exercise_position: 1, is_pr: true, weight_kg: 1 }),
    ]);
    const out = reflagPRs([first, edited], 'e', only);
    expect(out.map((s) => s.id)).toEqual(['e']);
    expect(out[0].sets.find((s) => s.id === 'x')!.is_pr).toBe(true);
  });

  it('later workouts that did not change are not touched', () => {
    const edited = session('e', 2, [set({ id: 'a' })]);
    const later = session('l', 3, [set({ id: 'b', weight_kg: 90 })]);
    expect(reflagPRs([edited, later], 'e', only).map((s) => s.id)).toEqual(['e']);
  });

  it('ignores an unfinished workout', () => {
    const open = { ...session('o', 2, [set({ id: 'a' })]), finished_at: null };
    expect(reflagPRs([open as Session], 'o', only)).toEqual([]);
  });
});
