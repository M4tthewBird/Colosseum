/** Profile → Lifts: hard sets per muscle this week, against the recommended 10–20. */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/Charts';
import { Glass } from '@/components/Glass';
import { MUSCLE_GROUPS, WEEKLY_SETS, weeklyLevel, weeklySets } from '@/lib/muscleGroups';
import type { Exercise, Session } from '@/lib/types';
import { tabular, type } from '@/theme/tokens';

export function WeeklySets({
  sessions,
  exercises,
}: {
  sessions: Session[];
  exercises: Record<string, Exercise>;
}) {
  const sets = useMemo(() => weeklySets(sessions, exercises), [sessions, exercises]);
  return (
    <Glass radius={22} style={styles.card}>
      <View style={{ gap: 2 }}>
        <Text style={type.bodyStrong}>Sets per muscle this week</Text>
        <Text style={type.small}>
          {WEEKLY_SETS.min}–{WEEKLY_SETS.max} hard sets a week grow muscle well. Muscles that only
          assist count half.
        </Text>
      </View>
      {MUSCLE_GROUPS.map((g) => (
        <View
          key={g}
          style={styles.row}
          accessible
          accessibilityLabel={`${g}: ${sets[g]} sets, ${weeklyLevel(sets[g])}`}
        >
          <Text style={[type.caption, styles.name]} numberOfLines={1}>
            {g}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={sets[g] / WEEKLY_SETS.min} />
          </View>
          <Text style={[type.captionStrong, tabular, styles.value]}>{sets[g]}</Text>
        </View>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { width: 84 },
  value: { width: 34, textAlign: 'right' },
});
