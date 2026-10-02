/**
 * The active workout's UI state (plan, current exercise, rest timer). The session and its sets
 * live in the data store. Both are persisted, so killing the app mid-workout loses nothing.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from '@/lib/storage';

export interface PlannedExercise {
  exercise_id: string;
  position: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  /** Target effort this week (from the program phase). */
  rpe?: number;
}

interface WorkoutState {
  sessionId: string | null;
  plan: PlannedExercise[];
  current: number;
  restEndsAt: number | null;
  restSeconds: number;
  minimized: boolean;
  start: (sessionId: string, plan: PlannedExercise[]) => void;
  setPlan: (plan: PlannedExercise[]) => void;
  setCurrent: (i: number) => void;
  startRest: (seconds: number) => void;
  stopRest: () => void;
  setMinimized: (m: boolean) => void;
  end: () => void;
}

export const useWorkout = create<WorkoutState>()(
  persist(
    (set) => ({
      sessionId: null,
      plan: [],
      current: 0,
      restEndsAt: null,
      restSeconds: 120,
      minimized: false,
      start: (sessionId, plan) =>
        set({ sessionId, plan, current: 0, restEndsAt: null, minimized: false }),
      setPlan: (plan) => set({ plan }),
      setCurrent: (current) => set({ current }),
      startRest: (seconds) =>
        set({ restEndsAt: Date.now() + seconds * 1000, restSeconds: seconds }),
      stopRest: () => set({ restEndsAt: null }),
      setMinimized: (minimized) => set({ minimized }),
      end: () => set({ sessionId: null, plan: [], current: 0, restEndsAt: null, minimized: false }),
    }),
    { name: 'colosseum-workout', storage: createJSONStorage(() => safeStorage) },
  ),
);
