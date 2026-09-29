import { router } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { BodyView } from '@/features/profile/BodyView';
import { LiftsView } from '@/features/profile/LiftsView';
import { useGym } from '@/features/social/api';
import { useFinishedSessions } from '@/features/training/hooks';
import { useData } from '@/stores/data';
import { type } from '@/theme/tokens';

export default function Profile() {
  const profile = useData((s) => s.profile);
  const exercises = useData((s) => s.exercises);
  const sessions = useFinishedSessions();
  const gym = useGym(profile?.home_gym_id);
  const [tab, setTab] = useState<'body' | 'lifts'>('body');

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
      </Glass>
      <Segmented
        options={[
          { value: 'body', label: 'Body' },
          { value: 'lifts', label: 'Lifts' },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Profile sections"
      />
      {tab === 'body' ? (
        <BodyView />
      ) : (
        <LiftsView
          sessions={sessions}
          exercises={exercises}
          onPressExercise={(id) =>
            router.push({ pathname: '/profile/exercise/[id]', params: { id } })
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  name: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
});
