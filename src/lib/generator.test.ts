import { EQUIPMENT_EXERCISES } from '@/data/equipmentExercises';
import catalog from '@/data/exercises.json';

import {
  generatedName,
  generateWorkout,
  movementOf,
  effortCue,
  equipmentAlternatives,
  focusedPlan,
  planForTime,
  shapeText,
  presetOf,
  PRESETS,
  warmupExercises,
  workoutMinutes,
  type GenerateOptions,
} from './generator';
import { mainGroup, MUSCLE_GROUPS, setCredit, type MuscleGroup } from './muscleGroups';
import type { Exercise } from './types';

const all = catalog as {
  name: string;
  muscles: string[];
  tier: 'S' | 'A' | 'B' | null;
  core?: boolean;
}[];
const exercises: Exercise[] = all.map((e) => ({
  id: e.name,
  name: e.name,
  muscles: e.muscles,
  image_key: null,
  created_by: null,
  tier: e.tier,
}));
const curated = new Set(all.filter((e) => e.core).map((e) => e.name));
const byId = new Map(exercises.map((e) => [e.id, e]));

const make = (groups: MuscleGroup[], over: Partial<GenerateOptions> = {}) =>
  generateWorkout({
    groups,
    setsPerGroup: 6,
    restSeconds: null,
    goal: 'muscle',
    exercises,
    curated,
    favorites: new Set(),
    seed: 1,
    ...over,
  });

const creditFor = (list: ReturnType<typeof make>, group: MuscleGroup) =>
  list.reduce(
    (sum, e) => sum + (setCredit(byId.get(e.exercise_id)!.muscles).get(group) ?? 0) * e.sets,
    0,
  );

