import {
  completedWorkouts,
  dayAbbrev,
  dayAbbrevs,
  programWeek,
  upNextDay,
  weekStrip,
  weeklyTarget,
} from './programs';
import type { Program } from './types';

const program = (scheduled: boolean): Program => ({
  id: 'p',
  owner_id: 'u',
  name: 'PPL',
  weeks: 8,
  training_days: [1, 2, 4, 5],
  phases: [],
  is_active: true,
  started_on: '2025-09-15',
  updated_at: '',
  created_at: '',
  days: [
    { id: 'push', position: 0, name: 'Push Day', weekdays: scheduled ? [2, 5] : [], exercises: [] },
    { id: 'pull', position: 1, name: 'Pull Day', weekdays: scheduled ? [1, 4] : [], exercises: [] },
    { id: 'legs', position: 2, name: 'Leg Day', weekdays: [], exercises: [] },
  ],
});

// Tuesday 30 Sep 2025, 09:00
const tue = new Date(2025, 8, 30, 9);

describe('upNextDay', () => {
  it("picks today's scheduled day", () => {
    expect(upNextDay(program(true), [], tue)?.id).toBe('push');
  });

  it('skips today once trained and finds the next weekday', () => {
    const done = [{ program_day_id: 'push', started_at: new Date(2025, 8, 30, 7).toISOString() }];
    expect(upNextDay(program(true), done, tue)?.id).toBe('pull'); // Thursday
  });

  it('goes in order when nothing is scheduled', () => {
    const done = [
      { program_day_id: 'push', started_at: new Date(2025, 8, 26).toISOString() },
      { program_day_id: 'pull', started_at: new Date(2025, 8, 28).toISOString() },
    ];
    expect(upNextDay(program(false), done, tue)?.id).toBe('legs');
    expect(upNextDay(program(false), [], tue)?.id).toBe('push');
  });

  it('wraps around', () => {
    const done = [{ program_day_id: 'legs', started_at: new Date(2025, 8, 28).toISOString() }];
    expect(upNextDay(program(false), done, tue)?.id).toBe('push');
  });
});

describe('program progress', () => {
  it('uses the training days as the weekly target', () => {
    expect(weeklyTarget(program(true))).toBe(4);
    expect(weeklyTarget(null)).toBe(3);
  });

  it('computes the program week', () => {
    expect(programWeek(program(true), tue)).toBe(3);
  });

  it('counts completed workouts since the start', () => {
    const done = [
      { program_day_id: 'push', started_at: new Date(2025, 8, 10).toISOString() },
      { program_day_id: 'push', started_at: new Date(2025, 8, 16).toISOString() },
      { program_day_id: null, started_at: new Date(2025, 8, 17).toISOString() },
    ];
    expect(completedWorkouts(program(true), done)).toBe(1);
  });

  it('builds the week strip', () => {
    const done = [{ program_day_id: 'pull', started_at: new Date(2025, 8, 29, 18).toISOString() }];
    const strip = weekStrip(program(true), done, tue);
    expect(strip.map((d) => d.state)).toEqual([
      'done',
      'today',
      'rest',
      'next',
      'next',
      'rest',
      'rest',
    ]);
    expect(strip[0].label).toBe('Pl');
    expect(strip[1].label).toBe('Pu');
  });

  it('abbreviates day names uniquely', () => {
    expect(dayAbbrev('Leg Day')).toBe('Le');
    expect(dayAbbrev('Upper 1')).toBe('U1');
    expect(dayAbbrev('Lower 2')).toBe('L2');
    expect(dayAbbrev('Full Body A')).toBe('FA');
    const m = dayAbbrevs([
      { id: 'a', name: 'Push Day' },
      { id: 'b', name: 'Pull Day' },
    ]);
    expect([m.get('a'), m.get('b')]).toEqual(['Pu', 'Pl']);
  });
});
