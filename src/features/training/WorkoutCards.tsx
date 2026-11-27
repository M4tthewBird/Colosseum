/**
 * The four ways to train at the top of Workouts (Matyáš, 2026-11-27): Gym, Run, Cycling and
 * Swimming. Each card says what is next or what was last, and opens its own screen.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Dumbbell, type LucideIcon } from '@/components/icons';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { SPORT_ICONS } from '@/features/running/sportIcons';
import { distanceText, paceText, SPORT, SPORTS, sportOf, type Sport } from '@/lib/cardio';
import { timeAgo } from '@/lib/dates';
import type { Session } from '@/lib/types';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useFinishedSessions, useUpNext } from './hooks';

function Card({
  icon: Icon,
  title,
  line,
  sub,
  label,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  line: string;
  sub: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
    >
      <Glass radius={22} style={styles.card}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.caption, tabular]} numberOfLines={1}>
          {line}
        </Text>
        <Text style={[type.small, tabular]} numberOfLines={1}>
          {sub}
        </Text>
      </Glass>
    </Pressable>
  );
}

const thisMonth = (list: Session[]) => {
  const now = new Date();
  return list.filter((s) => {
    const d = new Date(s.started_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
};

const monthText = (n: number) => (n ? `${n} this month` : 'None this month');

export function WorkoutCards() {
  const sessions = useFinishedSessions();
  const { day } = useUpNext();
  const bySport = useMemo(() => {
    const out: Record<Sport | 'gym', Session[]> = { gym: [], run: [], ride: [], swim: [] };
    for (const s of sessions) out[sportOf(s) ?? 'gym'].push(s);
    return out;
  }, [sessions]);
  const lastLift = bySport.gym[0];

  return (
    <View style={styles.grid}>
      <View style={styles.cell}>
        <Card
          icon={Dumbbell}
          title="Gym"
          line={
            day
              ? `Up next: ${day.name}`
              : lastLift
                ? `${lastLift.name} · ${timeAgo(lastLift.started_at)}`
                : 'Start a workout'
          }
          sub={monthText(thisMonth(bySport.gym))}
          label="Gym: your program and workouts"
          onPress={() => router.push('/workouts/gym')}
        />
      </View>
      {SPORTS.map((sport) => {
        const last = bySport[sport][0];
        const info = SPORT[sport];
        const card = (
          <Card
            icon={SPORT_ICONS[sport]}
            title={sport === 'run' ? 'Run' : info.title}
            line={
              last?.distance_m && last.duration_s
                ? `${distanceText(sport, last.distance_m)} · ${paceText(sport, last.distance_m, last.duration_s)}`
                : `Log ${info.noun}`
            }
            sub={last ? `${monthText(thisMonth(bySport[sport]))}` : 'Nothing yet'}
            label={`${info.title}: log ${info.noun}, your bests and history`}
            onPress={() => router.push({ pathname: '/workouts/sport/[sport]', params: { sport } })}
          />
        );
        return sport === 'run' ? (
          <TourTarget key={sport} id="workouts-run" style={styles.cell}>
            {card}
          </TourTarget>
        ) : (
          <View key={sport} style={styles.cell}>
            {card}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%', flexGrow: 1, flexBasis: 150 },
  press: { flex: 1 },
  card: { flex: 1, padding: 14, gap: 4, minHeight: 128 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
});
