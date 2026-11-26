import type { Session, SetEntry } from '../types';
import { GEAR, STYLE, TRIBE_WAR, XP } from './config';
import { computeGame, styleAt } from './engine';
import {
  bestLeague,
  GEAR_ITEMS,
  gearPower,
  gearWarBonus,
  MAX_POWER,
  owns,
  START_LOADOUT,
  weakestSlot,
  worn,
  type GearProgress,
} from './gear';
import { canChangeStyle, styleMatches, type StyleWorkout } from './styles';
import {
  cityPlaces,
  compareStrength,
  countdownText,
  distanceKm,
  influenceRadius,
  placeGyms,
  revengeUntil,
  sideGearBonus,
  tribeScore,
  tribeSpoils,
  tribeStrength,
  tribeWarPhase,
  tribeWarTimes,
} from './tribes';

let n = 0;
const set = (exercise_id: string, weight_kg: number, reps: number, extra: Partial<SetEntry> = {}) =>
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

const MUSCLES: Record<string, string[]> = {
  squat: ['quads', 'glutes'],
  bench: ['chest', 'triceps'],
  row: ['back', 'biceps'],
  press: ['shoulders'],
  run: ['cardio'],
  pullup: ['back'],
};
const w = (sets: SetEntry[], streak = 0): StyleWorkout => ({
  sets,
  muscles: (id) => MUSCLES[id] ?? [],
  streak,
});

describe('fighting styles', () => {
  it('rewards heavy sets for the murmillo', () => {
    expect(styleMatches('murmillo', w([set('squat', 100, 5)]))).toBe(true);
    expect(styleMatches('murmillo', w([set('squat', 100, 8)]))).toBe(false);
    expect(styleMatches('murmillo', w([set('pullup', 0, 5)]))).toBe(false);
  });
  it('rewards the 8–15 rep range for the thraex, not more sets', () => {
    expect(styleMatches('thraex', w([set('bench', 60, 10), set('bench', 60, 9)]))).toBe(true);
    expect(
      styleMatches('thraex', w([set('bench', 60, 10), set('bench', 80, 3), set('bench', 80, 3)])),
    ).toBe(false);
  });
  it('rewards cardio or a superset for the retiarius', () => {
    expect(styleMatches('retiarius', w([set('run', 0, 1)]))).toBe(true);
    expect(styleMatches('retiarius', w([set('bench', 60, 10, { superset_id: 'a' })]))).toBe(true);
    expect(styleMatches('retiarius', w([set('bench', 60, 10)]))).toBe(false);
  });
  it('rewards a kept streak for the secutor', () => {
    expect(styleMatches('secutor', w([set('bench', 60, 10)], 1))).toBe(true);
    expect(styleMatches('secutor', w([set('bench', 60, 10)], 0))).toBe(false);
  });
  it('rewards many muscle groups for the hoplomachus', () => {
    const four = [set('squat', 1, 5), set('bench', 1, 5), set('row', 1, 5), set('press', 1, 5)];
    expect(styleMatches('hoplomachus', w(four))).toBe(true);
    expect(styleMatches('hoplomachus', w(four.slice(1)))).toBe(false);
  });
  it('rewards bodyweight work for the bestiarius', () => {
    expect(styleMatches('bestiarius', w([set('pullup', 0, 8), set('bench', 60, 8)]))).toBe(true);
    expect(
      styleMatches(
        'bestiarius',
        w([set('pullup', 0, 8), set('bench', 60, 8), set('bench', 60, 8)]),
      ),
    ).toBe(false);
  });
  it('never matches an empty workout', () => {
    expect(styleMatches('secutor', w([], 3))).toBe(false);
  });
  it('changes once a season', () => {
    expect(canChangeStyle(null, '2026-11')).toBe(true);
    expect(canChangeStyle('2026-11', '2026-11')).toBe(false);
    expect(canChangeStyle('2026-10', '2026-11')).toBe(true);
  });
  it('picks the style in force when a workout started', () => {
    const styles = [
      { id: 'murmillo' as const, since: '2026-10-01T00:00:00.000Z' },
      { id: 'thraex' as const, since: '2026-11-01T00:00:00.000Z' },
    ];
    expect(styleAt(styles, '2026-09-30T10:00:00.000Z')).toBeNull();
    expect(styleAt(styles, '2026-10-15T10:00:00.000Z')?.id).toBe('murmillo');
    expect(styleAt(styles, '2026-11-15T10:00:00.000Z')?.id).toBe('thraex');
  });
  it('adds the style bonus to XP within the daily cap', () => {
    const s: Session = {
      id: 'heavy',
      user_id: 'u',
      program_day_id: null,
      name: 'W',
      started_at: '2026-11-10T10:00:00.000Z',
      finished_at: '2026-11-10T11:00:00.000Z',
      volume_kg: 0,
      set_count: 3,
      pr_count: 0,
      updated_at: '',
      sets: [set('squat', 100, 5), set('squat', 100, 5), set('squat', 100, 5)],
    };
    const input = {
      sessions: [s],
      exerciseName: () => 'Squat',
      experience: 'beginner' as const,
      weeklyTarget: 3,
      dotsCoefficient: null,
      verification: () => null,
      exerciseMuscles: (id: string) => MUSCLES[id] ?? [],
      now: new Date('2026-11-20T12:00:00'),
    };
    expect(computeGame(input).xp).toBe(XP.workout);
    const styled = computeGame({
      ...input,
      styles: [{ id: 'murmillo', since: '2026-11-01T00:00:00.000Z' }],
    });
    expect(styled.xp).toBe(XP.workout + STYLE.xp);
    expect(styled.sessions.heavy.xpParts.at(-1)?.label).toBe('Murmillo style');
    // Chosen after the workout: no bonus.
    expect(
      computeGame({ ...input, styles: [{ id: 'murmillo', since: '2026-11-11T00:00:00.000Z' }] }).xp,
    ).toBe(XP.workout);
  });
});

