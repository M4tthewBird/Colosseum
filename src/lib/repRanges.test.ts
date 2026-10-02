import { exerciseKind, orderedGoals, primaryGoal, recommend } from './repRanges';

describe('rep range recommendations', () => {
  it('tells compound and isolation lifts apart', () => {
    expect(exerciseKind('Squat')).toBe('compound');
    expect(exerciseKind('Bench press')).toBe('compound');
    expect(exerciseKind('Romanian deadlift')).toBe('compound');
    expect(exerciseKind('Bayesian cable curl')).toBe('isolation');
    expect(exerciseKind('Cable lateral raise')).toBe('isolation');
    expect(exerciseKind('Leg extension')).toBe('isolation');
    expect(exerciseKind('45-degree back extension')).toBe('isolation');
  });

  it('recommends heavy, low reps for strength on compound lifts', () => {
    expect(recommend('strength', 'Squat')).toMatchObject({
      reps_min: 3,
      reps_max: 6,
      rest_seconds: 180,
    });
  });

  it('recommends moderate reps for muscle, higher for isolation', () => {
    expect(recommend('muscle', 'Bench press')).toMatchObject({ reps_min: 6, reps_max: 10 });
    expect(recommend('muscle', 'Biceps curl')).toMatchObject({ reps_min: 10, reps_max: 15 });
  });

  it('recommends 15+ reps for endurance isolation work', () => {
    expect(recommend('endurance', 'Lateral raise')).toMatchObject({ reps_min: 15, reps_max: 20 });
  });

  it('picks the primary goal by priority, health by default', () => {
    expect(primaryGoal(['endurance', 'muscle', 'strength'])).toBe('strength');
    expect(primaryGoal(['lean', 'health'])).toBe('lean');
    expect(primaryGoal([])).toBe('health');
    expect(orderedGoals(['health', 'muscle'])).toEqual(['muscle', 'health']);
  });

  it('returns a copy, not the shared table row', () => {
    const r = recommend('muscle', 'Squat');
    r.sets = 99;
    expect(recommend('muscle', 'Squat').sets).toBe(3);
  });
});
