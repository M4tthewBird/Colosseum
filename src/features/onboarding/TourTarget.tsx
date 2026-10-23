/**
 * Marks a part of a screen the app tour can point at. The tour measures it in window coordinates
 * and lights it up; a hidden screen (another tab) measures as zero size and is skipped.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const targets = new Map<string, React.RefObject<View | null>>();

export function TourTarget({
  id,
  style,
  children,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  useEffect(() => {
    targets.set(id, ref);
    return () => {
      if (targets.get(id) === ref) targets.delete(id);
    };
  }, [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export function measureTarget(id: string, onRect: (r: TargetRect | null) => void) {
  const view = targets.get(id)?.current;
  if (!view) return onRect(null);
  view.measureInWindow((x, y, width, height) =>
    onRect(width > 0 && height > 0 ? { x, y, width, height } : null),
  );
}
