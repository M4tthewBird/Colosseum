/** Workouts → Run, Cycling or Swimming: log one, the bests and every session of the sport. */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { ListGroup, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { SportBests } from '@/features/running/RunViews';
import { SPORT_ICONS } from '@/features/running/sportIcons';
import { useFinishedSessions } from '@/features/training/hooks';
import { SessionRow } from '@/features/training/SessionRow';
import { SPORT, sportOf, type Sport } from '@/lib/cardio';
import { useData } from '@/stores/data';
import { type } from '@/theme/tokens';

export default function SportScreen() {
  const { sport: asked } = useLocalSearchParams<{ sport: string }>();
  const sport: Sport = asked === 'ride' || asked === 'swim' ? asked : 'run';
  const info = SPORT[sport];
  const sessions = useFinishedSessions();
  const exercises = useData((s) => s.exercises);
  const mine = useMemo(() => sessions.filter((s) => sportOf(s) === sport), [sessions, sport]);
  const plural = sport === 'run' ? 'runs' : sport === 'ride' ? 'rides' : 'swims';

  return (
    <Screen glow="left" glowTop={-120}>
      <BackLink label="Workouts" fallback="/workouts" />
      <Header
        above={mine.length ? `${mine.length} ${plural}` : 'Nothing logged yet'}
        title={info.title}
      />
      <FillButton
        label={`Log ${info.noun}`}
        icon={SPORT_ICONS[sport]}
        onPress={() => router.push({ pathname: '/run/[id]', params: { id: 'new', sport } })}
      />
      <Text style={[type.small, { paddingHorizontal: 4 }]}>
        {info.minText} They count in wars like a workout.
      </Text>

      <View style={{ gap: 8 }}>
        <SectionHeader title="Bests" />
        <SportBests sport={sport} always />
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title={`Previous ${plural}`} />
        {mine.length ? (
          <ListGroup>
            {mine.slice(0, 30).map((s) => (
              <SessionRow key={s.id} session={s} exercises={exercises} />
            ))}
          </ListGroup>
        ) : (
          <GlassCard radius={22} style={{ padding: 16 }}>
            <Text style={[type.caption, { textAlign: 'center' }]}>Your {plural} show up here.</Text>
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}
