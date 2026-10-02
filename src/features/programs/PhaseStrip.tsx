import { StyleSheet, Text, View } from 'react-native';

import type { Phase } from '@/lib/periodization';
import { accentA, colors } from '@/theme/tokens';

/**
 * One segment per program week, grouped by phase. The bar height follows the phase's set
 * multiplier, so Intro, Build, Push and Deload read as a shape. `week` marks the current week.
 */
export function PhaseStrip({ phases, week }: { phases: Phase[]; week?: number }) {
  if (!phases.length) return null;
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={phases.map((p) => `${p.name} weeks ${p.from} to ${p.to}`).join(', ')}
    >
      {phases.map((p) => (
        <View key={p.name + p.from} style={[styles.phase, { flex: p.to - p.from + 1 }]}>
          <View style={styles.bars}>
            {Array.from({ length: p.to - p.from + 1 }, (_, i) => {
              const w = p.from + i;
              const current = w === week;
              const past = week != null && w < week;
              return (
                <View
                  key={w}
                  style={[
                    styles.bar,
                    { height: 8 + 14 * Math.min(1, p.sets / 1.25) },
                    {
                      backgroundColor: current
                        ? colors.accent
                        : past
                          ? accentA(0.35)
                          : colors.fillStrong,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text
            style={[styles.label, week != null && week >= p.from && week <= p.to && styles.on]}
            numberOfLines={1}
          >
            {p.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6 },
  phase: { gap: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  bar: { flex: 1, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '500', color: colors.text2 },
  on: { color: colors.accent, fontWeight: '700' },
});
