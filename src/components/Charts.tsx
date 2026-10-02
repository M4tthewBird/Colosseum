import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Polyline, RadialGradient, Stop } from 'react-native-svg';

import { useTween } from '@/lib/useTween';
import { colors } from '@/theme/tokens';

/** 80 px ring, stroke 7, accent progress with a round cap from 12 o'clock. Fills in on mount. */
export function ProgressRing({
  value,
  size = 80,
  stroke = 7,
  children,
}: {
  /** 0…1 */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2 - 0.5;
  const c = 2 * Math.PI * r;
  const v = useTween(Math.max(0, Math.min(1, value)));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(118,118,128,0.14)"
          strokeWidth={stroke}
        />
        {v > 0.001 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

/** Accent line; the last point is a white dot with an accent stroke. */
export function Sparkline({
  values,
  width = 120,
  height = 40,
  strokeWidth = 2.5,
  dot = true,
  accessibilityLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  dot?: boolean;
  accessibilityLabel?: string;
}) {
  if (values.length < 2) {
    return <View style={{ width, height }} accessibilityLabel={accessibilityLabel} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = dot ? 4 : strokeWidth;
  const pts = values.map((v, i) => {
    const x = (i * width) / (values.length - 1);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <Svg
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={colors.accent}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dot ? (
        <Circle
          cx={last[0]}
          cy={last[1]}
          r={4}
          fill="#fff"
          stroke={colors.accent}
          strokeWidth={2.5}
        />
      ) : null}
    </Svg>
  );
}

/** Thin progress bar (6 px). Fills in on mount and glides on change. */
export function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  const v = useTween(Math.max(0, Math.min(1, value)));
  return (
    <View
      style={{ height, borderRadius: height / 2, backgroundColor: colors.fill, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${v * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

/**
 * Soft accent glow behind the top of a screen (one per screen). A radial gradient stands in for
 * the design's 420×300 ellipse with an 80 px blur and renders the same on every platform.
 */
export function ScreenGlow({
  side = 'right',
  top = -140,
  opacity = 0.14,
}: {
  side?: 'left' | 'right' | 'center';
  top?: number;
  opacity?: number;
}) {
  const { width: screenW } = useWindowDimensions();
  const w = 620;
  const h = 500;
  const pageW = Math.min(screenW, 520);
  const offset = (screenW - pageW) / 2;
  // Center of the design ellipse, relative to a 390 px wide screen.
  const cx = side === 'right' ? pageW + 160 - 210 : side === 'left' ? -180 + 210 : pageW / 2;
  const cy = top + 150;
  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        left: offset + cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={colors.accent} stopOpacity={opacity * 0.75} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
