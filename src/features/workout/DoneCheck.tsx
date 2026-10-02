/**
 * The set check — the app's one authored moment. Marking a set done floods the circle red with
 * a short press-and-settle; a new PR makes the Colosseum laurel bloom around it and fade, the
 * victor's wreath for the lift. Reduce Motion keeps the color change and a still, fading wreath.
 */
import { Check } from '@/components/icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { LogoMark } from '@/components/Logo';
import { dur, ease, easeIn, useReducedMotion } from '@/theme/motion';
import { accentA, colors } from '@/theme/tokens';

const SIZE = 32;
const WREATH = 60;

/** 0 → 1 as a set becomes done; drives the check and the row tint together. */
export function useDoneProgress(done: boolean): SharedValue<number> {
  const progress = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(done ? 1 : 0, { duration: dur.state, easing: ease });
  }, [done, progress]);
  return progress;
}

export function useRowTint(progress: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(185,28,28,0)', accentA(0.07)]),
  }));
}

export function DoneCheck({
  done,
  pr,
  progress,
}: {
  done: boolean;
  pr: boolean;
  progress: SharedValue<number>;
}) {
  const reduced = useReducedMotion();
  const press = useSharedValue(1);
  const bloom = useSharedValue(0);
  const prev = useRef({ done, pr });

  useEffect(() => {
    const was = prev.current;
    prev.current = { done, pr };
    if (done && !was.done && !reduced) {
      press.value = withSequence(
        withTiming(0.82, { duration: dur.tap - 30, easing: easeIn }),
        withTiming(1, { duration: dur.state + 80, easing: ease }),
      );
    }
    if (pr && !was.pr) {
      bloom.value = 0;
      bloom.value = withSequence(
        withTiming(1, { duration: dur.layout, easing: ease }),
        withDelay(dur.focal - dur.layout, withTiming(0, { duration: dur.layout, easing: easeIn })),
      );
    }
  }, [done, pr, reduced, press, bloom]);

  const circle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.fill, colors.accent]),
    transform: [{ scale: press.value }],
  }));
  const on = useAnimatedStyle(() => ({ opacity: progress.value }));
  const off = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const wreath = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [
      { scale: reduced ? 1 : 0.6 + 0.4 * bloom.value },
      { rotate: reduced ? '0deg' : `${(1 - bloom.value) * -18}deg` },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View aria-hidden style={[styles.wreath, wreath]}>
        <LogoMark size={WREATH} />
      </Animated.View>
      <Animated.View style={[styles.circle, circle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, off]}>
          <Check size={15} color={colors.text3} strokeWidth={3} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, on]}>
          <Check size={15} color="#fff" strokeWidth={3} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  wreath: {
    position: 'absolute',
    width: WREATH,
    height: WREATH,
    left: (SIZE - WREATH) / 2,
    top: (SIZE - WREATH) / 2,
    pointerEvents: 'none',
  },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
