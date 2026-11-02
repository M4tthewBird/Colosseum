/** Device-only preferences, e.g. what the Arena leaderboard shows. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Equipment } from '@/data/equipmentExercises';
import type { BarKg } from '@/lib/plates';
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
  'together',
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
  /** Newest changelog entry this device has shown, with its item count (see seenMark). */
  changelogSeen: string | null;
  setChangelogSeen: (mark: string | null) => void;
  /** Asked once for a home gym (an account without one); "Not now" keeps it from asking again. */
  homeGymAsked: boolean;
  setHomeGymAsked: (v: boolean) => void;
  /** When an account without a profile picture was last asked for one (asked again after a week). */
  avatarAskedAt: string | null;
  setAvatarAskedAt: (iso: string | null) => void;
  /** Username from a friend link opened while signed out; opened after signing in. */
  pendingFriend: string | null;
  setPendingFriend: (username: string | null) => void;
  /** Features whose "New" mark the user has already tapped through. */
  newSeen: string[];
  markNewSeen: (feature: string) => void;
  /** What the workout generator may use. */
  generatorEquipment: Equipment;
  setGeneratorEquipment: (e: Equipment) => void;
  /** How many workouts until a beginner is asked about moving up (see lib/levelUp). */
  levelUpAskAt: number;
  setLevelUpAskAt: (n: number) => void;
  /** The bar the plate calculator loads (kg). */
  barKg: BarKg;
  setBarKg: (kg: BarKg) => void;
  /** Workout from a QR code opened while signed out; opened after signing in. */
  pendingTogether: string | null;
  setPendingTogether: (sessionId: string | null) => void;
  /** Badge tiers already sent to the server, "<userId>:<badgeId>" → threshold. */
  badgesSynced: Record<string, number>;
  setBadgesSynced: (v: Record<string, number>) => void;
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
      pendingFriend: null,
      setPendingFriend: (pendingFriend) => set({ pendingFriend }),
      newSeen: [],
      markNewSeen: (feature) =>
        set((s) => (s.newSeen.includes(feature) ? s : { newSeen: [...s.newSeen, feature] })),
      generatorEquipment: 'gym',
      setGeneratorEquipment: (generatorEquipment) => set({ generatorEquipment }),
      levelUpAskAt: 10,
      setLevelUpAskAt: (levelUpAskAt) => set({ levelUpAskAt }),
      barKg: 20,
      setBarKg: (barKg) => set({ barKg }),
      pendingTogether: null,
      setPendingTogether: (pendingTogether) => set({ pendingTogether }),
      badgesSynced: {},
      setBadgesSynced: (badgesSynced) => set({ badgesSynced }),
      setInstallTipPending: (installTipPending) => set({ installTipPending }),
      setArenaDots: (arenaDots) => set({ arenaDots }),
      setArenaMetrics: (arenaMetrics) => set({ arenaMetrics }),
      setArenaMetric: (arenaMetric) => set({ arenaMetric }),
      setArenaPeriod: (arenaPeriod) => set({ arenaPeriod }),
    }),
    {
      name: 'colosseum-prefs',
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      // Version 1: everyone gets the Together board once; they can still remove it.
      migrate: (saved, version) => {
        const s = saved as PrefsState;
        if (version < 1 && s.arenaMetrics && !s.arenaMetrics.includes('together'))
          return { ...s, arenaMetrics: [...s.arenaMetrics, 'together'] };
        return s;
      },
    },
  ),
);