describe('gear', () => {
  const none: GearProgress = { level: 1, verified: 0, league: 'bronze', bought: new Set() };
  it('has art-matching ids, one start piece per slot', () => {
    expect(new Set(GEAR_ITEMS.map((g) => g.id)).size).toBe(GEAR_ITEMS.length);
    expect(Object.keys(START_LOADOUT)).toHaveLength(5);
  });
  it('wears the start pieces in empty slots', () => {
    expect(worn({}, 'helmet').id).toBe('helmet_galea');
    expect(gearPower({})).toBe(40 + 20 + 30 + 20 + 10);
    expect(gearPower({ helmet: 'helmet_laurel' })).toBe(100 + 20 + 30 + 20 + 10);
  });
  it('opens pieces by denarii, level, verified workouts and league', () => {
    const at = (id: string, p: Partial<GearProgress>) =>
      owns(
        GEAR_ITEMS.find((g) => g.id === id)!,
        { ...none, ...p },
      );
    expect(at('helmet_galea', {})).toBe(true);
    expect(at('helmet_secutor', {})).toBe(false);
    expect(at('helmet_secutor', { bought: new Set(['helmet_secutor']) })).toBe(true);
    expect(at('helmet_thraex', { level: 14 })).toBe(false);
    expect(at('helmet_thraex', { level: 15 })).toBe(true);
    expect(at('armour_straps', { verified: 25 })).toBe(true);
    expect(at('helmet_galea_gold', { league: 'silver' })).toBe(false);
    expect(at('helmet_galea_gold', { league: 'imperator' })).toBe(true);
    expect(at('armour_lorica', { league: 'gold' })).toBe(false);
  });
  it('turns power into at most the maximum war bonus', () => {
    expect(gearWarBonus(0)).toBe(0);
    expect(gearWarBonus(MAX_POWER)).toBe(GEAR.maxWarBonus);
    expect(gearWarBonus(MAX_POWER * 2)).toBe(GEAR.maxWarBonus);
    expect(gearWarBonus(MAX_POWER / 2)).toBeCloseTo(GEAR.maxWarBonus / 2, 3);
  });
  it('finds the best league and the slot with most to gain', () => {
    expect(bestLeague(['bronze', 'gold', 'silver'])).toBe('gold');
    expect(bestLeague([])).toBe('bronze');
    expect(weakestSlot({}).slot).toBe('armour');
  });
});

