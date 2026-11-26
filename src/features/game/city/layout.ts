/**
 * Where the player's buildings stand. Kept on this device, per account, for now: the test of the
 * painted city (docs/GAME.md §9). A new player starts with START.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { layOut, type Placed } from '@/lib/game/cityGrid';
import { safeStorage } from '@/lib/storage';
import { useData } from '@/stores/data';
import { PIECE, sizeOf, START } from './places';

interface CityLayoutState {
  byUser: Record<string, Placed[]>;
}

export const useCityLayouts = create<CityLayoutState>()(
  persist(() => ({ byUser: {} }), {
    name: 'colosseum-city-layout',
    storage: createJSONStorage(() => safeStorage),
  }),
);

export const startingCity = (): Placed[] => layOut(START, sizeOf);

/** This account's city, and a way to change it. */
export function useCityLayout(): [Placed[], (next: Placed[]) => void] {
  const userId = useData((s) => s.userId ?? s.profile?.id ?? 'guest');
  const saved = useCityLayouts((s) => s.byUser[userId]);
  const city = saved?.every((p) => PIECE[p.id]) ? saved : startingCity();
  const set = (next: Placed[]) =>
    useCityLayouts.setState((s) => ({ byUser: { ...s.byUser, [userId]: next } }));
  return [city, set];
}
