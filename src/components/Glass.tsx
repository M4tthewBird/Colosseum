import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, glassStyle, shadows } from '@/theme/tokens';

interface GlassProps extends ViewProps {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * White frosted glass surface. Web uses CSS backdrop-filter; iOS/Android use expo-blur with a
 * white overlay and a hairline border on top.
 */
export function Glass({ radius = 22, style, children, ...rest }: GlassProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[glassStyle, { borderRadius: radius }, style]} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <View style={[{ borderRadius: radius, boxShadow: shadows.glass }, style]} {...rest}>
      <BlurView
        intensity={60}
        tint="light"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { pointerEvents: 'none' },
          {
            borderRadius: radius,
            backgroundColor: colors.glassBg,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
          },
        ]}
      />
      {children}
    </View>
  );
}

/** Card: glass, radius 22–26, padding 14–18. */
export function GlassCard({ radius = 24, style, ...rest }: GlassProps) {
  return <Glass radius={radius} style={[{ padding: 18 }, style]} {...rest} />;
}
