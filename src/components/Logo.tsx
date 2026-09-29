import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

import { colors, type } from '@/theme/tokens';
import { BELL, LEAVES, STEMS } from './logoData';

/** Laurel wreath + dumbbell (brand/logo-mark.svg). */
export function LogoMark({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {STEMS.map((d) => (
        <Path key={d} d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      ))}
      {LEAVES.map(([cx, cy, r]) => (
        <Ellipse
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          rx={5}
          ry={2.3}
          fill={color}
          transform={`rotate(${r} ${cx} ${cy})`}
        />
      ))}
      <G transform="translate(5 5) scale(0.9)">
        {BELL.map(([x, y, w, h, rx]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={rx} fill={color} />
        ))}
      </G>
    </Svg>
  );
}

/** Logo mark + COLOSSEUM in Cinzel. */
export function Wordmark({ withMark = true }: { withMark?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Colosseum">
      {withMark ? <LogoMark size={16} /> : null}
      <Text style={type.wordmark}>COLOSSEUM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
