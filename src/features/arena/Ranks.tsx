/**
 * Arena leaderboard. One question leads the screen: who are you up against (friends, your gym,
 * everyone)? The champion wears the Colosseum laurel; 2nd and 3rd stand beside them; everyone
 * else follows in a list, and your own row says how far you are from the next place.
 */
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, Plus, UserPlus, X } from '@/components/icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import { EmptyState, ListGroup, ListRow } from '@/components/List';
import { LogoMark } from '@/components/Logo';
import { Chip, Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Pill, useSlidingPill } from '@/components/SlidingPill';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { isLiftMetric, resolveMetric, useLeaderboard, type RankRow } from '@/features/social/api';
import { formatKg } from '@/lib/formulas';
import { flush } from '@/lib/sync';
import { useData } from '@/stores/data';
import { usePrefs, type ArenaMetric, type ArenaPeriod, type ArenaScope } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { dur, ease, useReducedMotion } from '@/theme/motion';
import { accentA, colors, tabular, type } from '@/theme/tokens';

const TOP = 20;

export function metricLabel(m: ArenaMetric, exercises: Record<string, { name: string }>): string {
  if (m === 'volume') return 'Volume';
  if (m === 'workouts') return 'Workouts';
  if (m.startsWith('name:')) {
    const n = m.slice(5);
    return n.toLowerCase() === 'bench press' ? 'Bench' : n;
  }
  return exercises[m]?.name ?? 'Exercise';
}

/** metric is 'volume' | 'workouts' | 'dots' | an exercise id (kg). Null = rank only. */
function formatValue(metric: string, v: number | null): string {
  if (v == null) return '';
  if (metric === 'dots') return v.toFixed(1);
  if (metric === 'volume') return `${(v / 1000).toFixed(1)} t`;
  if (metric === 'workouts') return `${Math.round(v)}`;
  return `${formatKg(v)} kg`;
}

/** A difference in the board's unit: "1.2 t", "2 workouts", "7.5 kg", "3.1 points". */
function formatGap(metric: string, v: number): string {
  if (metric === 'workouts') {
    const n = Math.round(v);
    return `${n} workout${n === 1 ? '' : 's'}`;
  }
  if (metric === 'dots') return `${v.toFixed(1)} points`;
  return formatValue(metric, v);
}

const PERIOD_TEXT: Record<ArenaPeriod, string> = {
  week: 'this week',
  month: 'this month',
  all: 'of all time',
};

const SCOPES: { value: ArenaScope; label: string }[] = [
  { value: 'friends', label: 'Friends' },
  { value: 'gym', label: 'My gym' },
  { value: 'global', label: 'Global' },
];

/** Who you compete with: three large words, a red rule slides under the chosen one. */
export function ScopeTabs({
  value,
  onChange,
}: {
  value: ArenaScope;
  onChange: (s: ArenaScope) => void;
}) {
  const selected = SCOPES.findIndex((s) => s.value === value);
  const rule = useSlidingPill(SCOPES.length, selected);
  return (
    <View style={styles.scopes} accessibilityRole="tablist" accessibilityLabel="Compete with">
      {SCOPES.map((s, i) => {
        const on = i === selected;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(s.value)}
            onLayout={rule.onItemLayout(i)}
            hitSlop={{ left: 8, right: 8 }}
            style={styles.scope}
          >
            <Text style={[styles.scopeText, { color: on ? colors.text : colors.text2 }]}>
              {s.label}
            </Text>
            {on && !rule.animated ? <View style={styles.rule} /> : null}
          </Pressable>
        );
      })}
      {rule.animated ? <Pill pillStyle={rule.style} style={styles.rule} /> : null}
    </View>
  );
}

