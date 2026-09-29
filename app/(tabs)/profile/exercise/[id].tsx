import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { Sparkline } from '@/components/Charts';
import { Glass, GlassCard } from '@/components/Glass';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Header, MAX_WIDTH, Screen } from '@/components/Screen';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { musclesLabel } from '@/features/exercises/ExercisePicker';
import { useFinishedSessions } from '@/features/training/hooks';
import { shortDate } from '@/lib/dates';
import { formatKg } from '@/lib/formulas';
import { exerciseHistory } from '@/lib/stats';
import { useData } from '@/stores/data';
import { colors, tabular, type } from '@/theme/tokens';

/** Exercise detail: chart of best estimated 1RM, PRs and session history. */
export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = useData((s) => s.exercises[id]);
  const sessions = useFinishedSessions();
  const history = useMemo(() => exerciseHistory(sessions, id), [sessions, id]);
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, MAX_WIDTH) - 40 - 36;

  const prs = history.flatMap((h) =>
    h.sets.filter((s) => s.is_pr).map((s) => ({ ...s, date: h.date })),
  );
  const values = history.map((h) => h.best.e1rm);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  return (
    <Screen gap={16}>
      <BackLink label="Profile" fallback="/profile" />
      <Header
        above={ex ? musclesLabel(ex.muscles) : ''}
        title={ex?.name ?? 'Exercise'}
        titleSize={28}
      />
      <ExerciseImage
        imageKey={ex?.image_key ?? null}
        name={ex?.name ?? ''}
        height={Math.round(((chartW + 36) * 9) / 16)}
      />

      <GlassCard style={{ gap: 12 }}>
        <Text style={type.captionStrong}>Best estimated 1RM per session</Text>
        {values.length >= 2 ? (
          <>
            <View style={styles.axis}>
              <Text style={[type.small, tabular]}>{formatKg(max)} kg</Text>
            </View>
            <Sparkline values={values} width={chartW} height={120} />
            <View style={styles.axis}>
              <Text style={[type.small, tabular]}>{formatKg(min)} kg</Text>
              <Text style={type.small}>
                {shortDate(new Date(history[0].date))} –{' '}
                {shortDate(new Date(history[history.length - 1].date))}
              </Text>
            </View>
          </>
        ) : (
          <Text style={type.caption}>Log this exercise in two sessions to see a trend.</Text>
        )}
      </GlassCard>

      <View style={{ gap: 8 }}>
        <SectionHeader title="PRs" />
        {prs.length ? (
          <ListGroup>
            {prs
              .slice()
              .reverse()
              .slice(0, 10)
              .map((p) => (
                <ListRow
                  key={p.id}
                  height={50}
                  title={`${formatKg(p.weight_kg)} kg × ${p.reps}`}
                  right={<Text style={type.caption}>{shortDate(new Date(p.date))}</Text>}
                />
              ))}
          </ListGroup>
        ) : (
          <Text style={[type.caption, { paddingHorizontal: 4 }]}>No PRs yet.</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title="History" />
        {history
          .slice()
          .reverse()
          .map((h) => (
            <Glass key={h.sessionId} radius={22} style={{ padding: 14, gap: 4 }}>
              <View style={styles.axis}>
                <Text style={type.bodyStrong}>{shortDate(new Date(h.date))}</Text>
                <Text
                  style={[type.caption, h.hasPr && { color: colors.accent, fontWeight: '600' }]}
                >
                  {h.hasPr ? 'PR · ' : ''}e1RM {formatKg(h.best.e1rm)} kg
                </Text>
              </View>
              <Text
                style={[type.caption, tabular]}
                onPress={() =>
                  router.push({ pathname: '/session/[id]', params: { id: h.sessionId } })
                }
              >
                {h.sets.map((s) => `${formatKg(s.weight_kg)}×${s.reps}`).join('  ')}
              </Text>
            </Glass>
          ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
