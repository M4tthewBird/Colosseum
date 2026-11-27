/**
 * Cardio views: a run's, ride's or swim's detail (the session screen for those kinds), the bests
 * of a sport (its own screen in Workouts) and every sport's bests on Profile → Lifts.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Pencil, Trash2 } from '@/components/icons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { RewardCard } from '@/features/game/RewardCard';
import {
  asCardio,
  cardioBests,
  cardioResults,
  distanceText,
  paceText,
  SPORT,
  SPORTS,
  sportDistances,
  sportOf,
  type CardioLike,
  type Sport,
} from '@/lib/cardio';
import { shortDate } from '@/lib/dates';
import { formatRunTime } from '@/lib/running';
import type { Session } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

/** My finished runs, rides and swims (or one sport's). */
export function useCardio(sport?: Sport): CardioLike[] {
  const sessions = useData((s) => s.sessions);
  return useMemo(
    () =>
      Object.values(sessions)
        .filter((s) => s.finished_at)
        .map(asCardio)
        .filter((c): c is CardioLike => !!c && (!sport || c.sport === sport)),
    [sessions, sport],
  );
}

/** The body of the session screen for a run, ride or swim. `fresh`: just logged, so the reward leads. */
export function RunDetail({ session, fresh }: { session: Session; fresh?: boolean }) {
  const deleteSession = useData((s) => s.deleteSession);
  const sport = sportOf(session) ?? 'run';
  const info = SPORT[sport];
  const list = useCardio(sport);
  const result = useMemo(() => cardioResults(list).get(session.id), [list, session.id]);
  const distance = session.distance_m ?? 0;
  const duration = session.duration_s ?? 0;
  const label = sportDistances(sport).find((d) => d.id === result?.distance)?.label;
  const place = info.places.find((p) => p.id === session.run_place)?.label ?? info.places[0].label;
  const pace = paceText(sport, distance, duration);
  const noun = info.name.toLowerCase();

  return (
    <>
      {fresh ? <RewardCard sessionId={session.id} /> : null}
      <GlassCard style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Stat value={distanceText(sport, distance)} label="Distance" />
        <Stat value={formatRunTime(duration)} label="Time" />
        <Stat
          value={pace.replace(/ \/km| km\/h| \/100 m/, '')}
          label={sport === 'ride' ? 'km/h' : sport === 'swim' ? 'Pace /100 m' : 'Pace /km'}
        />
        <Stat value={String(session.pr_count)} label="PRs" accent={session.pr_count > 0} />
      </GlassCard>

      <ListGroup>
        <ListRow
          height={50}
          title="Where"
          chevron={false}
          right={<Text style={type.body}>{place}</Text>}
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
        label={`Edit ${noun}`}
        icon={Pencil}
        onPress={() => router.push({ pathname: '/run/[id]', params: { id: session.id } })}
      />
      <FillButton
        label={`Delete ${noun}`}
        icon={Trash2}
        onPress={async () => {
          const ok = await confirm({
            title: `Delete this ${noun}?`,
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

/** A sport's best times and its total distance. `always`: show the rows even with no sessions. */
export function SportBests({ sport, always }: { sport: Sport; always?: boolean }) {
  const list = useCardio(sport);
  const bests = useMemo(() => cardioBests(sport, list), [sport, list]);
  const total = useMemo(() => list.reduce((sum, c) => sum + c.distance_m, 0), [list]);
  if (list.length === 0 && !always) return null;
  return (
    <ListGroup>
      {sportDistances(sport).map((d) => {
        const b = bests.find((x) => x.id === d.id);
        return (
          <ListRow
            key={d.id}
            height={b ? 58 : 50}
            title={d.label}
            subtitle={
              b ? `${paceText(sport, d.meters, b.time)} · ${shortDate(new Date(b.at))}` : undefined
            }
            onPress={
              b
                ? () => router.push({ pathname: '/session/[id]', params: { id: b.sessionId } })
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
        title={`${sport === 'run' ? 'Run' : sport === 'ride' ? 'Ridden' : 'Swum'} all time`}
        chevron={false}
        right={<Text style={[type.bodyStrong, tabular]}>{distanceText(sport, total)}</Text>}
      />
    </ListGroup>
  );
}

/** Bests of every sport you have done, for Profile → Lifts. Nothing without runs, rides or swims. */
export function RunningBests() {
  const list = useCardio();
  const done = SPORTS.filter((s) => list.some((c) => c.sport === s));
  if (!done.length) return null;
  return (
    <>
      {done.map((sport) => (
        <View key={sport} style={{ gap: 8 }}>
          <SectionHeader title={SPORT[sport].title} />
          <SportBests sport={sport} />
        </View>
      ))}
    </>
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
