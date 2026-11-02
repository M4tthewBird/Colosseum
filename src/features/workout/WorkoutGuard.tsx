/** Ends a workout left running: when the app opens or comes back, and once a minute while open. */
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { endStaleWorkout } from './actions';

const CHECK_MS = 60000;

export function WorkoutGuard() {
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const check = () => {
      // The workout screen has nothing left to show.
      if (endStaleWorkout() && path.current.includes('/workout/')) router.replace('/');
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return null;
}
