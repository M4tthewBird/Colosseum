import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

/** True while the web build is being pre-rendered in Node (no window, no storage). */
export const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Writes are coalesced: the persisted stores serialize everything on each change (every
 * keystroke in a set row), so only the latest value per key is written, at most every 400 ms.
 * Pending writes are flushed when the app is hidden or closed, so nothing is lost.
 */
const WRITE_DELAY = 400;
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushStorage(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const entries = [...pending.entries()];
  pending.clear();
  return Promise.all(entries.map(([k, v]) => AsyncStorage.setItem(k, v))).then(() => undefined);
}

if (!isServer) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void flushStorage());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushStorage();
    });
  } else {
    AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flushStorage();
    });
  }
}

/** AsyncStorage that is a no-op during static rendering. Works on web (localStorage) and native. */
export const safeStorage = {
  getItem: (key: string): Promise<string | null> => {
    if (isServer) return Promise.resolve(null);
    const queued = pending.get(key);
    return queued !== undefined ? Promise.resolve(queued) : AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (isServer) return Promise.resolve();
    pending.set(key, value);
    if (!timer) timer = setTimeout(() => void flushStorage(), WRITE_DELAY);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (isServer) return Promise.resolve();
    pending.delete(key);
    return AsyncStorage.removeItem(key);
  },
};