export function Ranks({ scope, friendCount }: { scope: ArenaScope; friendCount: number }) {
  const exercises = useData((s) => s.exercises);
  const myId = useData((s) => s.userId);
  const metrics = usePrefs((s) => s.arenaMetrics);
  const metric = usePrefs((s) => s.arenaMetric);
  const period = usePrefs((s) => s.arenaPeriod);
  const setMetric = usePrefs((s) => s.setArenaMetric);
  const dotsPref = usePrefs((s) => s.arenaDots);
  const setDots = usePrefs((s) => s.setArenaDots);
  const [editing, setEditing] = useState(false);
  const joined = useData((s) => !!s.profile?.global_ranking);
  const lift = isLiftMetric(metric);
  const dots = lift && dotsPref;
  const board = useLeaderboard(scope, metric, period, dots);
  const resolved = dots ? 'dots' : resolveMetric(metric);
  const canDots = useData((s) => !!s.profile?.sex && Object.keys(s.bodyweights).length > 0);
  const rows = board.data ?? [];
  const me = rows.find((r) => r.user_id === myId);
  const limit = scope === 'global' ? 50 : TOP;

  return (
    <>
      <View style={{ gap: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          style={{ marginHorizontal: -20 }}
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
              {dots
                ? 'Bodyweight-adjusted (DOTS). Ranks only, so nobody can work out your bodyweight.'
                : 'Best estimated 1RM'}
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
      </View>

      {scope === 'global' && !joined ? (
        <JoinGlobal />
      ) : scope === 'friends' && friendCount === 0 ? (
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
        <Text style={[type.caption, styles.status]}>Loading…</Text>
      ) : board.isError ? (
        <Text style={[type.caption, styles.status]}>
          Could not load the leaderboard. Are you online?
        </Text>
      ) : rows.length === 0 ? (
        <EmptyState title="No results yet" text="Nobody has logged this in the chosen period." />
      ) : (
        <>
          <Champion row={rows[0]} me={rows[0].user_id === myId} metric={resolved} period={period}>
            {rows.length > 1 ? (
              <View style={styles.runners}>
                {rows.slice(1, 3).map((r) => (
                  <RunnerUp key={r.user_id} row={r} me={r.user_id === myId} metric={resolved} />
                ))}
              </View>
            ) : null}
          </Champion>
          {rows.length > 3 || (me && me.rank > limit) ? (
            <Glass radius={22} style={styles.list}>
              {rows.slice(3, limit).map((r) => (
                <RankLine
                  key={r.user_id}
                  row={r}
                  me={r.user_id === myId}
                  metric={resolved}
                  rows={rows}
                />
              ))}
              {me && me.rank > limit ? (
                <RankLine row={me} me metric={resolved} rows={rows} />
              ) : null}
            </Glass>
          ) : null}
          {me && me.rank > 1 && me.rank <= 3 ? (
            <Text style={[type.small, { textAlign: 'center' }]}>{gapText(me, rows, resolved)}</Text>
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

/** "1.2 t behind Lukáš" / "Leading by 3.4 t"; null when the scores are hidden (DOTS). */
function gapText(me: RankRow, rows: RankRow[], metric: string): string | null {
  if (me.value == null) return null;
  const i = rows.indexOf(me);
  if (i === 0) {
    const next = rows[1];
    return next?.value != null ? `Leading by ${formatGap(metric, me.value - next.value)}` : null;
  }
  const ahead = rows[i - 1];
  if (ahead?.value == null) return null;
  const d = ahead.value - me.value;
  return d > 0
    ? `${formatGap(metric, d)} behind ${ahead.display_name}`
    : `Level with ${ahead.display_name}`;
}

const openUser = (id: string) => router.push({ pathname: '/user/[id]', params: { id } });

/** The victor: crowned with the Colosseum laurel, which blooms in when the board loads. */
function Champion({
  row,
  me,
  metric,
  period,
  children,
}: {
  row: RankRow;
  me: boolean;
  metric: string;
  period: ArenaPeriod;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const bloom = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    bloom.value = 0;
    bloom.value = withTiming(1, { duration: dur.focal, easing: ease });
  }, [row.user_id, reduced, bloom]);
  const wreath = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: 0.7 + 0.3 * bloom.value }, { rotate: `${(1 - bloom.value) * -20}deg` }],
  }));
  const value = formatValue(metric, row.value);
  const name = me ? 'You' : row.display_name;

  return (
    <GlassCard radius={26} style={styles.champion}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Champion ${PERIOD_TEXT[period]}: ${name}${value ? `, ${value}` : ''}`}
        disabled={me}
        onPress={() => openUser(row.user_id)}
        style={styles.championBody}
      >
        <View style={styles.crown}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, wreath]} aria-hidden>
            <LogoMark size={CROWN} bell={false} />
          </Animated.View>
          <Avatar
            name={row.display_name}
            url={row.avatar_url}
            size={CROWN * 0.5}
            white
            style={styles.championAvatar}
          />
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={type.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={type.caption}>
            {me ? 'You lead' : 'Leads'} {PERIOD_TEXT[period]}
          </Text>
        </View>
        {value ? <Text style={[styles.championValue, tabular]}>{value}</Text> : null}
      </Pressable>
      {children}
    </GlassCard>
  );
}

const CROWN = 150;

function RunnerUp({ row, me, metric }: { row: RankRow; me: boolean; metric: string }) {
  const value = formatValue(metric, row.value);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.rank}. ${me ? 'You' : row.display_name}${value ? `, ${value}` : ''}`}
      disabled={me}
      onPress={() => openUser(row.user_id)}
      style={[styles.runner, me && { backgroundColor: accentA(0.08) }]}
    >
      <Text style={[styles.runnerRank, tabular]}>{row.rank}</Text>
      <Avatar name={row.display_name} url={row.avatar_url} size={40} white />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {me ? 'You' : row.display_name}
        </Text>
        {value ? <Text style={[type.caption, tabular]}>{value}</Text> : null}
      </View>
    </Pressable>
  );
}

function RankLine({
  row,
  me,
  metric,
  rows,
}: {
  row: RankRow;
  me: boolean;
  metric: string;
  rows: RankRow[];
}) {
  const gap = me ? gapText(row, rows, metric) : null;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={me}
      onPress={() => openUser(row.user_id)}
      style={[styles.line, me && { backgroundColor: accentA(0.08) }]}
    >
      <Text style={[styles.lineRank, tabular]}>{row.rank}</Text>
      <Avatar name={row.display_name} url={row.avatar_url} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {me ? 'You' : row.display_name}
        </Text>
        {gap ? <Text style={[type.small, { color: colors.accent }]}>{gap}</Text> : null}
      </View>
      <Text style={[type.bodyStrong, tabular]}>{formatValue(metric, row.value)}</Text>
    </Pressable>
  );
}

