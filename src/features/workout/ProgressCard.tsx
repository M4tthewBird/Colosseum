/** In the summary: what got better lately, and a word after a break. Silent when nothing did. */
import { useMemo, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { TrendingUp } from '@/components/icons';
import { breakBefore, changeText, durationText, gainText, workoutProgress } from '@/lib/progress';
import type { Session } from '@/lib/types';
import { useData } from '@/stores/data';
import { colors, tabular, type } from '@/theme/tokens';

const SHOWN = 3;

export function ProgressCard({
  session,
  entering,
}: {
  session: Session;
  /** It animates in itself: with nothing to say, it must not leave a gap in the summary. */
  entering?: ComponentProps<typeof Animated.View>['entering'];
}) {
  const sessions = useData((s) => s.sessions);
  const exercises = useData((s) => s.exercises);
  const all = useMemo(() => Object.values(sessions), [sessions]);
  const progress = useMemo(() => workoutProgress(session, all), [session, all]);
  const away = useMemo(() => breakBefore(session, all), [session, all]);
  const name = (id: string) => exercises[id]?.name ?? 'Exercise';
  const { recent, sinceFirst } = progress;
  if (away === null && recent.length === 0 && !sinceFirst) return null;

  return (
    <Animated.View entering={entering}>
      <Glass radius={22} style={styles.card}>
        {away !== null ? (
          <View style={{ gap: 2 }}>
            <Text style={type.bodyStrong}>Welcome back</Text>
            <Text style={type.small}>
              First workout after {durationText(away)}. Coming back is the hardest part, and it is
              done.
            </Text>
          </View>
        ) : null}
        {recent.length > 0 || sinceFirst ? (
          <View style={styles.head}>
            <TrendingUp size={16} color={colors.accent} strokeWidth={2.2} />
            <Text style={type.bodyStrong}>Good progress</Text>
          </View>
        ) : null}
        {recent.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text style={type.small}>
              In your recent workouts you improved on {recent.length} exercise
              {recent.length === 1 ? '' : 's'}:
            </Text>
            {recent.slice(0, SHOWN).map((l) => (
              <View key={l.exerciseId} style={styles.row}>
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {name(l.exerciseId)}
                </Text>
                <Text style={[styles.gain, tabular]}>{gainText(l)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {sinceFirst ? (
          <Text style={type.small}>
            Since your first time {durationText(sinceFirst.days)} ago: {name(sinceFirst.exerciseId)}{' '}
            <Text style={styles.strong}>{changeText(sinceFirst)}</Text>.
          </Text>
        ) : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gain: { fontSize: 15, fontWeight: '700', color: colors.accent },
  strong: { color: colors.text, fontWeight: '700' },
});
