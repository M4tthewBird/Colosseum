import {
  groupIndexOf,
  groupPlan,
  interleave,
  letter,
  linkWithAbove,
  roundComplete,
  supersetLetters,
} from './supersets';

const plan = [
  { position: 0 },
  { position: 1, superset: 'g' },
  { position: 2, superset: 'g' },
  { position: 3 },
];

describe('supersets', () => {
  it('groups consecutive superset exercises into one page', () => {
    expect(groupPlan(plan).map((g) => g.map((p) => p.position))).toEqual([[0], [1, 2], [3]]);
    expect(groupIndexOf(groupPlan(plan), 2)).toBe(1);
  });

  it('orders superset sets A1, B1, A2, B2', () => {
    const sets = [
      { exercise_position: 1, set_number: 1, done: false },
      { exercise_position: 1, set_number: 2, done: false },
      { exercise_position: 2, set_number: 1, done: false },
      { exercise_position: 2, set_number: 2, done: false },
    ];
    expect(
      interleave(sets, [1, 2]).map((s) => `${letter(s.exercise_position - 1)}${s.set_number}`),
    ).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('knows when a round is complete', () => {
    const sets = [
      { exercise_position: 1, set_number: 1, done: true },
      { exercise_position: 2, set_number: 1, done: false },
    ];
    expect(roundComplete(sets, [1, 2], 1)).toBe(false);
    sets[1].done = true;
    expect(roundComplete(sets, [1, 2], 1)).toBe(true);
  });
});

describe('supersetLetters', () => {
  it('letters consecutive members and ignores lone ids', () => {
    expect(
      supersetLetters([{}, { superset: 'g' }, { superset: 'g' }, { superset: 'h' }, {}]),
    ).toEqual([null, 'A', 'B', null, null]);
  });
});

describe('linkWithAbove', () => {
  let n = 0;
  const id = () => `n${++n}`;
  const ids = (l: { superset_id?: string | null }[]) => l.map((e) => e.superset_id ?? null);

  it('links two exercises and unlinks them again', () => {
    const linked = linkWithAbove([{}, {}, {}], 1, true, id);
    expect(ids(linked)).toEqual(['n1', 'n1', null]);
    expect(ids(linkWithAbove(linked, 1, false, id))).toEqual([null, null, null]);
  });

  it('extends a superset and keeps the rest linked when splitting', () => {
    const blank: { superset_id?: string | null }[] = [{}, {}, {}];
    const three = linkWithAbove(linkWithAbove(blank, 1, true, id), 2, true, id);
    expect(new Set(ids(three)).size).toBe(1);
    const split = linkWithAbove(three, 1, false, id);
    expect(split[0].superset_id).toBeNull();
    expect(split[1].superset_id).toBe(split[2].superset_id);
    expect(split[1].superset_id).not.toBeNull();
  });
});
