import { useQueue, type QueueItem } from '@/stores/queue';
import { flush, isRefused, retrySync, setSessionLookup, syncRow } from './sync';

type Result = { error: { message: string } | null; status: number };
/** Decides the answer for each request, from the ids in it. */
let answer: (ids: string[]) => Result = () => ({ error: null, status: 201 });
const requests: string[][] = [];

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }), { virtual: true });
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }), {
  virtual: true,
});
jest.mock('./storage', () => ({
  isServer: false,
  safeStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
jest.mock('./supabase', () => ({
  isDemo: false,
  supabase: {
    auth: { getSession: async () => ({ data: { session: {} } }) },
    from: () => ({
      upsert: async (rows: { id: string }[]) => {
        const ids = rows.map((r) => r.id);
        requests.push(ids);
        return answer(ids);
      },
    }),
  },
}));

const item = (id: string): Omit<QueueItem, 'key'> => ({
  table: 'set_entries',
  op: 'upsert',
  id,
  row: { id },
});
const left = () => useQueue.getState().items.map((i) => [i.id, i.failed ?? null]);
const refuse = (bad: string) => (ids: string[]) =>
  ids.includes(bad)
    ? { error: { message: `no ${bad}` }, status: 400 }
    : { error: null, status: 201 };

beforeEach(() => {
  useQueue.setState({ items: [], lastError: null });
  requests.length = 0;
  answer = () => ({ error: null, status: 201 });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => {
  jest.useRealTimers();
  setSessionLookup(() => undefined);
});

describe('isRefused', () => {
  it.each([400, 403, 404, 409])('%i will not pass by waiting', (status) => {
    expect(isRefused(status)).toBe(true);
  });
  it.each([0, 401, 408, 429, 500, 503])('%i can pass', (status) => {
    expect(isRefused(status)).toBe(false);
  });
});

describe('flush', () => {
  it('sends everything and empties the queue', async () => {
    useQueue.getState().enqueue([item('a'), item('b')]);
    await flush();
    expect(left()).toEqual([]);
    expect(requests).toEqual([['a', 'b']]);
  });

  it('one refused row does not hold up the rest', async () => {
    useQueue.getState().enqueue([item('a'), item('bad'), item('c')]);
    answer = refuse('bad');
    await flush();
    expect(left()).toEqual([['bad', 'no bad']]);
    expect(useQueue.getState().lastError).toBe('no bad');
  });

  it('later writes go through past a refused row', async () => {
    useQueue.getState().enqueue([item('bad')]);
    answer = refuse('bad');
    await flush();
    useQueue.getState().enqueue([item('new')]);
    requests.length = 0;
    await flush();
    expect(requests).toEqual([['new']]);
    expect(left()).toEqual([['bad', 'no bad']]);
  });

  it('keeps everything waiting when there is no connection', async () => {
    useQueue.getState().enqueue([item('a'), item('b')]);
    answer = () => ({ error: { message: 'Failed to fetch' }, status: 0 });
    await flush();
    expect(left()).toEqual([
      ['a', null],
      ['b', null],
    ]);
    expect(useQueue.getState().lastError).toContain('Failed to fetch');
  });

  it('losing the connection while finding the bad row marks nothing wrongly', async () => {
    useQueue.getState().enqueue([item('a'), item('b')]);
    answer = (ids) =>
      ids.length > 1
        ? { error: { message: 'no' }, status: 400 }
        : { error: { message: 'Failed to fetch' }, status: 0 };
    await flush();
    expect(left()).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });

  it('a new write of a refused row gets a fresh chance', async () => {
    useQueue.getState().enqueue([item('bad')]);
    answer = refuse('bad');
    await flush();
    answer = () => ({ error: null, status: 201 });
    useQueue.getState().enqueue([item('bad')]);
    await flush();
    expect(left()).toEqual([]);
    expect(useQueue.getState().lastError).toBeNull();
  });

  it('retrySync tries refused rows again', async () => {
    useQueue.getState().enqueue([item('bad')]);
    answer = refuse('bad');
    await flush();
    answer = () => ({ error: null, status: 201 });
    await retrySync();
    expect(left()).toEqual([]);
  });

  it('discarding removes only the refused rows', async () => {
    useQueue.getState().enqueue([item('bad')]);
    answer = refuse('bad');
    await flush();
    useQueue.getState().enqueue([item('good')]);
    useQueue.getState().discardFailed();
    expect(left()).toEqual([['good', null]]);
  });
});

describe('syncRow', () => {
  it('stops waiting as soon as the row is refused', async () => {
    useQueue.getState().enqueue([item('bad')]);
    answer = refuse('bad');
    await expect(syncRow('set_entries', 'bad', 60000)).resolves.toBe(false);
  });
});

describe('sets of a workout the server cannot see', () => {
  const RLS = 'new row violates row-level security policy for table "set_entries"';
  const setOf = (id: string, session: string): Omit<QueueItem, 'key'> => ({
    table: 'set_entries',
    op: 'upsert',
    id,
    row: { id, session_id: session },
  });
  /** Refuses the sets until their workout has been sent. */
  const needsWorkout = (sets: string[], workout: string) => {
    let sent = false;
    return (ids: string[]) => {
      if (ids.includes(workout)) sent = true;
      return !sent && ids.some((i) => sets.includes(i))
        ? { error: { message: RLS }, status: 403 }
        : { error: null, status: 201 };
    };
  };

  it('drops them when the workout was deleted here', async () => {
    setSessionLookup(() => null);
    useQueue.getState().enqueue([setOf('s1', 'w1'), setOf('s2', 'w1'), item('c')]);
    answer = needsWorkout(['s1', 's2'], 'w1');
    await flush();
    expect(left()).toEqual([]);
    expect(useQueue.getState().lastError).toBeNull();
  });

  it('sends the workout again when it is still here, then the sets', async () => {
    setSessionLookup((id) => ({ id }));
    useQueue.getState().enqueue([setOf('s1', 'w1')]);
    answer = needsWorkout(['s1'], 'w1');
    await flush();
    expect(left()).toEqual([]);
    expect(requests).toEqual([['s1'], ['w1'], ['s1']]);
  });

  it('sets them aside as before while it is not known', async () => {
    useQueue.getState().enqueue([setOf('s1', 'w1')]);
    answer = needsWorkout(['s1'], 'w1');
    await flush();
    expect(left()).toEqual([['s1', RLS]]);
  });

  it('leaves other refusals alone', async () => {
    setSessionLookup(() => null);
    useQueue.getState().enqueue([setOf('bad', 'w1')]);
    answer = refuse('bad');
    await flush();
    expect(left()).toEqual([['bad', 'no bad']]);
  });

  it('deleting a workout drops its waiting sets', () => {
    useQueue.getState().enqueue([setOf('s1', 'w1'), setOf('s2', 'w2')]);
    useQueue.getState().dropForSession('w1');
    expect(left()).toEqual([['s2', null]]);
  });
});