/** Opt-in card: the global board shows only people who joined it, to people who joined it. */
function JoinGlobal() {
  const qc = useQueryClient();
  const join = async () => {
    const { profile, saveProfile } = useData.getState();
    if (!profile) return;
    saveProfile({ ...profile, global_ranking: true });
    await flush();
    void qc.invalidateQueries({ queryKey: ['leaderboard'] });
    toast('You joined the global leaderboard');
  };
  return (
    <GlassCard radius={26} style={styles.join}>
      <View style={styles.crownSmall}>
        <LogoMark size={92} bell={false} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Globe size={30} color={colors.accent} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={[type.title, { textAlign: 'center' }]}>Take on everyone</Text>
      <Text style={[type.caption, { textAlign: 'center', fontSize: 15, lineHeight: 21 }]}>
        The global leaderboard ranks everyone in Colosseum who joined it. Others see your name,
        photo and the number you are ranked by. Your bodyweight is never shown. Leave any time in
        Settings.
      </Text>
      <FillButton
        label="Join the global leaderboard"
        icon={Globe}
        style={{ alignSelf: 'stretch' }}
        onPress={() => void join()}
      />
    </GlassCard>
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
  center: { alignItems: 'center', justifyContent: 'center' },
  status: { textAlign: 'center', paddingVertical: 24 },
  scopes: { flexDirection: 'row', gap: 22, alignItems: 'flex-end' },
  scope: { height: 44, justifyContent: 'center' },
  scopeText: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  rule: { bottom: 0, height: 3, borderRadius: 1.5, backgroundColor: colors.accent },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  champion: { paddingTop: 22, paddingHorizontal: 14, paddingBottom: 14, gap: 16 },
  championBody: { alignItems: 'center', gap: 10 },
  crown: { width: CROWN, height: CROWN, alignItems: 'center', justifyContent: 'center' },
  championAvatar: { marginTop: -6, boxShadow: '0 6px 18px rgba(185,28,28,0.18)' },
  championValue: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.text,
    marginTop: -4,
  },
  runners: { flexDirection: 'row', gap: 8 },
  runner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  runnerRank: { fontSize: 18, fontWeight: '700', color: colors.text2, minWidth: 12 },
  list: { padding: 4, gap: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  lineRank: { minWidth: 20, fontSize: 15, fontWeight: '600', color: colors.text2 },
  join: { alignItems: 'center', gap: 12, padding: 22 },
  crownSmall: { width: 92, height: 92 },
});
