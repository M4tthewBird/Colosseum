import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** True while the web build is being pre-rendered in Node (no window, no storage). */
export const isServer = Platform.OS === 'web' && typeof window === 'undefined';

/** AsyncStorage that is a no-op during static rendering. Works on web (localStorage) and native. */
export const safeStorage = {
  getItem: (key: string): Promise<string | null> =>
    isServer ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string): Promise<void> =>
    isServer ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string): Promise<void> =>
    isServer ? Promise.resolve() : AsyncStorage.removeItem(key),
};
