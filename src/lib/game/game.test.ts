import type { Session, SetEntry } from '../types';
import { attributes, cellItems, homeStage } from './attributes';
import { bellumScore, duelScore, warPoints, warScore, warSpoils, warWinner } from './battles';
import { DENARII, LAURELS, XP } from './config';
import { computeGame, qualifies, seasonsFrom, type GameInput } from './engine';
import {
  currentLevel,
  fortressLevel,
  fortressStage,
  levelMinutes,
  machineBonus,
  memberLimit,
  workingLevel,
  type Building,
} from './fortress';
import { applyWar, EMPTY_RECORD, gloriaChange, ludusBadges } from './gloria';
import {
  carryOver,
  leagueFor,
  levelFromXp,
  levelProgress,
  nextSeason,
  rankFor,
  seasonDaysLeft,
  xpForLevel,
} from './levels';
import {
  distanceM,
  openVisit,
  parseVisitCode,
  sessionVerification,
  visitStatus,
  type GymVisit,
} from './visits';

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

const three = (id = 'c', kg = 10, extra: Partial<SetEntry> = {}) => [
  set(id, kg, 5, extra),
  set(id, kg, 5),
  set(id, kg, 5),
];

const session = (start: string, sets: SetEntry[], minutes = 60): Session => ({
  id: `s${n++}`,
  user_id: 'u',
  program_day_id: null,
  name: 'W',
  started_at: new Date(start).toISOString(),
  finished_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
  volume_kg: 0,
  set_count: sets.length,
  pr_count: 0,
  updated_at: '',
  sets,
});

const names: Record<string, string> = { b: 'Bench Press', s: 'Squat', d: 'Deadlift', c: 'Curl' };
const base = (sessions: Session[], extra: Partial<GameInput> = {}): GameInput => ({
  sessions,
  exerciseName: (id) => names[id],
  experience: 'beginner',
  weeklyTarget: 3,
  dotsCoefficient: null,
  verification: () => null,
  now: new Date('2026-11-20T12:00:00'),
  ...extra,
});

describe('levels', () => {
  it('needs one workout for level 2', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(150);
    expect(levelFromXp(149)).toBe(1);
    expect(levelFromXp(150)).toBe(2);
  });
  it('inverts xpForLevel at every level', () => {
    for (let l = 1; l < 80; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l) - 1)).toBe(Math.max(1, l - 1));
    }
  });
  it('reports progress inside a level', () => {
    const p = levelProgress(xpForLevel(5) + 100);
    expect(p.level).toBe(5);
    expect(p.into).toBe(100);
    expect(p.span).toBe(xpForLevel(6) - xpForLevel(5));
  });
  it('maps levels to ranks', () => {
    expect(rankFor(1).name).toBe('Tiro');
    expect(rankFor(5).name).toBe('Gladiator');
    expect(rankFor(24).name).toBe('Veteranus');
    expect(rankFor(25).name).toBe('Primus Palus');
    expect(rankFor(99).name).toBe('Rudiarius');
  });
  it('maps scores to leagues', () => {
    expect(leagueFor(0).id).toBe('bronze');
    expect(leagueFor(150).id).toBe('silver');
    expect(leagueFor(699).id).toBe('gold');
    expect(leagueFor(700).id).toBe('imperator');
  });
  it('carries half over, at most 300', () => {
    expect(carryOver(201)).toBe(100);
    expect(carryOver(2000)).toBe(300);
    expect(nextSeason('2026-12')).toBe('2027-01');
  });
  it('counts the days left in the season', () => {
    expect(seasonDaysLeft(new Date('2026-11-30T20:00:00'))).toBe(1);
    expect(seasonDaysLeft(new Date('2026-11-01T08:00:00'))).toBe(30);
  });
});

