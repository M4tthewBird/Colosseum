/**
 * Whether this account plays the game (docs/GAME.md) or only tracks workouts. Asked at sign-up,
 * asked existing players once in What's new, changed any time in Settings. Off hides the City tab
 * and the game's cards; the game itself keeps counting (XP, laurels, denarii come from the
 * workouts on the server), so turning it on later loses nothing.
 *
 * The choice belongs to the account: kept on the device per user, and in the account's metadata
 * in Supabase Auth (no table needed), so another device picks it up at sign-in. A choice made
 * offline is saved there at the next sign-in.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeStorage } from '@/lib/storage';
import { isDemo, supabase } from '@/lib/supabase';
import { useData } from '@/stores/data';

export type GameChoice = 'on' | 'off';

interface GameModeState {
  byUser: Record<string, GameChoice>;
  /** Choices not saved to the account yet (made offline). */
  unsaved: Record<string, true>;
}

export const useGameMode = create<GameModeState>()(
  persist(() => ({ byUser: {}, unsaved: {} }), {
    name: 'colosseum-game-mode',
    storage: createJSONStorage(() => safeStorage),
  }),
);

const isChoice = (v: unknown): v is GameChoice => v === 'on' || v === 'off';

async function saveToAccount(userId: string, choice: GameChoice): Promise<void> {
  if (isDemo) return;
  const { error } = await supabase.auth.updateUser({ data: { game: choice } });
  if (error) return;
  useGameMode.setState((s) => {
    const unsaved = { ...s.unsaved };
    delete unsaved[userId];
    return { unsaved };
  });
}

export function setGameChoice(userId: string, choice: GameChoice): void {
  useGameMode.setState((s) => ({
    byUser: { ...s.byUser, [userId]: choice },
    unsaved: isDemo ? s.unsaved : { ...s.unsaved, [userId]: true },
  }));
  void saveToAccount(userId, choice).catch(() => {});
}

/** At sign-in: the account's choice, unless this device made one it could not save yet. */
export function syncGameChoice(userId: string, metadata: Record<string, unknown> | undefined) {
  const s = useGameMode.getState();
  const local = s.byUser[userId];
  if (local && s.unsaved[userId]) {
    void saveToAccount(userId, local).catch(() => {});
    return;
  }
  const remote = metadata?.game;
  if (isChoice(remote) && remote !== local)
    useGameMode.setState((st) => ({ byUser: { ...st.byUser, [userId]: remote } }));
}

/** The signed-in account's choice, or null when it was never asked. */
export function useGameChoice(): GameChoice | null {
  const userId = useData((s) => s.userId ?? s.profile?.id ?? null);
  return useGameMode((s) => (userId ? (s.byUser[userId] ?? null) : null));
}

/**
 * Show the game? Yes unless the player turned it off: players from before the choice existed
 * had the game, and keep it until they answer.
 */
export function useGameOn(): boolean {
  return useGameChoice() !== 'off';
}

/** For the current account (Settings, What's new). */
export function chooseGame(choice: GameChoice): void {
  const { userId, profile } = useData.getState();
  const id = userId ?? profile?.id;
  if (id) setGameChoice(id, choice);
}
