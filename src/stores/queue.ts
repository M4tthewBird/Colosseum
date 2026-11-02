/**
 * Offline write queue. Every mutation of the user's own data lands here first and is flushed
 * to Supabase in order (see src/lib/sync.ts). Items are keyed by table + id, so a newer write
 * of the same row replaces the waiting one in place and keeps the original order. An item the
 * server refused is kept but set aside (`failed`), so it cannot hold up the rest.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isDemo } from '@/lib/supabase';
import { safeStorage } from '@/lib/storage';

export type SyncTable =
  | 'profiles'
  | 'profile_private'
  | 'programs'
  | 'program_days'
  | 'program_exercises'
  | 'workout_sessions'
  | 'set_entries'
  | 'bodyweight_logs'
  | 'body_measurements'
  | 'exercises'
  | 'exercise_prefs'
  | 'session_ratings'
  | 'user_badges';

/** Primary-key column per table (all single-column). */
export const PK: Record<SyncTable, string> = {
  profiles: 'id',
  profile_private: 'user_id',
  programs: 'id',
  program_days: 'id',
  program_exercises: 'id',
  workout_sessions: 'id',
  set_entries: 'id',
  bodyweight_logs: 'id',
  body_measurements: 'id',
  exercises: 'id',
  exercise_prefs: 'id',
  session_ratings: 'session_id',
  user_badges: 'id',
};

export interface QueueItem {
  key: string;
  table: SyncTable;
  op: 'upsert' | 'delete';
  id: string;
  row?: Record<string, unknown>;
  /** Why the server refused it. Tried again when the app opens, or from Settings. */
  failed?: string;
}

interface QueueState {
  items: QueueItem[];
  lastError: string | null;
  enqueue: (items: Omit<QueueItem, 'key'>[]) => void;
  remove: (keys: string[]) => void;
  markFailed: (keys: string[], reason: string) => void;
  retryFailed: () => void;
  discardFailed: () => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

export const useQueue = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      lastError: null,
      enqueue: (incoming) => {
        if (isDemo) return;
        set((s) => {
          const items = [...s.items];
          for (const it of incoming) {
            const key = `${it.table}:${it.id}`;
            const item = { ...it, key };
            const i = items.findIndex((x) => x.key === key);
            if (i >= 0) items[i] = item;
            else items.push(item);
          }
          return { items };
        });
      },
      remove: (keys) => set((s) => ({ items: s.items.filter((x) => !keys.includes(x.key)) })),
      markFailed: (keys, failed) =>
        set((s) => ({
          items: s.items.map((x) => (keys.includes(x.key) ? { ...x, failed } : x)),
        })),
      retryFailed: () =>
        set((s) =>
          s.items.some((x) => x.failed)
            ? { items: s.items.map(({ failed: _failed, ...x }) => x) }
            : s,
        ),
      discardFailed: () =>
        set((s) => ({ items: s.items.filter((x) => !x.failed), lastError: null })),
      setError: (lastError) => set({ lastError }),
      clear: () => set({ items: [], lastError: null }),
    }),
    { name: 'colosseum-queue', storage: createJSONStorage(() => safeStorage) },
  ),
);

/** Ids with writes that have not reached the server yet. */
export function usePendingIds(): Set<string> {
  const items = useQueue((s) => s.items);
  return new Set(items.map((i) => i.id));
}
