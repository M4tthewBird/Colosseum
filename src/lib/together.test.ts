import {
  confirmOpen,
  defaultPlan,
  goingText,
  parseClock,
  planDate,
  planIsLive,
  readCode,
  sortPlans,
  trainedRecently,
  whenLabel,
} from './together';

const now = new Date(2026, 10, 2, 14, 10);
const at = (h: number, m = 0, day = 2) => new Date(2026, 10, day, h, m).toISOString();

describe('parseClock', () => {
  it('reads the usual ways to type a time', () => {
    expect(parseClock('17:30')).toEqual({ h: 17, m: 30 });
    expect(parseClock('17.30')).toEqual({ h: 17, m: 30 });
    expect(parseClock('1730')).toEqual({ h: 17, m: 30 });
    expect(parseClock('7')).toEqual({ h: 7, m: 0 });
  });

  it('refuses what is not a time', () => {
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('17:75')).toBeNull();
    expect(parseClock('soon')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('planDate', () => {
  it('sets the time on the chosen day', () => {
    expect(planDate('today', '17:30', now)?.toISOString()).toBe(at(17, 30));
    expect(planDate('tomorrow', '7:00', now)?.toISOString()).toBe(at(7, 0, 3));
  });

  it('refuses a time that is over', () => {
    expect(planDate('today', '9:00', now)).toBeNull();
    expect(planDate('today', 'x', now)).toBeNull();
  });
});

describe('defaultPlan', () => {
  it('takes the next half hour at least 30 minutes away', () => {
    expect(defaultPlan(now)).toEqual({ day: 'today', time: '15:00' });
  });

  it('rolls over to tomorrow late at night', () => {
    expect(defaultPlan(new Date(2026, 10, 2, 23, 50))).toEqual({ day: 'tomorrow', time: '0:30' });
  });
});

describe('whenLabel', () => {
  it('names the day', () => {
    expect(whenLabel(at(17, 30), now)).toBe('Today 17:30');
    expect(whenLabel(at(7, 5, 3), now)).toBe('Tomorrow 7:05');
    expect(whenLabel(at(18, 0, 6), now)).toBe('Friday 18:00');
  });
});

describe('planIsLive', () => {
  it('stays up for two hours after its time', () => {
    expect(planIsLive(at(13), now)).toBe(true);
    expect(planIsLive(at(12, 11), now)).toBe(true);
    expect(planIsLive(at(12, 9), now)).toBe(false);
  });
});

describe('sortPlans', () => {
  const plan = (id: string, h: number, inviteeId: string | null, myAnswer: boolean | null) => ({
    id,
    planned_at: at(h),
    inviteeId,
    myAnswer,
  });

  it('puts invites waiting for an answer first, then goes by time', () => {
    const sorted = sortPlans(
      [plan('late', 19, null, null), plan('early', 16, null, null), plan('invite', 20, 'me', null)],
      'me',
    );
    expect(sorted.map((p) => p.id)).toEqual(['invite', 'early', 'late']);
  });

  it('hides plans I said no to and does not push answered invites up', () => {
    const sorted = sortPlans(
      [plan('no', 15, 'me', false), plan('yes', 20, 'me', true), plan('open', 16, null, null)],
      'me',
    );
    expect(sorted.map((p) => p.id)).toEqual(['open', 'yes']);
  });
});

describe('confirmOpen', () => {
  it('is open for 12 hours after the workout', () => {
    expect(confirmOpen(at(3), now)).toBe(true);
    expect(confirmOpen(at(2), now)).toBe(false);
    expect(confirmOpen(null, now)).toBe(false);
  });
});

describe('trainedRecently', () => {
  it('needs a workout from the last 12 hours', () => {
    expect(trainedRecently([{ started_at: at(13) }], now)).toBe(true);
    expect(trainedRecently([{ started_at: at(1) }], now)).toBe(false);
    expect(trainedRecently([], now)).toBe(false);
  });
});

describe('readCode', () => {
  const id = '6f1d2c3b-1111-4222-8333-444455556666';

  it('reads workout codes on the web and in the app', () => {
    expect(readCode(`https://x.github.io/Colosseum/together/${id}`)).toEqual({
      kind: 'together',
      id,
    });
    expect(readCode(`colosseum://together/${id}?a=1`)).toEqual({ kind: 'together', id });
  });

  it('reads friend codes', () => {
    expect(readCode('https://x.github.io/Colosseum/add/tomas')).toEqual({
      kind: 'friend',
      username: 'tomas',
    });
  });

  it('ignores anything else', () => {
    expect(readCode('https://example.com/menu')).toBeNull();
    expect(readCode('/together/not-a-workout')).toBeNull();
  });
});

describe('goingText', () => {
  it('reads naturally for any number of people', () => {
    expect(goingText([])).toBe('');
    expect(goingText(['Tom'])).toBe('Tom is in');
    expect(goingText(['You'])).toBe('You are in');
    expect(goingText(['Tom', 'Ada'])).toBe('Tom and Ada are in');
    expect(goingText(['Tom', 'Ada', 'Jan'])).toBe('Tom and 2 more are in');
  });

  it('can leave out the verb', () => {
    expect(goingText(['Tom', 'Ada'], false)).toBe('Tom and Ada');
  });
});
