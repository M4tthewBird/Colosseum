import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, easeIn } from '@/theme/motion';
import { accentA, colors } from '@/theme/tokens';

/** One exercise in the workout progress strip; turns red as you reach it. */
export function ProgressSegment({ on, style }: { on: boolean; style: object }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: dur.layout, easing: ease });
  }, [on, p]);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.fill, colors.accent]),
  }));
  return <Animated.View style={[style, animated]} />;
}

/** Two soft red flashes over the floating bar when the rest timer runs out. */
export function useRestPulse() {
  const glow = useSharedValue(0);
  const pulse = useCallback(() => {
    const up = { duration: dur.state, easing: ease };
    const down = { duration: dur.layout, easing: easeIn };
    glow.set(
      withSequence(withTiming(1, up), withTiming(0, down), withTiming(1, up), withTiming(0, down)),
    );
  }, [glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return { pulse, style };
}

export function RestPulseOverlay({ style, radius }: { style: object; radius: number }) {
  return (
    <Animated.View
      aria-hidden
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, backgroundColor: accentA(0.14), pointerEvents: 'none' },
        style,
      ]}
    />
  );
}
