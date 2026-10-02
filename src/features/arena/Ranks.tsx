import { router } from 'expo-router';
import { Plus, UserPlus, X } from '@/components/icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { EmptyState, ListGroup, ListRow } from '@/components/List';
import { Chip, Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { isLiftMetric, resolveMetric, useLeaderboard, type RankRow } from '@/features/social/api';
import { formatKg } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { usePrefs, type ArenaMetric } from '@/stores/prefs';
import { accentA, colors, shadows, tabular, type } from '@/theme/tokens';

const TOP = 20;

export function metricLabel(m: ArenaMetric, exercises: Record<string, { name: string }>): string {
  if (m === 'volume') return 'Volume';
  if (m === 'workouts') return 'Workouts';
  if (m.startsWith('name:')) {
    const n = m.slice(5);
    return n === 'Bench press' ? 'Bench' : n;
  }
  return exercises[m]?.name ?? 'Exercise';
}

/** metric is 'volume' | 'workouts' | 'dots' | an exercise id (kg). */
function formatValue(metric: string, v: number): string {
  if (metric === 'dots') return v.toFixed(1);
  if (metric === 'volume') return `${(v / 1000).toFixed(1)} t`;
  if (metric === 'workouts') return `${Math.round(v)}`;
  return `${formatKg(v)} kg`;
}

export function Ranks({ friendCount }: { friendCount: number }) {
  const exercises = useData((s) => s.exercises);
  const myId = useData((s) => s.userId);
  const metrics = usePrefs((s) => s.arenaMetrics);
  const metric = usePrefs((s) => s.arenaMetric);
  const period = usePrefs((s) => s.arenaPeriod);
  const setMetric = usePrefs((s) => s.setArenaMetric);
  const dotsPref = usePrefs((s) => s.arenaDots);
  const setDots = usePrefs((s) => s.setArenaDots);
  const [editing, setEditing] = useState(false);
  const lift = isLiftMetric(metric);
  const dots = lift && dotsPref;
  const board = useLeaderboard('friends', metric, period, dots);
  const resolved = dots ? 'dots' : resolveMetric(metric);
  const canDots = useData((s) => !!s.profile?.sex && Object.keys(s.bodyweights).length > 0);
  const rows = board.data ?? [];
  const me = rows.find((r) => r.user_id === myId);
  const top = rows.slice(0, TOP);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        style={{ marginHorizontal: -20 }}
        contentInset={{ left: 20 }}
      >
        <View style={{ width: 12 }} />
        {metrics.map((m) => (
          <Chip
            key={m}
            label={metricLabel(m, exercises)}
            selected={m === metric}
            onPress={() => setMetric(m)}
          />
        ))}
        <Chip label="Edit" onPress={() => setEditing(true)} />
        <View style={{ width: 12 }} />
      </ScrollView>

      {lift ? (
        <View style={styles.unitRow}>
          <Text style={[type.small, { flex: 1 }]}>
            {dots ? 'Adjusted for bodyweight (DOTS)' : 'Best estimated 1RM'}
          </Text>
          <Segmented
            compact
            height={30}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'dots', label: 'DOTS' },
            ]}
            value={dots ? 'dots' : 'kg'}
            onChange={(v) => setDots(v === 'dots')}
            accessibilityLabel="Rank by"
          />
        </View>
      ) : null}

      {friendCount === 0 ? (
        <EmptyState
          title="Add friends to compete"
          text="The leaderboard ranks you against your friends."
          action={
            <FillButton
              label="Add friends"
              icon={UserPlus}
              onPress={() => router.push('/arena/friends')}
            />
          }
        />
      ) : board.isLoading ? (
        <Text style={[type.caption, { textAlign: 'center', paddingVertical: 24 }]}>Loading…</Text>
      ) : board.isError ? (
        <Text style={[type.caption, { textAlign: 'center', paddingVertical: 24 }]}>
          Could not load the leaderboard. Are you online?
        </Text>
      ) : rows.length === 0 ? (
        <EmptyState title="No results yet" text="Nobody has logged this in the chosen period." />
      ) : (
        <>
          <Podium rows={rows.slice(0, 3)} myId={myId} metric={resolved} />
          {top.length > 3 || (me && me.rank > TOP) ? (
            <Glass radius={22} style={{ padding: 4, gap: 2 }}>
              {top.slice(3).map((r) => (
                <RankLine key={r.user_id} row={r} me={r.user_id === myId} metric={resolved} />
              ))}
              {me && me.rank > TOP ? <RankLine row={me} me metric={resolved} /> : null}
            </Glass>
          ) : null}
          {!me ? (
            <Text style={[type.small, { textAlign: 'center' }]}>
              {dots && !canDots
                ? 'Set your sex in Settings and log your bodyweight in Profile → Body to get a DOTS score.'
                : 'You are not on this board yet. Log a finished workout to join.'}
            </Text>
          ) : null}
        </>
      )}

      <MetricsSheet visible={editing} onClose={() => setEditing(false)} />
    </>
  );
}

