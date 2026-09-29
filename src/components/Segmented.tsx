import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, shadows } from '@/theme/tokens';

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Grey track with a white selected pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  height = 36,
  compact,
  style,
  accessibilityLabel,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  height?: number;
  /** Size to content (e.g. inside a form row) instead of equal columns. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[
              styles.seg,
              compact ? { paddingHorizontal: 14 } : { flex: 1 },
              { borderRadius: (height - 4) / 2 },
              on && styles.on,
            ]}
          >
            <Text style={[styles.label, { fontWeight: on ? '600' : '500' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chip: grey pill; selected is white with a soft shadow. Multi-select shows a red check. */
export function Chip({
  label,
  selected,
  onPress,
  onLongPress,
  check,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  check?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.on : { backgroundColor: colors.fill },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {check && selected ? <Check size={12} color={colors.accent} strokeWidth={3.2} /> : null}
      <Text style={[styles.label, { fontWeight: selected ? '600' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.fill,
    padding: 2,
    flexDirection: 'row',
    gap: 2,
  },
  seg: { alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.white, boxShadow: shadows.selected },
  label: { fontSize: 14, color: colors.text },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