describe('generateWorkout', () => {
  it.each(MUSCLE_GROUPS)('builds a workout for %s alone', (group) => {
    const list = make([group]);
    expect(list.length).toBeGreaterThan(0);
    expect(mainGroup(byId.get(list[0].exercise_id)!.muscles)).toBe(group);
    expect(list.every((e) => e.sets >= 2)).toBe(true);
  });

  it('reaches the asked sets for a muscle with enough exercises', () => {
    expect(creditFor(make(['Chest']), 'Chest')).toBeGreaterThanOrEqual(5);
    expect(creditFor(make(['Back'], { setsPerGroup: 8 }), 'Back')).toBeGreaterThanOrEqual(7);
  });

  it('picks the best tier first', () => {
    const list = make(['Quads'], { setsPerGroup: 3 });
    expect(byId.get(list[0].exercise_id)!.tier).toBe('S');
  });

  it('prefers a favorite over the same tier and the next one', () => {
    const fav = exercises.find((e) => e.name === 'Goblet Squat')!; // B tier is one below A only
    const list = make(['Quads'], { setsPerGroup: 3, favorites: new Set([fav.id]) });
    expect(byId.get(list[0].exercise_id)!.tier).not.toBe(null);
    const leg = exercises.find((e) => e.name === 'Leg Press')!; // A tier moves up beside S
    const withLeg = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (seed) =>
        make(['Quads'], { setsPerGroup: 3, favorites: new Set([leg.id]), seed })[0].exercise_id,
    );
    expect(withLeg).toContain(leg.id);
  });

  it('does not repeat an exercise, and varies the movement', () => {
    const list = make(['Chest'], { setsPerGroup: 9 });
    const ids = list.map((e) => e.exercise_id);
    expect(new Set(ids).size).toBe(ids.length);
    const moves = ids.map((id) => movementOf(id));
    expect(new Set(moves).size).toBeGreaterThan(1);
  });

  it('counts assisting muscles at half, but still gives each chosen muscle its own exercise', () => {
    const list = make(['Chest', 'Triceps']);
    const own = list.filter((e) => mainGroup(byId.get(e.exercise_id)!.muscles) === 'Triceps');
    expect(own.length).toBeGreaterThan(0);
    const alone = make(['Triceps']);
    const ownSets = own.reduce((s, e) => s + e.sets, 0);
    const aloneSets = alone.reduce((s, e) => s + e.sets, 0);
    expect(ownSets).toBeLessThanOrEqual(aloneSets);
  });

  it('puts multi-joint lifts before isolation lifts', () => {
    const list = make(['Chest', 'Biceps', 'Back']);
    const iso = /curl|fly|crossover|pec deck|raise/i;
    const firstIso = list.findIndex((e) => iso.test(e.exercise_id));
    const lastCompound = list.map((e) => !iso.test(e.exercise_id)).lastIndexOf(true);
    expect(firstIso === -1 || lastCompound < firstIso).toBe(true);
  });

  it('uses the fixed rest when one is set, else the goal', () => {
    expect(make(['Chest'], { restSeconds: 120 }).every((e) => e.rest_seconds === 120)).toBe(true);
    expect(new Set(make(['Chest']).map((e) => e.rest_seconds)).size).toBeGreaterThan(0);
  });

  it('is the same for the same seed and shuffles for another', () => {
    expect(make(['Back'])).toEqual(make(['Back']));
    const seeds = [1, 2, 3, 4, 5, 6].map((seed) =>
      make(['Back'], { seed })
        .map((e) => e.exercise_id)
        .join(),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('skips your own exercises and the unrated rest of the catalog', () => {
    const list = make(['Chest'], { setsPerGroup: 10 });
    for (const e of list) {
      const ex = byId.get(e.exercise_id)!;
      expect(ex.tier || curated.has(ex.name)).toBeTruthy();
    }
  });

  it('keeps a full-body workout to a sane length', () => {
    expect(make([...MUSCLE_GROUPS], { setsPerGroup: 10 }).length).toBeLessThanOrEqual(12);
  });

  it('returns nothing for no muscles', () => {
    expect(make([])).toEqual([]);
  });
});

describe('generatedName', () => {
  it('names the muscles, biggest first', () => {
    expect(generatedName(['Triceps', 'Chest'])).toBe('Chest + Triceps');
  });

  it('calls most of the body Full body', () => {
    expect(generatedName(['Quads', 'Back', 'Chest', 'Hamstrings', 'Shoulders'])).toBe('Full body');
    expect(generatedName(['Quads', 'Back', 'Chest', 'Shoulders', 'Core', 'Biceps'])).toBe(
      'Full body',
    );
  });

  it('uses the name of a ready-made choice', () => {
    expect(generatedName(['Back', 'Chest', 'Shoulders', 'Triceps', 'Biceps'])).toBe('Upper');
    expect(presetOf(['Back', 'Biceps'])).toBe('Pull');
    expect(presetOf(['Back'])).toBeNull();
  });
});

describe('beginners', () => {
  const beginner = { experience: 'beginner' as const };

  it('get moderate weights even with a strength goal', () => {
    const list = make(['Chest', 'Back'], { ...beginner, goal: 'strength' });
    for (const e of list) {
      expect(e.reps_min).toBeGreaterThanOrEqual(8);
      expect(e.reps_max).toBeGreaterThanOrEqual(12);
      expect(e.sets).toBeLessThanOrEqual(3);
      expect(e.sets).toBeGreaterThanOrEqual(2);
    }
  });

  it('do not start with hard-to-learn lifts', () => {
    for (const preset of PRESETS) {
      for (const seed of [1, 2, 3]) {
        const names = make(preset.groups, { ...beginner, seed }).map((e) => e.exercise_id);
        expect(names.join()).not.toMatch(/front squat|good morning|jm press|sissy|nordic/i);
      }
    }
  });

  it('still get an exercise when only hard ones train the muscle', () => {
    expect(make(['Hamstrings'], beginner).length).toBeGreaterThan(0);
  });

  it('leaves experienced lifters on the goal', () => {
    expect(make(['Chest'], { goal: 'strength', experience: 'advanced' })[0].reps_min).toBeLessThan(
      8,
    );
  });
});

describe('warmupExercises', () => {
  const all = Object.fromEntries(byId);
  const pick = (exercise_id: string) => ({
    exercise_id,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 90,
  });

  it('warms up the first lift for legs, pushing and pulling', () => {
    expect(
      warmupExercises(
        [pick('Squat'), pick('Romanian Deadlift'), pick('Bench Press'), pick('Lat Pulldown')],
        all,
      ),
    ).toEqual(['Squat', 'Bench Press', 'Lat Pulldown']);
  });

  it('does not warm up again for the same part of the body', () => {
    expect(warmupExercises([pick('Bench Press'), pick('Skull Crusher')], all)).toEqual([
      'Bench Press',
    ]);
  });

  it('copes with an empty list', () => {
    expect(warmupExercises([], all)).toEqual([]);
  });
});

describe('workoutMinutes', () => {
  const one = { exercise_id: 'x', sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90 };

  it('counts sets, rests and moving between exercises', () => {
    expect(workoutMinutes([one])).toBe(8); // 3 × 2:15 + 1:00 = 7:45
  });

  it('adds warm-ups', () => {
    expect(workoutMinutes([one], 1)).toBe(11);
  });
});

describe('planForTime', () => {
  const options = (groups: MuscleGroup[], goal: GenerateOptions['goal'] = 'muscle') => ({
    groups,
    goal,
    exercises,
    curated,
    favorites: new Set<string>(),
    seed: 1,
  });
  const minutesOf = (o: ReturnType<typeof options>, plan: ReturnType<typeof planForTime>) =>
    workoutMinutes(generateWorkout({ ...o, ...plan }));
  const SLACK = 1.07;

  it('fits the workout into the time', () => {
    for (const minutes of [30, 45, 60, 90]) {
      const o = options(['Chest', 'Back']);
      expect(minutesOf(o, planForTime(o, minutes, 10))).toBeLessThanOrEqual(minutes * SLACK);
    }
  });

  it('gives more sets with more time', () => {
    const o = options(['Chest', 'Back']);
    expect(planForTime(o, 60, 10).setsPerGroup).toBeGreaterThan(
      planForTime(o, 30, 10).setsPerGroup,
    );
  });

  it('shortens the rest before it drops sets', () => {
    const o = options(['Quads', 'Chest', 'Back']);
    const plans = [25, 30, 35, 40, 45, 50].map((m) => planForTime(o, m, 8));
    expect(plans.some((p) => p.restSeconds === 120)).toBe(true);
  });

  it('keeps a rest the user chose', () => {
    const o = options(['Quads', 'Chest', 'Back']);
    for (const m of [25, 45, 90]) expect(planForTime(o, m, 8, false, 180).restSeconds).toBe(180);
    expect(planForTime(o, 45, 8, false, 90).setsPerGroup).toBeGreaterThan(
      planForTime(o, 45, 8, false, 180).setsPerGroup,
    );
  });

  it('keeps long rests for strength', () => {
    const o = options(['Chest', 'Back'], 'strength');
    expect(planForTime(o, 30, 8).restSeconds).toBeNull();
  });

  it('leaves room for warm-ups', () => {
    const o = options(['Quads', 'Chest', 'Back']);
    const plan = planForTime(o, 60, 8, true);
    const list = generateWorkout({ ...o, ...plan });
    const warmups = warmupExercises(list, Object.fromEntries(byId)).length;
    expect(workoutMinutes(list, warmups)).toBeLessThanOrEqual(60 * SLACK);
  });

  it('stops at the limit for the experience, even with time left', () => {
    expect(planForTime(options(['Biceps']), 90, 6).setsPerGroup).toBe(6);
  });

  it('falls back to the fewest sets when nothing fits', () => {
    expect(planForTime(options([...MUSCLE_GROUPS]), 10, 10).setsPerGroup).toBe(2);
  });
});

describe('default rest', () => {
  it('is 3 minutes on big lifts and 2 on small ones', () => {
    for (const goal of ['muscle', 'health', 'lean', 'strength'] as const) {
      for (const experience of ['beginner', 'advanced'] as const) {
        const list = make(['Chest', 'Biceps'], { goal, experience });
        for (const e of list)
          expect(e.rest_seconds).toBe(
            /curl|fly|crossover|pec deck/i.test(e.exercise_id) ? 120 : 180,
          );
      }
    }
  });

  it('stays short for endurance', () => {
    expect(make(['Chest'], { goal: 'endurance' }).every((e) => e.rest_seconds <= 60)).toBe(true);
  });
});

describe('what a coach would object to', () => {
  const names = (groups: MuscleGroup[], over: Partial<GenerateOptions> = {}) =>
    make(groups, over).map((e) => e.exercise_id);

  it('keeps a beginner off rare machines and hard lifts', () => {
    for (const preset of PRESETS)
      for (const seed of [1, 2, 3, 4])
        expect(names(preset.groups, { experience: 'beginner', seed }).join()).not.toMatch(
          /pendulum|romanian deadlift|prayer|close grip|jm press/i,
        );
  });

  it('gives shoulders side-delt work before rear-delt work', () => {
    const second = names(['Shoulders'], { setsPerGroup: 6 })[1];
    expect(byId.get(second)!.muscles[0]).toBe('shoulders');
  });

  it('builds back on rows and pulldowns', () => {
    const list = names(['Back'], { setsPerGroup: 6, experience: 'beginner' });
    expect(list.every((n) => /row|pulldown|pull/i.test(n))).toBe(true);
  });

  it('trains arms with arm exercises, not a press', () => {
    expect(names(['Triceps'], { setsPerGroup: 3 })[0]).not.toMatch(/press/i);
  });

  it('never loads a lunge for 3 to 6 repetitions', () => {
    const list = make(['Quads', 'Glutes'], { goal: 'strength', setsPerGroup: 10 });
    for (const e of list)
      if (/lunge|step up|split squat/i.test(e.exercise_id))
        expect(e.reps_min).toBeGreaterThanOrEqual(6);
  });

  it('fits a full body workout into 30 minutes for a beginner, without warm-ups', () => {
    const o = {
      groups: PRESETS[0].groups,
      goal: 'health' as const,
      experience: 'beginner' as const,
      exercises,
      curated,
      favorites: new Set<string>(),
      seed: 1,
    };
    const plan = planForTime(o, 30, 6);
    const list = generateWorkout({ ...o, ...plan });
    expect(plan.dropped).toContain('Shoulders');
    expect(workoutMinutes(list)).toBeLessThanOrEqual(33);
    expect(list.every((e) => e.sets >= 2)).toBe(true);
  });
});

describe('focusedPlan', () => {
  const beginner = {
    groups: PRESETS[0].groups,
    goal: 'muscle' as const,
    experience: 'beginner' as const,
    exercises,
    curated,
    favorites: new Set<string>(),
    seed: 1,
  };
  const listOf = (plan: ReturnType<typeof planForTime>) =>
    generateWorkout({ ...beginner, ...plan });

  it('turns 5 exercises of 2 sets into 4 of 3 in the same 45 minutes', () => {
    const base = listOf(planForTime(beginner, 45, 6, true));
    expect(shapeText(base)).toBe('5 exercises, 2 sets each');
    const plan = focusedPlan(beginner, 45, 6, true)!;
    const list = listOf(plan);
    expect(shapeText(list)).toBe('4 exercises, 3 sets each');
    expect(plan.dropped).toEqual(['Shoulders']);
    const warmups = warmupExercises(list, Object.fromEntries(byId)).length;
    expect(workoutMinutes(list, warmups)).toBeLessThanOrEqual(48);
  });

  it('offers nothing when no muscle is covered by another', () => {
    expect(focusedPlan({ ...beginner, groups: ['Quads'] }, 45, 6, true)).toBeNull();
  });

  it('keeps a rest the user chose', () => {
    const plan = focusedPlan(beginner, 60, 6, true, 180);
    if (plan) expect(plan.restSeconds).toBe(180);
  });
});

describe('shapeText', () => {
  const e = (sets: number) => ({
    exercise_id: 'x',
    sets,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 120,
  });

  it('reads naturally', () => {
    expect(shapeText([e(2), e(2)])).toBe('2 exercises, 2 sets each');
    expect(shapeText([e(2), e(3)])).toBe('2 exercises, 2–3 sets each');
    expect(shapeText([e(3)])).toBe('1 exercise, 3 sets');
  });
});

describe('effortCue', () => {
  const e = (sets: number) => ({
    exercise_id: 'x',
    sets,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 120,
  });

  it('asks for more when there are few sets', () => {
    expect(effortCue([e(2), e(2)])).toContain('1–2 repetitions');
    expect(effortCue([e(3), e(3)])).toContain('2–3 repetitions');
  });
});

describe('equipment', () => {
  const kinds = ['dumbbells', 'bodyweight', 'home'] as const;

  it('lists only exercises that exist', () => {
    for (const kind of kinds)
      for (const g of MUSCLE_GROUPS)
        for (const name of EQUIPMENT_EXERCISES[kind][g]) expect(byId.has(name)).toBe(true);
  });

  it.each(kinds)('builds every ready-made choice with %s', (equipment) => {
    for (const preset of PRESETS) {
      const list = make(preset.groups, { equipment });
      const allowed = Object.values(EQUIPMENT_EXERCISES[equipment]).flat();
      expect(list.length).toBeGreaterThan(0);
      for (const e of list) expect(allowed).toContain(e.exercise_id);
    }
  });

  it.each(kinds)('gives every muscle an exercise with %s', (equipment) => {
    for (const g of MUSCLE_GROUPS) expect(make([g], { equipment }).length).toBeGreaterThan(0);
  });

  it('never gives a machine, a cable or a barbell without a gym', () => {
    for (const equipment of kinds)
      for (const seed of [1, 2, 3])
        expect(
          make([...MUSCLE_GROUPS], { equipment, seed, setsPerGroup: 8 })
            .map((e) => e.exercise_id)
            .join(),
        ).not.toMatch(/machine|cable|barbell|smith|(^|,)bench press|pec deck|pulldown|handstand/i);
  });

  it('counts a list pick in full for its muscle', () => {
    const list = make(['Hamstrings'], { equipment: 'dumbbells', setsPerGroup: 3 });
    expect(list).toHaveLength(1);
    expect(list[0].exercise_id).toBe('Dumbbell Romanian Deadlift');
  });

  it('keeps bodyweight sets high in repetitions, whatever the goal', () => {
    for (const equipment of ['bodyweight', 'home'] as const)
      for (const e of make(['Quads'], { equipment, goal: 'strength' })) {
        expect(e.reps_min).toBe(8);
        expect(e.reps_max).toBe(20);
      }
  });

  it('keeps dumbbell sets out of the very heavy range', () => {
    for (const e of make(['Chest'], { equipment: 'dumbbells', goal: 'strength' }))
      expect(e.reps_min).toBeGreaterThanOrEqual(6);
  });

  it('keeps a beginner away from pull-ups when there is another way', () => {
    const list = make(['Back'], { equipment: 'bodyweight', experience: 'beginner' });
    expect(list.map((e) => e.exercise_id).join()).not.toMatch(/pull up|chin up/i);
  });

  it('fits the time with dumbbells', () => {
    const o = {
      groups: PRESETS[0].groups,
      goal: 'muscle' as const,
      equipment: 'dumbbells' as const,
      exercises,
      curated,
      favorites: new Set<string>(),
      seed: 1,
    };
    const list = generateWorkout({ ...o, ...planForTime(o, 45, 6, true) });
    const warmups = warmupExercises(list, Object.fromEntries(byId)).length;
    expect(workoutMinutes(list, warmups)).toBeLessThanOrEqual(45 * 1.07);
  });

  it('asks for fewer repetitions of pull-ups', () => {
    const list = make(['Back'], {
      equipment: 'bodyweight',
      experience: 'advanced',
      setsPerGroup: 8,
    });
    for (const e of list) expect(e.reps_max).toBe(/pull up|chin up/i.test(e.exercise_id) ? 12 : 20);
  });

  it('uses the bar for bodyweight', () => {
    const list = make(['Back'], {
      equipment: 'bodyweight',
      experience: 'advanced',
      setsPerGroup: 8,
    });
    expect(list.map((e) => e.exercise_id).join()).toMatch(/pull up|chin up/i);
  });

  it('needs no bar at home, but offers one as a swap', () => {
    for (const seed of [1, 2, 3, 4])
      for (const experience of ['beginner', 'advanced'] as const)
        expect(
          make([...MUSCLE_GROUPS], {
            equipment: 'home',
            seed,
            experience,
            setsPerGroup: 10,
          })
            .map((e) => e.exercise_id)
            .join(),
        ).not.toMatch(/pull up|chin up|inverted row/i);
    const swaps = equipmentAlternatives(
      'home',
      byId.get('Bodyweight Standing Row with Towel')!,
      exercises,
    ).map((e) => e.name);
    expect(swaps).toContain('Pull Up');
  });

  it('offers swaps with the same equipment', () => {
    const push = byId.get('Push Up')!;
    const names = equipmentAlternatives('bodyweight', push, exercises).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['Incline Push Up', 'Decline Push Up']));
    expect(names).not.toContain('Push Up');
  });
});
