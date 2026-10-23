import { badgeLevel, badgesFrom, computeBadges } from './badges';
import type { Session, SetEntry } from './types';

let n = 0;
const set = (exercise_id: string, weight_kg: number, reps = 5, extra: Partial<SetEntry> = {}) =>
  ({
    id: `x${n++}`,
    session_id: '',
    exercise_id,
    exercise_position: 0,
    set_number: 1,
    weight_kg,
    reps,
    done: true,
    is_pr: false,
    updated_at: '',
    ...extra,
  }) as SetEntry;

const session = (start: string, sets: SetEntry[], minutes = 60, pr_count = 0): Session => ({
  id: `s${n++}`,
  user_id: 'u',
  program_day_id: null,
  name: 'W',
  started_at: new Date(start).toISOString(),
  finished_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
  volume_kg: 0,
  set_count: sets.length,
  pr_count,
  updated_at: '',
  sets,
});

const names: Record<string, string> = { b: 'Bench Press', s: 'Squat', d: 'Deadlift', c: 'Curl' };
const nameOf = (id: string) => names[id];
const get = (all: ReturnType<typeof computeBadges>, id: string) =>
  all.find((b) => b.def.id === id)!;

describe('computeBadges', () => {
  it('counts workouts and remembers the workout of each tier', () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      session(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00`, [set('c', 10)]),
    );
    const w = get(computeBadges(list, nameOf), 'workouts');
    expect(w.value).toBe(10);
    expect(w.earned.map((e) => e.threshold)).toEqual([1, 10]);
    expect(w.earned[0].sessionId).toBe(list[0].id);
    expect(w.earned[1].sessionId).toBe(list[9].id);
    expect(w.next).toBe(25);
  });

  it('reads strength clubs from the heaviest working sets, not warm-ups', () => {
    const all = computeBadges(
      [
        session('2026-02-01T10:00:00', [
          set('b', 100),
          set('s', 140),
          set('d', 220, 1),
          set('d', 260, 1, { warmup: true }),
        ]),
      ],
      nameOf,
    );
    expect(get(all, 'bench').earned.map((e) => e.threshold)).toEqual([60, 80, 100]);
    expect(get(all, 'deadlift').value).toBe(220);
    expect(get(all, 'total').value).toBe(460);
    expect(get(all, 'total').def.tierTitle(455)).toBe('1000 lb club');
    // Heaviest working set 220 kg = 5 plates a side (the 260 kg warm-up does not count).
    expect(get(all, 'plates').earned).toHaveLength(5);
  });

  it('finds the longest run of weeks that hit the target', () => {
    // Three weeks with 2 workouts each, then a week off, then one more good week.
    const weeks = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-30'];
    const list = weeks.flatMap((d) => [
      session(`${d}T10:00:00`, [set('c', 10)]),
      session(`${d.slice(0, 8)}${String(Number(d.slice(8)) + 1).padStart(2, '0')}T10:00:00`, [
        set('c', 10),
      ]),
    ]);
    expect(get(computeBadges(list, nameOf, { weeklyTarget: 2 }), 'streak').value).toBe(3);
  });

  it('counts time-of-day, weekend and comeback feats', () => {
    const all = computeBadges(
      [
        session('2026-04-04T06:30:00', [set('c', 10)]), // Saturday, early
        session('2026-04-06T21:30:00', [set('c', 10)]), // Monday, late
        session('2026-05-10T10:00:00', [set('c', 10)]), // Sunday, after 5 weeks off
      ],
      nameOf,
    );
    expect(get(all, 'early').value).toBe(1);
    expect(get(all, 'night').value).toBe(1);
    expect(get(all, 'weekend').value).toBe(2);
    expect(get(all, 'comeback').value).toBe(1);
  });

  it('lists what one workout earned', () => {
    const first = session('2026-06-01T10:00:00', [set('b', 60)]);
    const news = badgesFrom(computeBadges([first], nameOf), first.id).map((b) => b.def.id);
    expect(news).toEqual(expect.arrayContaining(['workouts', 'bench', 'plates']));
  });
});

describe('badgeLevel', () => {
  it('spreads any ladder over 5 looks', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => badgeLevel(i, 7))).toEqual([1, 2, 2, 3, 4, 4, 5]);
    expect([0, 1, 2].map((i) => badgeLevel(i, 3))).toEqual([1, 3, 5]);
    expect(badgeLevel(0, 1)).toBe(5);
  });
});
