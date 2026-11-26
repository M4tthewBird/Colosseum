import { router, useLocalSearchParams } from 'expo-router';
import { SlidersHorizontal } from '@/components/icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { BadgeGrid } from '@/features/badges/BadgeViews';
import { useMyBadges } from '@/features/badges/hooks';
import { useGameOn } from '@/features/game/gameMode';
import { LevelLine, XpBar } from '@/features/game/GameViews';
import { useMyGame } from '@/features/game/hooks';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { BodyView } from '@/features/profile/BodyView';
import { FeelTrend } from '@/features/profile/FeelTrend';
import { WeeklySets } from '@/features/profile/WeeklySets';
import { LiftsView } from '@/features/profile/LiftsView';
import { RunningBests } from '@/features/running/RunViews';
import { useGym } from '@/features/social/api';
import { useFinishedSessions } from '@/features/training/hooks';
import { useData } from '@/stores/data';
import { type } from '@/theme/tokens';

type Section = 'body' | 'lifts' | 'badges';
const isSection = (s: unknown): s is Section => s === 'body' || s === 'lifts' || s === 'badges';

export default function Profile() {
  const profile = useData((s) => s.profile);
  const exercises = useData((s) => s.exercises);
  const sessions = useFinishedSessions();
  const gym = useGym(profile?.home_gym_id);
  // ?section=badges (What's new → Show me) opens a section, also when Profile is already open.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<Section>(() => (isSection(section) ? section : 'body'));
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    setLastSection(section);
    if (isSection(section)) setTab(section);
  }
  const badges = useMyBadges();
  const game = useMyGame();
  const gameOn = useGameOn();
  // The gladiator moved to City → Your domus: old links (?section=gladiator) go there.
  useEffect(() => {
    if (section === 'gladiator') router.replace('/city/domus');
  }, [section]);

  if (!profile) return null;
  const gymName = gym.data?.gym?.name;

  return (
    <Screen glow="right" glowTop={-120} gap={14}>
      <Header
        title="Profile"
        right={
          <IconButton
            icon={SlidersHorizontal}
            accessibilityLabel="Settings"
            onPress={() => router.push('/profile/settings')}
          />
        }
      />
      <Glass radius={22} style={styles.card}>
        <View style={styles.top}>
          <Avatar name={profile.display_name} url={profile.avatar_url} size={54} />
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.display_name}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              @{profile.username}
              {gymName ? ` · ${gymName}` : ''}
            </Text>
          </View>
        </View>
        {gameOn ? (
          <TourTarget id="profile-level">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Your gladiator, level ${game.level}`}
              onPress={() => router.navigate('/city/domus')}
              style={{ gap: 6 }}
            >
              <LevelLine level={game.level} />
              <XpBar progress={game.progress} />
            </Pressable>
          </TourTarget>
        ) : null}
      </Glass>
      <TourTarget id="profile-sections">
        <Segmented
          options={[
            { value: 'body', label: 'Body' },
            { value: 'lifts', label: 'Lifts' },
            { value: 'badges', label: 'Badges' },
          ]}
          value={tab}
          onChange={setTab}
          accessibilityLabel="Profile sections"
        />
      </TourTarget>
      {tab === 'body' ? (
        <BodyView />
      ) : tab === 'badges' ? (
        <BadgeGrid badges={badges} />
      ) : (
        <>
          <WeeklySets sessions={sessions} exercises={exercises} />
          <FeelTrend sessions={sessions} />
          <LiftsView
            sessions={sessions}
            exercises={exercises}
            onPressExercise={(id) =>
              router.push({ pathname: '/profile/exercise/[id]', params: { id } })
            }
          />
          <RunningBests />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
});