describe('tribe attacks', () => {
  it('sums the strength of active members only', () => {
    expect(
      tribeStrength([
        { workouts: 3, gearPower: 200 },
        { workouts: 0, gearPower: 400 },
      ]),
    ).toBe(3 * TRIBE_WAR.strengthPerWorkout + 200);
  });
  it('averages the gear bonus of a side', () => {
    expect(sideGearBonus([])).toBe(0);
    expect(sideGearBonus([MAX_POWER, 0])).toBeCloseTo(GEAR.maxWarBonus / 2, 3);
  });
  it('scores per active member (at least 3) with walls, gear and revenge', () => {
    expect(tribeScore({ points: 300, active: 1, gearBonus: 0 })).toBe(100);
    expect(tribeScore({ points: 300, active: 6, gearBonus: 0 })).toBe(50);
    expect(tribeScore({ points: 300, active: 6, gearBonus: 0.1, palisade: 2 })).toBe(
      Math.round(50 * (1 + 0.1 + 2 * TRIBE_WAR.wallBonus) * 10) / 10,
    );
    expect(tribeScore({ points: 300, active: 6, gearBonus: 0, revenge: true })).toBe(60);
  });
  it('takes a capped share of the treasury', () => {
    expect(tribeSpoils(1000)).toBe(200);
    expect(tribeSpoils(100000)).toBe(TRIBE_WAR.maxSpoils);
    expect(tribeSpoils(-5)).toBe(0);
  });
  it('warns a day ahead, fights three days, then allows revenge for a day', () => {
    const t = tribeWarTimes(new Date('2026-11-14T10:00:00.000Z'));
    expect(t.starts_at).toBe('2026-11-15T10:00:00.000Z');
    expect(t.ends_at).toBe('2026-11-18T10:00:00.000Z');
    expect(tribeWarPhase(t, new Date('2026-11-14T20:00:00.000Z'))).toBe('warning');
    expect(tribeWarPhase(t, new Date('2026-11-16T20:00:00.000Z'))).toBe('battle');
    expect(tribeWarPhase(t, new Date('2026-11-18T10:00:00.000Z'))).toBe('over');
    expect(revengeUntil(t.ends_at).toISOString()).toBe('2026-11-19T10:00:00.000Z');
  });
  it('writes countdowns', () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    expect(countdownText('2026-11-14T15:42:00.000Z', now)).toBe('5 h 42 min');
    expect(countdownText('2026-11-16T13:00:00.000Z', now)).toBe('2 d 3 h');
    expect(countdownText('2026-11-14T10:12:30.000Z', now)).toBe('12 min');
    expect(countdownText('2026-11-13T10:00:00.000Z', now)).toBe('0 min');
  });
});

describe('the city map', () => {
  it('grows the territory with the fortress level', () => {
    expect(influenceRadius(10, 350)).toBeGreaterThan(influenceRadius(0, 350));
    expect(influenceRadius(99, 350)).toBe(influenceRadius(15, 350));
  });
  it('places gyms inside the map and keeps north up', () => {
    const pts = placeGyms(
      [
        { id: 'n', name: 'N', lat: 49.25, lng: 16.6, level: 3 },
        { id: 's', name: 'S', lat: 49.15, lng: 16.6, level: 3 },
        { id: 'e', name: 'E', lat: 49.2, lng: 16.7, level: 3 },
        { id: 'x', name: 'X', lat: null, lng: null, level: 0 },
      ],
      350,
    );
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(350);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(350);
    }
    const at = (id: string) => pts.find((p) => p.id === id)!;
    expect(at('n').y).toBeLessThan(at('s').y);
    expect(at('e').x).toBeGreaterThan(at('n').x);
  });
  it('puts a lone gym in the middle', () => {
    expect(
      placeGyms([{ id: 'a', name: 'A', lat: null, lng: null, level: 0 }], 300)[0],
    ).toMatchObject({ x: 150, y: 150 });
  });
  it('measures distance', () => {
    expect(distanceKm({ lat: 49.19, lng: 16.6 }, { lat: 49.2, lng: 16.6 })).toBeCloseTo(1.1, 1);
    expect(distanceKm({ lat: null, lng: 16 }, { lat: 49, lng: 16 })).toBeNull();
  });
  it('ranks the city by territories, then fortress level', () => {
    const places = cityPlaces([
      { id: 'a', level: 9, territories: 1 },
      { id: 'b', level: 5, territories: 2 },
      { id: 'c', level: 7, territories: 1 },
      { id: 'd', level: 3, territories: 0 },
    ]);
    expect([...places.entries()]).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });
  it('compares strength with a 10 % band', () => {
    expect(compareStrength(1000, 850)).toBe('weaker');
    expect(compareStrength(1000, 1050)).toBe('even');
    expect(compareStrength(1000, 1200)).toBe('stronger');
  });
});
