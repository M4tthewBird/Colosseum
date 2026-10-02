import type { LucideIcon } from '@/components/icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/tokens';

type BaseProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
};

/** Pressable that dims while pressed. */
export function Tap({ style, children, disabled, ...rest }: BaseProps & { children?: ReactNode }) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [style, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

interface FillButtonProps extends BaseProps {
  label: string;
  /** Icon drawn in the accent color before the label. */
  icon?: LucideIcon;
  /** Filled icon (e.g. play). */
  iconFill?: boolean;
  size?: 'lg' | 'sm';
  loading?: boolean;
  labelStyle?: StyleProp<TextStyle>;
}

/** Grey-fill pill. Primary actions put a red icon before the label. Never black. */
export function FillButton({
  label,
  icon: Icon,
  iconFill,
  size = 'lg',
  loading,
  style,
  labelStyle,
  ...rest
}: FillButtonProps) {
  const lg = size === 'lg';
  return (
    <Tap
      accessibilityRole="button"
      style={[styles.fill, lg ? styles.lg : styles.sm, style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.text2} />
      ) : (
        <>
          {Icon ? (
            <Icon
              size={lg ? 16 : 14}
              color={colors.accent}
              fill={iconFill ? colors.accent : 'none'}
              strokeWidth={2.6}
            />
          ) : null}
          <Text style={[lg ? styles.lgText : styles.smText, labelStyle]}>{label}</Text>
        </>
      )}
    </Tap>
  );
}

/** Plain text action: "Change", "Edit", "Sign in". */
export function TextButton({
  label,
  accent,
  style,
  labelStyle,
  ...rest
}: BaseProps & { label: string; accent?: boolean; labelStyle?: StyleProp<TextStyle> }) {
  return (
    <Tap accessibilityRole="button" hitSlop={10} style={style} {...rest}>
      <Text
        style={[
          {
            fontSize: 15,
            color: accent ? colors.accent : colors.text2,
            fontWeight: accent ? '600' : '400',
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </Tap>
  );
}

/** 36 × 36 grey circle with an 18 px icon. Always pass accessibilityLabel. */
export function IconButton({
  icon: Icon,
  size = 36,
  iconSize = 18,
  color = colors.text,
  style,
  ...rest
}: BaseProps & {
  icon: LucideIcon;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  color?: string;
}) {
  return (
    <Tap
      accessibilityRole="button"
      hitSlop={(44 - size) / 2 > 0 ? (44 - size) / 2 : 0}
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }, style]}
      {...rest}
    >
      <Icon size={iconSize} color={color} strokeWidth={2.4} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.fill,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lg: { height: 50, paddingHorizontal: 20 },
  sm: { height: 36, paddingHorizontal: 14 },
  lgText: { fontSize: 17, fontWeight: '600', color: colors.text },
  smText: { fontSize: 15, fontWeight: '600', color: colors.text },
  icon: { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
});
