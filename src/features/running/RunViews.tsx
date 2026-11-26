/**
 * Running views: a run's detail (the session screen for kind 'run') and the running bests on
 * Profile → Lifts.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Pencil, Trash2 } from '@/components/icons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { RewardCard } from '@/features/game/RewardCard';
import { shortDate } from '@/lib/dates';
import {
  asRun,
  formatKm,
  formatPace,
  formatRunTime,
  paceOf,
  RUN_DISTANCES,
  runBests,
  runResults,
  type RunLike,
} from '@/lib/running';
import type { Session } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

function useRuns(): RunLike[] {
  const sessions = useData((s) => s.sessions);
  return useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => s.finished_at)
        .map(asRun)
        .filter((r): r is RunLike => !!r),
    [sessions],
  );
}

/** The body of the session screen for a run. `fresh`: just logged, so the reward leads. */
export function RunDetail({ session, fresh }: { session: Session; fresh?: boolean }) {
  const deleteSession = useData((s) => s.deleteSession);
  const runs = useRuns();
  const result = useMemo(() => runResults(runs).get(session.id), [runs, session.id]);
  const distance = session.distance_m ?? 0;
  const duration = session.duration_s ?? 0;
  const label = RUN_DISTANCES.find((d) => d.id === result?.distance)?.label;

  return (
    <>
      {fresh ? <RewardCard sessionId={session.id} /> : null}
      <GlassCard style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Stat value={formatKm(distance)} label="Distance" />
        <Stat value={formatRunTime(duration)} label="Time" />
        <Stat value={formatPace(paceOf(distance, duration)).replace(' /km', '')} label="Pace /km" />
        <Stat value={String(session.pr_count)} label="PRs" accent={session.pr_count > 0} />
      </GlassCard>

      <ListGroup>
        <ListRow
          height={50}
          title="Where"
          chevron={false}
          right={
            <Text style={type.body}>
              {session.run_place === 'treadmill' ? 'Treadmill' : 'Outdoor'}
            </Text>
          }
        />
        {label && result?.time != null ? (
          <ListRow
            height={50}
            title={`${label} time`}
            chevron={false}
            right={
              <Text
                style={[
                  type.body,
                  tabular,
                  result.pr && { color: colors.accent, fontWeight: '600' },
                ]}
              >
                {formatRunTime(result.time)}
                {result.pr ? ' · PR' : ''}
              </Text>
            }
          />
        ) : null}
        {session.elevation_m != null ? (
          <ListRow
            height={50}
            title="Elevation gain"
            chevron={false}
            right={<Text style={[type.body, tabular]}>{session.elevation_m} m</Text>}
          />
        ) : null}
        {session.avg_hr != null ? (
          <ListRow
            height={50}
            title="Avg heart rate"
            subtitle="Only you see this"
            chevron={false}
            right={<Text style={[type.body, tabular]}>{session.avg_hr} bpm</Text>}
          />
        ) : null}
      </ListGroup>
      {session.notes?.run ? (
        <GlassCard radius={22} style={{ padding: 16 }}>
          <Text style={type.body}>{session.notes.run}</Text>
        </GlassCard>
      ) : null}
      {!fresh ? <RewardCard sessionId={session.id} /> : null}

      <FillButton
        label="Edit run"
        icon={Pencil}
        onPress={() => router.push({ pathname: '/run/[id]', params: { id: session.id } })}
      />
      <FillButton
        label="Delete run"
        icon={Trash2}
        onPress={async () => {
          const ok = await confirm({
            title: 'Delete this run?',
            message: 'It is removed for good, with its XP and PR.',
            confirmLabel: 'Delete',
            destructive: true,
          });
          if (!ok) return;
          deleteSession(session.id);
          if (router.canGoBack()) router.back();
          else router.replace('/workouts');
        }}
      />
    </>
  );
}

/** Best times on 5 km, 10 km, half and marathon, for Profile → Lifts. Nothing without runs. */
export function RunningBests() {
  const runs = useRuns();
  const bests = useMemo(() => runBests(runs), [runs]);
  const total = useMemo(() => runs.reduce((sum, r) => sum + r.distance_m, 0), [runs]);
  if (runs.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <SectionHeader title="Running" />
      <ListGroup>
        {RUN_DISTANCES.map((d) => {
          const b = bests[d.id];
          return (
            <ListRow
              key={d.id}
              height={b ? 58 : 50}
              title={d.label}
              subtitle={
                b
                  ? `${formatPace(b.time / (d.meters / 1000))} · ${shortDate(new Date(b.at))}`
                  : undefined
              }
              onPress={
                b
                  ? () => router.push({ pathname: '/session/[id]', params: { id: b.runId } })
                  : undefined
              }
              chevron={!!b}
              right={
                <Text style={[type.bodyStrong, tabular, !b && { color: colors.text2 }]}>
                  {b ? formatRunTime(b.time) : '—'}
                </Text>
              }
            />
          );
        })}
        <ListRow
          height={50}
          title="Run all time"
          chevron={false}
          right={<Text style={[type.bodyStrong, tabular]}>{formatKm(total)}</Text>}
        />
      </ListGroup>
    </View>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        style={[styles.stat, accent && { color: colors.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { fontSize: 16, fontWeight: '700', color: colors.text },
});
