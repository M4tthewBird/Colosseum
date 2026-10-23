/** Device-only preferences, e.g. what the Arena leaderboard shows. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from '@/lib/storage';

/** 'volume' | 'workouts' | `name:<exercise name>` (built-in) | <exercise uuid> */
export type ArenaMetric = string;
export type ArenaPeriod = 'week' | 'month' | 'all';
/** Who the Ranks leaderboard compares you with. */
export type ArenaScope = 'friends' | 'gym' | 'global';

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
  arenaScope: ArenaScope;
  setArenaScope: (s: ArenaScope) => void;
  /** Rank lifts by bodyweight-adjusted DOTS score instead of kg. */
  arenaDots: boolean;
  /** Show the "Add to Home Screen" tip once, after sign-up (after the tour). */
  installTipPending: boolean;
  /** Walk through the app once after sign-up; Settings can start it again. */
  tourPending: boolean;
  setTourPending: (v: boolean) => void;
  /** Newest changelog entry this device has shown (null: none yet). */
  changelogSeen: string | null;
  setChangelogSeen: (id: string | null) => void;
  /** Asked once for a home gym (an account without one); "Not now" keeps it from asking again. */
  homeGymAsked: boolean;
  setHomeGymAsked: (v: boolean) => void;
  /** When an account without a profile picture was last asked for one (asked again after a week). */
  avatarAskedAt: string | null;
  setAvatarAskedAt: (iso: string | null) => void;
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
      arenaScope: 'friends',
      setArenaScope: (arenaScope) => set({ arenaScope }),
      arenaDots: false,
      installTipPending: false,
      tourPending: false,
      setTourPending: (tourPending) => set({ tourPending }),
      changelogSeen: null,
      setChangelogSeen: (changelogSeen) => set({ changelogSeen }),
      homeGymAsked: false,
      setHomeGymAsked: (homeGymAsked) => set({ homeGymAsked }),
      avatarAskedAt: null,
      setAvatarAskedAt: (avatarAskedAt) => set({ avatarAskedAt }),
      setInstallTipPending: (installTipPending) => set({ installTipPending }),
      setArenaDots: (arenaDots) => set({ arenaDots }),
      setArenaMetrics: (arenaMetrics) => set({ arenaMetrics }),
      setArenaMetric: (arenaMetric) => set({ arenaMetric }),
      setArenaPeriod: (arenaPeriod) => set({ arenaPeriod }),
    }),
    { name: 'colosseum-prefs', storage: createJSONStorage(() => safeStorage) },
  ),
);
