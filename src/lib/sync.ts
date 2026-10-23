/**
 * Flushes the offline queue to Supabase: in order, batched per table and operation, with
 * upserts on the primary key so sending twice is safe. On failure it retries with backoff and
 * never drops data.
 */
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { PK, useQueue, type QueueItem } from '@/stores/queue';
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

export async function flush(): Promise<void> {
  if (isDemo || isServer || flushing || !online) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  flushing = true;
  try {
    // Items can be added while we flush; loop until the queue is empty.
    for (;;) {
      const items = useQueue.getState().items;
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
      const rows = batch.map((b) => withoutMissing(table, b.row ?? {}));
      const res =
        op === 'upsert'
          ? await supabase.from(table).upsert(rows, { onConflict: PK[table] })
          : await supabase
              .from(table)
              .delete()
              .in(
                PK[table],
                batch.map((b) => b.id),
              );
      const missing = res.error?.message.match(/Could not find the '(\w+)' column/)?.[1];
      if (op === 'upsert' && missing) {
        // The live database is behind the app (an update SQL has not run yet).
        console.warn(`[sync] ${table}.${missing} is missing in the database; syncing without it`);
        missingColumns.add(`${table}.${missing}`);
        continue;
      }
      if (res.error) throw new Error(`${table} ${op}: ${res.error.message}`);
      useQueue.getState().remove(batch.map((b) => b.key));
    }
    useQueue.getState().setError(null);
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
  const pending = () => useQueue.getState().items.some((i) => i.table === table && i.id === id);
  const end = Date.now() + timeoutMs;
  while (pending() && Date.now() < end) {
    // Returns at once while another flush runs; then just wait for that one.
    await flush();
    if (pending()) await new Promise((r) => setTimeout(r, 300));
  }
  return !pending();
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
  scheduleFlush(500);
  return () => {
    unsubNet();
    sub.remove();
  };
}
