/**
 * The game layer's own data on the device: gym visits (scans work offline and sync through the
 * queue) and which game days were sent. Cleared when the signed-in user changes.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GymVisit } from '@/lib/game/visits';
import { scheduleFlush } from '@/lib/sync';
import { safeStorage } from '@/lib/storage';
import { nowIso } from '@/lib/uuid';
import { useData } from './data';
import { useQueue } from './queue';

interface GameStore {
  userId: string;
  visits: Record<string, GymVisit>;
  /** Day or season → what was sent last, so only changes go to the queue. */
  synced: Record<string, string>;
  saveVisit: (v: GymVisit) => void;
  /** Server rows (with the server's checks). Visits with writes still waiting keep theirs. */
  mergeVisits: (rows: GymVisit[]) => void;
  setSynced: (patch: Record<string, string>) => void;
  reset: (userId?: string) => void;
}

/** The server sets these; the device never sends them. */
function visitRow(v: GymVisit): Record<string, unknown> {
  const { in_ok: _a, out_ok: _b, ...row } = v;
  return row;
}

export const useGame = create<GameStore>()(
  persist(
    (set) => ({
      userId: '',
      visits: {},
      synced: {},
      saveVisit: (v) => {
        const next = { ...v, updated_at: nowIso() };
        set((s) => ({ visits: { ...s.visits, [v.id]: next } }));
        useQueue
          .getState()
          .enqueue([{ table: 'gym_visits', op: 'upsert', id: v.id, row: visitRow(next) }]);
        scheduleFlush(200);
      },
      mergeVisits: (rows) => {
        const pending = new Set(
          useQueue
            .getState()
            .items.filter((i) => i.table === 'gym_visits')
            .map((i) => i.id),
        );
        set((s) => {
          const visits = { ...s.visits };
          for (const r of rows) if (!pending.has(r.id)) visits[r.id] = r;
          return { visits };
        });
      },
      setSynced: (patch) => set((s) => ({ synced: { ...s.synced, ...patch } })),
      reset: (userId = '') => set({ userId, visits: {}, synced: {} }),
    }),
    { name: 'colosseum-game', storage: createJSONStorage(() => safeStorage) },
  ),
);

// Another account (or none) on this device: start clean.
useData.subscribe((s) => {
  const g = useGame.getState();
  if (s.userId !== g.userId && useData.getState().hydrated) g.reset(s.userId);
});
