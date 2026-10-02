import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { dur, ease, useReducedMotion } from '@/theme/motion';

interface Box {
  x: number;
  width: number;
}

/**
 * A selection highlight that slides between items instead of jumping. Items report their
 * layout; until every item is measured the caller keeps drawing a static highlight, so the
 * selection is visible even before (or without) animation.
 */
export function useSlidingPill(count: number, selected: number) {
  const [boxes, setBoxes] = useState<(Box | undefined)[]>([]);
  const ready = boxes.length === count && boxes.every(Boolean);
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const visible = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const box = boxes[selected];
    if (!box) {
      visible.value = withTiming(0, { duration: dur.tap });
      return;
    }
    // First placement and Reduce Motion jump; later changes glide.
    const config = { duration: placed.current && !reduced ? dur.state + 60 : 0, easing: ease };
    x.value = withTiming(box.x, config);
    width.value = withTiming(box.width, config);
    visible.value = withTiming(1, { duration: placed.current ? dur.tap : 0 });
    placed.current = true;
  }, [ready, boxes, selected, reduced, x, width, visible]);

  const style = useAnimatedStyle(() => ({
    opacity: visible.value,
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  const onItemLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x: bx, width: bw } = e.nativeEvent.layout;
    setBoxes((prev) => {
      const old = prev[i];
      if (old && old.x === bx && old.width === bw && prev.length === count) return prev;
      const next = Array.from({ length: count }, (_, k) => prev[k]);
      next[i] = { x: bx, width: bw };
      return next;
    });
  };

  return { animated: ready, onItemLayout, style };
}

/** The moving highlight itself; position it inside the track. */
export function Pill({ style, pillStyle }: { style: StyleProp<ViewStyle>; pillStyle: object }) {
  return (
    <Animated.View aria-hidden style={[{ position: 'absolute', left: 0 }, style, pillStyle]} />
  );
}