function Podium({ rows, myId, metric }: { rows: RankRow[]; myId: string; metric: string }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = [72, 96, 56];
  return (
    <View style={styles.podium}>
      {order.map((r, col) => {
        if (!r) return <View key={col} style={{ flex: 1 }} />;
        const first = col === 1;
        const you = r.user_id === myId;
        return (
          <Pressable
            key={r.user_id}
            style={styles.podiumCol}
            accessibilityRole="button"
            accessibilityLabel={`${r.rank}. ${you ? 'You' : r.display_name}, ${formatValue(metric, r.value)}`}
            onPress={() =>
              !you && router.push({ pathname: '/user/[id]', params: { id: r.user_id } })
            }
          >
            <Avatar
              name={r.display_name}
              url={r.avatar_url}
              size={first ? 62 : 52}
              white
              ring={
                first
                  ? { width: 2.5, color: colors.accent }
                  : you
                    ? { width: 2, color: accentA(0.45) }
                    : { width: 0.5, color: 'rgba(60,60,67,0.12)' }
              }
              style={{ boxShadow: shadows.avatar }}
            />
            <View style={{ alignItems: 'center' }}>
              <Text style={[type.bodyStrong, { fontSize: 14 }]} numberOfLines={1}>
                {you ? 'You' : r.display_name.split(' ')[0]}
              </Text>
              <Text style={[type.caption, tabular]}>{formatValue(metric, r.value)}</Text>
            </View>
            <Glass radius={16} style={[styles.block, { height: heights[col] }]}>
              <Text style={[styles.blockRank, { color: first ? colors.accent : colors.text2 }]}>
                {r.rank}
              </Text>
            </Glass>
          </Pressable>
        );
      })}
    </View>
  );
}

function RankLine({ row, me, metric }: { row: RankRow; me: boolean; metric: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={me}
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: row.user_id } })}
      style={[styles.line, me && { backgroundColor: accentA(0.08) }]}
    >
      <Text style={[styles.lineRank, tabular]}>{row.rank}</Text>
      <Avatar name={row.display_name} url={row.avatar_url} size={34} />
      <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>
        {me ? 'You' : row.display_name}
      </Text>
      <Text style={[type.bodyStrong, tabular]}>{formatValue(metric, row.value)}</Text>
    </Pressable>
  );
}

function MetricsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const exercises = useData((s) => s.exercises);
  const metrics = usePrefs((s) => s.arenaMetrics);
  const setMetrics = usePrefs((s) => s.setArenaMetrics);
  const metric = usePrefs((s) => s.arenaMetric);
  const setMetric = usePrefs((s) => s.setArenaMetric);
  const [picking, setPicking] = useState(false);

  const add = (m: string) => {
    if (!metrics.includes(m)) setMetrics([...metrics, m]);
    setMetric(m);
  };
  const remove = (m: string) => {
    const next = metrics.filter((x) => x !== m);
    if (next.length === 0) return;
    setMetrics(next);
    if (metric === m) setMetric(next[0]);
  };

  return (
    <>
      <Sheet
        visible={visible && !picking}
        onClose={onClose}
        title="Leaderboard metrics"
        onDone={onClose}
      >
        <Text style={type.caption}>
          Exercises rank by best estimated 1RM. Only finished workouts count.
        </Text>
        <ListGroup>
          {metrics.map((m) => (
            <ListRow
              key={m}
              height={50}
              title={metricLabel(m, exercises)}
              chevron={false}
              right={
                metrics.length > 1 ? (
                  <Pressable
                    accessibilityLabel={`Remove ${metricLabel(m, exercises)}`}
                    onPress={() => remove(m)}
                    hitSlop={10}
                  >
                    <X size={18} color={colors.text2} />
                  </Pressable>
                ) : null
              }
            />
          ))}
        </ListGroup>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {!metrics.includes('volume') ? (
            <Chip label="+ Volume" onPress={() => add('volume')} />
          ) : null}
          {!metrics.includes('workouts') ? (
            <Chip label="+ Workouts" onPress={() => add('workouts')} />
          ) : null}
        </View>
        <FillButton label="Add exercise" icon={Plus} onPress={() => setPicking(true)} />
      </Sheet>
      <ExercisePicker
        visible={visible && picking}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          const ex = exercises[id];
          add(ex && !ex.created_by ? `name:${ex.name}` : id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -4 },
  podium: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', paddingTop: 4 },
  podiumCol: { flex: 1, alignItems: 'center', gap: 8 },
  block: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    paddingTop: 10,
  },
  blockRank: { fontSize: 24, fontWeight: '700' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 50,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  lineRank: { width: 20, fontSize: 15, fontWeight: '600', color: colors.text2 },
});
