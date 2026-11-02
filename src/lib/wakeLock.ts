/**
 * Keeps the screen on while mounted, so the rest timer and its sound still work with the phone on
 * the bench. Browsers drop the lock whenever the page is hidden, so it is taken again on return.
 * Where a browser has no wake lock nothing happens. Native builds will need expo-keep-awake.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useScreenAwake(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const take = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (active) lock = next;
        else void next.release();
      } catch {
        // Refused (low battery, for example): the screen just dims as usual.
      }
    };
    void take();
    document.addEventListener('visibilitychange', take);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', take);
      void lock?.release().catch(() => {});
    };
  }, []);
}
