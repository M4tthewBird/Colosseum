/**
 * Flushes the offline queue to Supabase: in order, batched per table and operation, with
 * upserts on the primary key so sending twice is safe. A connection or server problem retries
 * with backoff. A row the server refuses is set aside so the rest still gets through, and is tried
 * again later. Data is never dropped without the user deciding to.
 */
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { PK, useQueue, type QueueItem, type SyncTable } from '@/stores/queue';
import { isServer } from './storage';
import { isDemo, supabase } from './supabase';

let flushing = false;
/** "table.column" pairs the live database does not have yet (see supabase/updates). */
const missingColumns = new Set<string>();

function withoutMissing(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (missingColumns.size === 0) return row;
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !missingColumns.has(`${table}.${k}`)),
  );
}
/**
 * The local workout a set or rating belongs to, as a row to send: null when it is gone (deleted
 * on this device), undefined when that is not known yet. Registered by the data store, which
 * imports this file.
 */
type SessionLookup = (sessionId: string) => Record<string, unknown> | null | undefined;
let sessionRowFor: SessionLookup = () => undefined;
export function setSessionLookup(fn: SessionLookup): void {
  sessionRowFor = fn;
}

/** Rows that need their workout to be on the server first (RLS checks its owner). */
const CHILD_OF_SESSION: SyncTable[] = ['set_entries', 'session_ratings'];

/**
 * A set or rating the server refused because it cannot see its workout. Deleted here: the write
 * is dropped, the workout took its sets with it. Still here: the workout goes up again, then the
 * row. True when the item is settled (gone from the queue).
 */
async function settleOrphan(item: QueueItem, message: string): Promise<boolean> {
  if (item.op !== 'upsert' || !CHILD_OF_SESSION.includes(item.table)) return false;
  if (!/row-level security/i.test(message)) return false;
  const sessionId = item.row?.session_id;
  if (typeof sessionId !== 'string') return false;
  const session = sessionRowFor(sessionId);
  if (session === undefined) return false;
  if (session === null) {
    console.warn('[sync] dropped a write for a deleted workout', item.key);
    useQueue.getState().remove([item.key]);
    return true;
  }
  const up = await supabase
    .from('workout_sessions')
    .upsert([withoutMissing('workout_sessions', session)], { onConflict: PK.workout_sessions });
  if (up.error) return false;
  const again = await send(item.table, item.op, [item]);
  if (again.error) return false;
  useQueue.getState().remove([item.key]);
  return true;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 2000;
let online = true;

export function scheduleFlush(delayMs = 800): void {
  if (isDemo || isServer) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delayMs);
}

/**
 * The server looked at the row and said no (a broken rule, not allowed). Waiting will not change
 * that. No answer, an expired sign-in, too many requests or a server error can all pass.
 */
export function isRefused(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

/** Groups consecutive items with the same table and operation. */
function batches(items: QueueItem[]): QueueItem[][] {
  const out: QueueItem[][] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last[0].table === it.table && last[0].op === it.op && last.length < 200)
      last.push(it);
    else out.push([it]);
  }
  return out;
}

async function send(table: SyncTable, op: QueueItem['op'], batch: QueueItem[]) {
  return op === 'upsert'
    ? await supabase.from(table).upsert(
        batch.map((b) => withoutMissing(table, b.row ?? {})),
        { onConflict: PK[table] },
      )
    : await supabase
        .from(table)
        .delete()
        .in(
          PK[table],
          batch.map((b) => b.id),
        );
}

export async function flush(): Promise<void> {
  if (isDemo || isServer || flushing || !online) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  flushing = true;
  try {
    // Items can be added while we flush; loop until the queue is empty.
    for (;;) {
      const items = useQueue.getState().items.filter((i) => !i.failed);
      if (items.length === 0) break;
      let batch = batches(items)[0];
      const { table, op } = batch[0];
      // Only one program can be active. A queued "make it active" can sit before the
      // "make the old one inactive" (the queue replaces items in place), so programs that
      // become inactive always go first.
      if (table === 'programs' && op === 'upsert' && batch.some((b) => b.row?.is_active)) {
        const inactive = items.filter(
          (x) => x.table === 'programs' && x.op === 'upsert' && !x.row?.is_active,
        );
        if (inactive.length > 0) batch = inactive;
      }
      const res = await send(table, op, batch);
      const missing = res.error?.message.match(/Could not find the '(\w+)' column/)?.[1];
      if (op === 'upsert' && missing) {
        // The live database is behind the app (an update SQL has not run yet).
        console.warn(`[sync] ${table}.${missing} is missing in the database; syncing without it`);
        missingColumns.add(`${table}.${missing}`);
        continue;
      }
      if (res.error && !isRefused(res.status))
        throw new Error(`${table} ${op}: ${res.error.message}`);
      if (res.error && batch.length === 1) {
        if (await settleOrphan(batch[0], res.error.message)) continue;
        console.warn('[sync] refused, set aside', batch[0].key, res.error.message);
        useQueue.getState().markFailed([batch[0].key], res.error.message);
        continue;
      }
      if (res.error) {
        // One bad row fails its whole batch: send them one by one to find it.
        for (const item of batch) {
          const one = await send(table, op, [item]);
          if (one.error && !isRefused(one.status))
            throw new Error(`${table} ${op}: ${one.error.message}`);
          if (one.error) {
            if (!(await settleOrphan(item, one.error.message)))
              useQueue.getState().markFailed([item.key], one.error.message);
          } else useQueue.getState().remove([item.key]);
        }
        continue;
      }
      useQueue.getState().remove(batch.map((b) => b.key));
    }
    const refused = useQueue.getState().items.find((i) => i.failed);
    useQueue.getState().setError(refused?.failed ?? null);
    backoffMs = 2000;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[sync] flush failed, will retry', msg);
    useQueue.getState().setError(msg);
    backoffMs = Math.min(backoffMs * 2, 5 * 60 * 1000);
    flushing = false;
    scheduleFlush(backoffMs);
    return;
  }
  flushing = false;
}

/**
 * Pushes the queue and waits (up to timeoutMs) until nothing for this row is waiting any more.
 * True once it is on the server. For writes that need the row to exist there first.
 */
export async function syncRow(table: string, id: string, timeoutMs = 6000): Promise<boolean> {
  const waiting = () => useQueue.getState().items.find((i) => i.table === table && i.id === id);
  const inLine = () => {
    const item = waiting();
    return !!item && !item.failed;
  };
  const end = Date.now() + timeoutMs;
  while (inLine() && Date.now() < end) {
    // Returns at once while another flush runs; then just wait for that one.
    await flush();
    if (inLine()) await new Promise((r) => setTimeout(r, 300));
  }
  return !waiting();
}

/** Sends everything again, also what the server refused before. */
export function retrySync(): Promise<void> {
  useQueue.getState().retryFailed();
  return flush();
}

/** Starts the online/offline listeners. Call once from the root layout. */
export function startSync(): () => void {
  if (isDemo || isServer) return () => {};
  const unsubNet = NetInfo.addEventListener((state) => {
    const was = online;
    online = state.isConnected !== false;
    if (online && !was) scheduleFlush(200);
  });
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') scheduleFlush(200);
  });
  // A refusal may be gone by the next time the app opens (an update reached the database).
  const unsubHydrated = useQueue.persist.onFinishHydration(() => useQueue.getState().retryFailed());
  if (useQueue.persist.hasHydrated()) useQueue.getState().retryFailed();
  scheduleFlush(500);
  return () => {
    unsubHydrated();
    unsubNet();
    sub.remove();
  };
}
