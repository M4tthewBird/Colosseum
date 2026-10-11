/** Profile → Lifts: how the last rated workouts felt (effort and average feel) over time. */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/Charts';
import { Glass } from '@/components/Glass';
import { feelTrend } from '@/lib/progression';
import type { Session } from '@/lib/types';
import { colors, tabular, type } from '@/theme/tokens';

/** `sessions` are finished, newest first. */
export function FeelTrend({ sessions }: { sessions: Session[] }) {
  const points = useMemo(() => feelTrend(sessions), [sessions]);
  const rpe = points.map((p) => p.rpe).filter((v): v is number => v != null);
  const feel = points.map((p) => p.feel).filter((v): v is number => v != null);
  const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

  return (
    <Glass radius={22} style={styles.card}>
      <Text style={type.captionStrong}>Training feel · last {points.length || 12} rated</Text>
      {rpe.length < 2 && feel.length < 2 ? (
        <Text style={type.caption}>
          Rate a workout when you finish it (effort, energy, sleep, pump, joints) to see how it
          trends here.
        </Text>
      ) : (
        <View style={styles.row}>
          <Series
            label="Effort (RPE)"
            values={rpe}
            value={avg(rpe.slice(-3))}
            digits={1}
            hint="1–10, avg of last 3"
          />
          <Series
            label="Feel"
            values={feel}
            value={avg(feel.slice(-3))}
            digits={1}
            hint="1–5, avg of last 3"
          />
        </View>
      )}
    </Glass>
  );
}

function Series({
  label,
  values,
  value,
  digits,
  hint,
}: {
  label: string;
  values: number[];
  value: number | null;
  digits: number;
  hint: string;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.value, tabular]}>{value != null ? value.toFixed(digits) : '—'}</Text>
      <Sparkline
        values={values}
        width={120}
        height={32}
        accessibilityLabel={`${label} trend: ${values.join(', ')}`}
      />
      <Text style={type.small}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 16 },
  value: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
});