describe('computeGame', () => {
  it('needs 3 done working sets', () => {
    const warm = session('2026-11-02T10:00', [
      set('c', 5, 5, { warmup: true }),
      set('c', 10),
      set('c', 10),
    ]);
    expect(qualifies(warm)).toBe(false);
    const g = computeGame(base([warm]));
    expect(g.xp).toBe(0);
  });

  it('gives XP per workout, never for volume', () => {
    const light = session('2026-11-02T10:00', three('c', 10));
    const heavy = session('2026-11-03T10:00', [
      ...three('c', 10),
      ...three('c', 10),
      ...three('c', 10),
    ]);
    const g = computeGame(base([light, heavy]));
    expect(g.sessions[light.id].xp).toBe(XP.workout);
    expect(g.sessions[heavy.id].xp).toBe(XP.workout);
  });

  it('rewards PRs, at most 3, and adds the verified bonus', () => {
    const before = session('2026-11-02T10:00', [
      set('b', 60),
      set('s', 80),
      set('d', 100),
      set('c', 10),
    ]);
    const after = session('2026-11-04T10:00', [
      set('b', 62.5),
      set('s', 82.5),
      set('d', 102.5),
      set('c', 11),
    ]);
    const g = computeGame(
      base([before, after], { verification: (s) => (s === after ? 'verified' : null) }),
    );
    const r = g.sessions[after.id];
    expect(r.prs).toBe(4);
    expect(r.xp).toBe(XP.workout + XP.verified + 3 * XP.pr);
    expect(r.denarii).toBe(DENARII.verified + 3 * DENARII.pr);
  });

  it('does not reward unusual jumps', () => {
    const list = [
      session('2026-10-01T10:00', three('b', 60)),
      session('2026-10-03T10:00', three('b', 60)),
      session('2026-11-05T10:00', three('b', 100)),
    ];
    const r = computeGame(base(list)).sessions[list[2].id];
    expect(r.prs).toBe(0);
    expect(r.unusualPrs).toBe(1);
  });

  it('caps XP per day', () => {
    const list = [0, 1, 2, 3].map((h) => session(`2026-11-02T0${h + 6}:00`, three()));
    const g = computeGame(base(list));
    expect(g.days['2026-11-02'].xp).toBe(XP.dailyCap);
    expect(g.sessions[list[3].id].xp).toBe(0);
    expect(g.sessions[list[3].id].xpCapped).toBe(XP.workout);
  });

  it('gives attendance laurels once a day and the weekly target bonus', () => {
    const list = [
      session('2026-11-02T08:00', three()),
      session('2026-11-02T18:00', three()),
      session('2026-11-03T08:00', three()),
    ];
    const g = computeGame(base(list));
    expect(g.sessions[list[0].id].laurels).toBe(LAURELS.attendance);
    expect(g.sessions[list[1].id].laurels).toBe(0);
    expect(g.sessions[list[2].id].laurels).toBe(LAURELS.attendance + LAURELS.weeklyTarget);
  });

  it('adds streak XP from earlier weeks', () => {
    const list: Session[] = [];
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-11-02'])
      list.push(session(`${d}T10:00`, three()));
    const g = computeGame(base(list));
    expect(g.sessions[list[3].id].xp).toBe(XP.workout + XP.streakWeek);
  });

  it('scales progress laurels with the level factor after the baseline weeks', () => {
    const list = [
      session('2026-09-01T10:00', three('b', 100)),
      session('2026-10-01T10:00', three('b', 105)),
    ];
    const beginner = computeGame(base(list)).sessions[list[1].id];
    const advanced = computeGame(base(list, { experience: 'advanced' })).sessions[list[1].id];
    const progress = (r: typeof beginner) =>
      r.laurelParts.find((p) => p.label === 'Progress')?.amount;
    expect(progress(beginner)).toBe(5);
    expect(progress(advanced)).toBe(10);
  });

  it('gives no progress laurels in the baseline weeks', () => {
    const list = [
      session('2026-11-01T10:00', three('b', 100)),
      session('2026-11-05T10:00', three('b', 105)),
    ];
    const r = computeGame(base(list)).sessions[list[1].id];
    expect(r.prs).toBe(1);
    expect(r.laurelParts.some((p) => p.label === 'Progress')).toBe(false);
  });

  it('adds a strength part from DOTS', () => {
    const list = [
      session('2026-11-02T10:00', [set('s', 150, 1), set('b', 100, 1), set('d', 200, 1)]),
    ];
    const r = computeGame(base(list, { dotsCoefficient: 0.7 })).sessions[list[0].id];
    expect(r.laurelParts.find((p) => p.label === 'Strength')?.amount).toBe(5);
  });

  it('applies the machine bonus and the denarii cap', () => {
    const list = [session('2026-11-02T10:00', three('b', 60))];
    const g = computeGame(base(list, { denariiBonus: () => 0.5 }));
    expect(g.sessions[list[0].id].denarii).toBe(Math.round(DENARII.unverified * 1.5));
  });
});

