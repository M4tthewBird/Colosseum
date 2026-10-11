/** "Next: 82.5 kg × 6" from last time's sets, effort and feel, with Use to fill the sets. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Equal, TrendingDown, TrendingUp } from '@/components/icons';
import { isMain } from '@/lib/dropsets';
import { formatKg } from '@/lib/formulas';
import { suggestNext } from '@/lib/progression';
import { lastTimeSets } from '@/lib/stats';
import type { Session } from '@/lib/types';
import type { PlannedExercise } from '@/stores/workout';
import { colors, tabular, type } from '@/theme/tokens';
import { applyWeight } from './actions';

export function NextSuggestion({
  plan,
  name,
  session,
  sessions,
}: {
  plan: PlannedExercise;
  name: string;
  session: Session;
  sessions: Session[];
}) {
  const last = lastTimeSets(sessions, plan.exercise_id, session.id);
  const lastSession = last.length ? sessions.find((s) => s.id === last[0].session_id) : undefined;
  const tip = suggestNext(last, plan, lastSession ?? null, name);
  if (!tip) return null;
  const open = session.sets.filter(
    (s) => s.exercise_position === plan.position && isMain(s) && !s.done,
  );
  const canApply = open.some((s) => s.weight_kg !== tip.weight);
  const Icon = tip.kind === 'up' ? TrendingUp : tip.kind === 'down' ? TrendingDown : Equal;
  return (
    <View
      style={styles.row}
      accessibilityLabel={`Suggestion: ${formatKg(tip.weight)} kg for ${tip.reps} reps. ${tip.reason}`}
    >
      <Icon size={16} color={tip.kind === 'up' ? colors.accent : colors.text2} strokeWidth={2.4} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.bodyStrong, tabular]}>
          Next: {formatKg(tip.weight)} kg × {tip.reps}
        </Text>
        <Text style={type.small} numberOfLines={2}>
          {tip.reason}
        </Text>
      </View>
      {canApply ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${formatKg(tip.weight)} kg for the remaining sets`}
          onPress={() => applyWeight(plan.position, tip.weight)}
          style={({ pressed }) => [styles.use, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.useText}>Use</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  use: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.fill,
    justifyContent: 'center',
  },
  useText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
