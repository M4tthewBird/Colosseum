/**
 * A badge: the Colosseum laurel around a disc with the badge's icon (or, for strength clubs,
 * the weight). Always red, and it grows with the tier (level 1–5):
 *   1 faint laurel, outlined disc · 2 stronger laurel · 3 full laurel, tinted disc ·
 *   4 solid red disc, white icon · 5 solid with an inner ring and three stars.
 * Not earned yet: grey. Pure SVG, so it scales to any size.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  Calendar,
  Clock,
  Compass,
  Crown,
  Disc,
  Dumbbell,
  Flame,
  Layers,
  Link,
  Moon,
  RotateCcw,
  Skull,
  Sunrise,
  Trophy,
  Users,
  Weight,
  Zap,
  type LucideIcon,
} from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import type { BadgeIcon } from '@/lib/badges';
import { accentA, colors } from '@/theme/tokens';

const ICONS: Partial<Record<BadgeIcon, LucideIcon>> = {
  dumbbell: Dumbbell,
  flame: Flame,
  weight: Weight,
  trophy: Trophy,
  plate: Disc,
  crown: Crown,
  sunrise: Sunrise,
  moon: Moon,
  calendar: Calendar,
  clock: Clock,
  bolt: Zap,
  compass: Compass,
  layers: Layers,
  skull: Skull,
  link: Link,
  rotate: RotateCcw,
  users: Users,
};

/** Strength clubs show the weight instead of an icon. */
const NUMBER: BadgeIcon[] = ['bench', 'squat', 'deadlift'];

const STAR =
  'M0,-1 L0.29,-0.4 L0.95,-0.31 L0.48,0.15 L0.59,0.81 L0,0.5 L-0.59,0.81 L-0.48,0.15 L-0.95,-0.31 L-0.29,-0.4 Z';

export function Medallion({
  icon,
  level,
  earned,
  size = 64,
  value,
}: {
  icon: BadgeIcon;
  /** 1–5: how far up its ladder the shown tier is. */
  level: number;
  earned: boolean;
  size?: number;
  /** Shown in the middle of strength clubs, e.g. 100. */
  value?: number;
}) {
  const lv = earned ? Math.max(1, Math.min(5, level)) : 0;
  const disc = size * 0.5;
  const solid = lv >= 4;
  const fg = !earned ? colors.text3 : solid ? colors.white : colors.accent;
  const Icon = ICONS[icon];
  const wreath = !earned ? 0.3 : lv === 1 ? 0.4 : lv === 2 ? 0.7 : 1;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', opacity: wreath }}>
        <LogoMark size={size} bell={false} color={earned ? colors.accent : colors.text3} />
      </View>
      <Svg width={disc} height={disc} viewBox="-50 -50 100 100" style={{ position: 'absolute' }}>
        <Circle
          r={47}
          fill={
            !earned ? colors.fill : solid ? colors.accent : lv === 3 ? accentA(0.14) : colors.white
          }
          stroke={earned ? colors.accent : colors.separator}
          strokeWidth={lv >= 2 ? 5 : 3}
        />
        {lv === 5 ? <Circle r={38} fill="none" stroke={colors.white} strokeWidth={2.5} /> : null}
      </Svg>
      {/* Its own positioned layer: in-flow content would paint under the positioned disc. */}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {NUMBER.includes(icon) && value != null ? (
          <Text
            style={{
              color: fg,
              fontSize: disc * (value >= 100 ? 0.34 : 0.4),
              fontWeight: '800',
              letterSpacing: -0.5,
            }}
          >
            {value}
          </Text>
        ) : Icon ? (
          <Icon size={disc * 0.46} color={fg} strokeWidth={2.2} />
        ) : null}
      </View>
      {lv === 5 ? (
        <Svg
          width={size * 0.42}
          height={size * 0.14}
          viewBox="-3.2 -1.1 6.4 2.2"
          style={{ position: 'absolute', top: size * 0.02 }}
        >
          {[-2.1, 0, 2.1].map((x) => (
            <Path
              key={x}
              d={STAR}
              fill={colors.accent}
              transform={`translate(${x} ${x === 0 ? -0.1 : 0.1})`}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
