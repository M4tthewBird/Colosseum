/** Device-only preferences, e.g. what the Arena leaderboard shows. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from '@/lib/storage';

/** 'volume' | 'workouts' | `name:<exercise name>` (built-in) | <exercise uuid> */
export type ArenaMetric = string;
export type ArenaPeriod = 'week' | 'month' | 'all';

export const DEFAULT_METRICS: ArenaMetric[] = [
  'volume',
  'name:Bench Press',
  'name:Squat',
  'name:Deadlift',
];

interface PrefsState {
  arenaMetrics: ArenaMetric[];
  arenaMetric: ArenaMetric;
  arenaPeriod: ArenaPeriod;
  /** Rank lifts by bodyweight-adjusted DOTS score instead of kg. */
  arenaDots: boolean;
  /** Show the "Add to Home Screen" tip once, after sign-up. */
  installTipPending: boolean;
  setInstallTipPending: (v: boolean) => void;
  setArenaDots: (v: boolean) => void;
  setArenaMetrics: (m: ArenaMetric[]) => void;
  setArenaMetric: (m: ArenaMetric) => void;
  setArenaPeriod: (p: ArenaPeriod) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      arenaMetrics: DEFAULT_METRICS,
      arenaMetric: 'volume',
      arenaPeriod: 'week',
      arenaDots: false,
      installTipPending: false,
      setInstallTipPending: (installTipPending) => set({ installTipPending }),
      setArenaDots: (arenaDots) => set({ arenaDots }),
      setArenaMetrics: (arenaMetrics) => set({ arenaMetrics }),
      setArenaMetric: (arenaMetric) => set({ arenaMetric }),
      setArenaPeriod: (arenaPeriod) => set({ arenaPeriod }),
    }),
    { name: 'colosseum-prefs', storage: createJSONStorage(() => safeStorage) },
  ),
);