describe('seasonsFrom', () => {
  it('carries scores into the next months, with awards', () => {
    const days = {
      '2026-09-10': { day: '2026-09-10', xp: 0, laurels: 400, denarii: 0, workouts: 1, prs: 0 },
      '2026-11-02': { day: '2026-11-02', xp: 0, laurels: 20, denarii: 0, workouts: 1, prs: 0 },
    };
    const s = seasonsFrom(days, { '2026-11': 25 }, new Date('2026-11-20'));
    expect(s.map((x) => x.season)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(s[1].carry).toBe(200);
    expect(s[2].carry).toBe(100);
    expect(s[2].score).toBe(145);
  });
});

const visit = (extra: Partial<GymVisit> = {}): GymVisit => ({
  id: 'v',
  user_id: 'u',
  gym_id: 'g',
  in_code: 'sig',
  in_at: '2026-11-02T10:00:00Z',
  in_lat: 50,
  in_lng: 14,
  in_acc: 10,
  out_code: null,
  out_at: null,
  out_lat: null,
  out_lng: null,
  out_acc: null,
  updated_at: '',
  ...extra,
});

describe('visits', () => {
  const at = (iso: string) => new Date(iso);
  it('is open, then closes as incomplete after 3 hours', () => {
    expect(visitStatus(visit({ in_ok: true }), at('2026-11-02T12:59:00Z'))).toBe('open');
    expect(visitStatus(visit({ in_ok: true }), at('2026-11-02T13:01:00Z'))).toBe('incomplete');
  });
  it('is verified once the server accepted both scans', () => {
    const v = visit({ out_at: '2026-11-02T11:10:00Z', out_code: 'sig' });
    expect(visitStatus(v)).toBe('checking');
    expect(visitStatus({ ...v, in_ok: true, out_ok: true })).toBe('verified');
    expect(visitStatus({ ...v, in_ok: false })).toBe('rejected');
    expect(visitStatus({ ...v, in_ok: true, out_ok: false })).toBe('incomplete');
  });
  it('does not count under 20 minutes or over 4 hours', () => {
    expect(visitStatus(visit({ in_ok: true, out_ok: true, out_at: '2026-11-02T10:15:00Z' }))).toBe(
      'uncounted',
    );
    expect(visitStatus(visit({ in_ok: true, out_ok: true, out_at: '2026-11-02T14:30:00Z' }))).toBe(
      'uncounted',
    );
  });
  it('verifies workouts started during the visit', () => {
    const v = visit({ in_ok: true, out_ok: true, out_at: '2026-11-02T11:30:00Z' });
    expect(sessionVerification('2026-11-02T09:50:00Z', [v])).toBe('verified');
    expect(sessionVerification('2026-11-02T09:30:00Z', [v])).toBe(null);
    expect(sessionVerification('2026-11-02T11:40:00Z', [v])).toBe(null);
  });
  it('finds the open visit', () => {
    expect(openVisit([visit({ in_ok: true })], at('2026-11-02T10:30:00Z'))?.id).toBe('v');
    expect(openVisit([visit({ in_ok: true })], at('2026-11-02T14:00:00Z'))).toBe(null);
  });
  it('reads the poster link', () => {
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    expect(parseVisitCode(`https://x.github.io/colosseum/visit/${id}.AbC_d-12345`)).toEqual({
      gymId: id,
      sig: 'AbC_d-12345',
    });
    expect(parseVisitCode('https://x/add/tomas')).toBe(null);
  });
  it('measures distance', () => {
    expect(distanceM(50, 14, 50, 14)).toBe(0);
    expect(distanceM(50, 14, 50.001, 14)).toBeCloseTo(111, 0);
  });
});

describe('fortress', () => {
  const b = (extra: Partial<Building>): Building => ({
    owner_kind: 'ludus',
    owner_id: 'l',
    building: 'bench',
    level: 1,
    target_level: null,
    ready_at: null,
    damaged: false,
    ...extra,
  });
  const now = new Date('2026-11-10T12:00:00Z');
  it('finishes construction at ready_at', () => {
    expect(currentLevel(b({ target_level: 2, ready_at: '2026-11-11T00:00:00Z' }), now)).toBe(1);
    expect(currentLevel(b({ target_level: 2, ready_at: '2026-11-10T00:00:00Z' }), now)).toBe(2);
  });
  it('gives nothing while damaged', () => {
    expect(workingLevel(b({ damaged: true }), now)).toBe(0);
  });
  it('boosts denarii for matching exercises', () => {
    const list = [b({ level: 2 }), b({ building: 'rack', level: 1 })];
    expect(machineBonus(list, ['Bench Press'], now)).toBeCloseTo(0.1);
    expect(machineBonus(list, ['Bench Press', 'Squat'], now)).toBeCloseTo(0.15);
    expect(machineBonus(list, ['Curl'], now)).toBe(0);
  });
  it('raises the member limit with barracks, at most 10', () => {
    expect(memberLimit([], now)).toBe(5);
    expect(memberLimit([b({ building: 'barracks', level: 5 })], now)).toBe(10);
  });
  it('costs more for a gym', () => {
    expect(levelMinutes('bench', 2, 'ludus')).toBe(720);
    expect(levelMinutes('bench', 2, 'gym')).toBe(2160);
  });
  it('adds up standing levels into a fortress level and stage', () => {
    const list = [b({ level: 2, damaged: true }), b({ building: 'rack', level: 3 })];
    expect(fortressLevel(list, now)).toBe(5);
    expect(fortressStage(0)).toBe(0);
    expect(fortressStage(3)).toBe(1);
    expect(fortressStage(9)).toBe(2);
    expect(fortressStage(10)).toBe(3);
  });
  it('picks the home picture from the rank', () => {
    expect(homeStage('tiro')).toBe(0);
    expect(homeStage('primus')).toBe(2);
    expect(homeStage('rudiarius')).toBe(3);
  });
});

describe('battles', () => {
  it('counts war points with daily limits', () => {
    const w = (at: string, prs = 0) => ({ user_id: 'a', started_at: at, prs });
    expect(warPoints([w('2026-11-02T08:00:00', 1)])).toBe(10 + 5 + 5);
    expect(
      warPoints([w('2026-11-02T08:00:00'), w('2026-11-02T12:00:00'), w('2026-11-02T18:00:00')]),
    ).toBe(25);
  });
  it('divides by active members and helps the defender', () => {
    expect(warScore(90, 1)).toBe(45);
    expect(warScore(90, 3)).toBe(30);
    expect(warScore(90, 3, 2)).toBe(33);
    expect(warWinner(10, 10)).toBe('defender');
    expect(warSpoils(5000)).toBe(720);
  });
  it('scores duels', () => {
    const list = [
      session('2026-11-01T10:00', three('b', 100)),
      session('2026-11-03T10:00', three('b', 105)),
      session('2026-11-04T10:00', three('c', 10)),
    ];
    const from = new Date('2026-11-02T00:00');
    const to = new Date('2026-11-09T00:00');
    expect(duelScore(list, 'workouts', null, from, to)).toBe(2);
    expect(duelScore(list, 'lift', 'b', from, to)).toBeCloseTo(5 * (1 + 5 / 30), 1);
  });
  it('needs 3 active members for Bellum', () => {
    expect(bellumScore(20, 2)).toBe(null);
    expect(bellumScore(30, 3)).toBe(10);
  });
});

describe('gloria', () => {
  it('rewards wins, more against a stronger ludus', () => {
    expect(gloriaChange(0, 0, 40, 20)).toEqual({ winner: 30, loser: 0 });
    expect(gloriaChange(100, 250, 40, 20)).toEqual({ winner: 45, loser: -10 });
    expect(gloriaChange(0, 900, 40, 20).winner).toBe(60);
  });
  it('costs nothing after a close loss', () => {
    expect(gloriaChange(50, 80, 40, 36).loser).toBe(0);
    expect(gloriaChange(50, 80, 40, 35).loser).toBe(-10);
    expect(gloriaChange(0, 0, 0, 0).loser).toBe(0);
  });
  it('keeps the record and streaks', () => {
    let r = applyWar(EMPTY_RECORD, true, true, false, 30);
    r = applyWar(r, true, false, true, 45);
    r = applyWar(r, false, false, false, -10);
    expect(r).toEqual({
      gloria: 65,
      best_gloria: 75,
      wins: 2,
      losses: 1,
      defences: 1,
      upsets: 1,
      streak: 0,
      best_streak: 2,
    });
    expect(applyWar(EMPTY_RECORD, false, false, false, -10).gloria).toBe(0);
  });
  it('earns ludus badges from the record', () => {
    const b = ludusBadges({ ...EMPTY_RECORD, wins: 6, best_gloria: 120 });
    const wins = b.find((x) => x.def.id === 'ludus-wins')!;
    expect(wins.earned.map((e) => e.threshold)).toEqual([1, 5]);
    expect(wins.next).toBe(10);
    expect(b.find((x) => x.def.id === 'ludus-gloria')!.earned).toHaveLength(1);
    expect(b.find((x) => x.def.id === 'ludus-walls')!.earned).toHaveLength(0);
  });
});

describe('attributes and the cell', () => {
  it('measures endurance and discipline', () => {
    const list: Session[] = [];
    for (let w = 1; w <= 12; w++)
      for (let d = 0; d < 3; d++) {
        const day = new Date('2026-11-16T10:00');
        day.setDate(day.getDate() - 7 * w + d);
        list.push(session(day.toISOString(), three()));
      }
    const a = attributes(list, (id) => names[id], null, 3, new Date('2026-11-18T12:00'));
    expect(a.discipline).toBe(99);
    expect(a.strength).toBe(null);
    expect(a.endurance).toBeGreaterThan(0);
  });
  it('opens items by level', () => {
    const items = cellItems(5);
    expect(items.filter((i) => i.unlocked).map((i) => i.item.id)).toEqual(['bed', 'lamp', 'palus']);
  });
});
