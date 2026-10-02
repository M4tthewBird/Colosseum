/**
 * Motion language: fast, decelerating, no bounce. Routine state changes 220 ms, layout 380 ms,
 * the one authored moment (a new PR) 700 ms. With Reduce Motion on, spatial movement is dropped
 * and color/opacity changes stay so feedback remains legible.
 */
import { Easing } from 'react-native-reanimated';

export { useReducedMotion } from 'react-native-reanimated';

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.4, 0, 1, 1);

export const dur = {
  tap: 120,
  state: 220,
  layout: 380,
  focal: 700,
} as const;
