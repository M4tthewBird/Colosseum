import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { EmptyState } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Chip, Segmented } from '@/components/Segmented';
import { useForumPosts } from '@/features/forum/api';
import { PostCard } from '@/features/forum/ForumViews';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { useFriends } from '@/features/social/api';
import { WORKOUT_KINDS } from '@/lib/workoutType';
import { useData } from '@/stores/data';
import { type } from '@/theme/tokens';

/** The Forum: workouts shared by friends or by people of my home gym, newest first. */
export default function Forum() {
  const [scope, setScope] = useState<'friends' | 'gym'>('friends');
  const [kind, setKind] = useState<string | null>(null);
  const friends = useFriends();
  const hasGym = useData((s) => !!s.profile?.home_gym_id);
  const friendIds = (friends.data?.friends ?? []).map((f) => f.id);
  const posts = useForumPosts(scope, 50, friendIds, kind);
  const list = posts.data ?? [];
  const empty =
    scope === 'gym' && !hasGym
      ? { title: 'No home gym', text: 'Choose your home gym in Settings to see its Forum.' }
      : kind
        ? {
            title: `No ${kind === 'Full body' ? 'full body' : kind} workouts`,
            text: 'Try another kind.',
          }
        : scope === 'friends' && friendIds.length === 0
          ? { title: 'No friends yet', text: 'Add friends in the Arena to see what they share.' }
          : {
              title: 'Nothing shared yet',
              text: 'Finish a workout and tap Share on the Forum to post the first one.',
            };

  return (
    <Screen
      tabs={false}
      gap={14}
      glow="left"
      refreshing={posts.isRefetching}
      onRefresh={() => void posts.refetch()}
    >
      <BackLink label="Today" fallback="/" />
      <Header above="Shared workouts" title="Forum" />
      <Segmented
        options={[
          { value: 'friends', label: 'Friends' },
          { value: 'gym', label: 'My gym' },
        ]}
        value={scope}
        onChange={setScope}
        accessibilityLabel="Forum of"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ marginHorizontal: -20 }}
        accessibilityLabel="Kind of workout"
      >
        <View style={{ width: 12 }} />
        <Chip label="All" selected={!kind} onPress={() => setKind(null)} />
        {WORKOUT_KINDS.map((k) => (
          <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
        ))}
        <View style={{ width: 12 }} />
      </ScrollView>
      {posts.isLoading ? (
        <Text style={[type.caption, { textAlign: 'center', paddingVertical: 24 }]}>Loading…</Text>
      ) : posts.isError ? (
        <Text style={[type.caption, { textAlign: 'center', paddingVertical: 24 }]}>
          Could not load the Forum. Are you online?
        </Text>
      ) : list.length === 0 ? (
        <EmptyState title={empty.title} text={empty.text} />
      ) : (
        list.map((p, i) =>
          i === 0 ? (
            <TourTarget key={p.id} id="forum-post">
              <PostCard post={p} />
            </TourTarget>
          ) : (
            <PostCard key={p.id} post={p} />
          ),
        )
      )}
    </Screen>
  );
}
