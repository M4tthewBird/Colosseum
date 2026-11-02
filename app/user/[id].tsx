/** Another user's profile: avatar, name, gym, Lifts and recent workouts. Never Body data. */
import { useLocalSearchParams } from 'expo-router';
import { Calendar, UserPlus } from '@/components/icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { ListGroup, SectionHeader } from '@/components/List';
import { Screen } from '@/components/Screen';
import { BadgeGrid } from '@/features/badges/BadgeViews';
import { useUserBadges } from '@/features/badges/hooks';
import { LiftsView } from '@/features/profile/LiftsView';
import { useFriendAction, useUserPage } from '@/features/social/api';
import { useTogetherCount } from '@/features/together/api';
import { PlanSheet } from '@/features/together/PlanViews';
import { SessionRow } from '@/features/training/SessionRow';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { type } from '@/theme/tokens';

export default function UserPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = useUserPage(id);
  const exercises = useData((s) => s.exercises);
  const action = useFriendAction();
  const badges = useUserBadges(id, page.data?.sessions);
  const together = useTogetherCount(id);
  const [inviting, setInviting] = useState(false);

  if (page.isLoading || !page.data) {
    return (
      <Screen tabs={false}>
        <BackLink label="Back" fallback="/arena" />
        <Text style={type.caption}>
          {page.isError ? 'Could not load this profile. Are you online?' : 'Loading…'}
        </Text>
      </Screen>
    );
  }

  const { user, gymName, relation, sessions } = page.data;
  const run = (a: 'request' | 'accept', msg: string) =>
    action.mutate(
      { action: a, user },
      {
        onSuccess: () => {
          toast(msg);
          void page.refetch();
        },
        onError: (e) => toast(e.message),
      },
    );

  return (
    <Screen tabs={false} gap={14}>
      <BackLink label="Back" fallback="/arena" />
      <Glass radius={22} style={styles.card}>
        <Avatar name={user.display_name} url={user.avatar_url} size={54} />
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {user.display_name}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            @{user.username}
            {gymName ? ` · ${gymName}` : ''}
          </Text>
        </View>
      </Glass>

      {relation === 'none' ? (
        <FillButton
          label="Add friend"
          icon={UserPlus}
          onPress={() => run('request', 'Request sent')}
        />
      ) : relation === 'incoming' ? (
        <FillButton
          label="Accept friend request"
          icon={UserPlus}
          onPress={() => run('accept', 'Friend added')}
        />
      ) : relation === 'outgoing' ? (
        <Text style={[type.caption, { textAlign: 'center' }]}>Friend request sent</Text>
      ) : relation === 'friend' ? (
        <FillButton label="Invite to train" icon={Calendar} onPress={() => setInviting(true)} />
      ) : null}
      {together.data ? (
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Trained together {together.data} {together.data === 1 ? 'time' : 'times'}
        </Text>
      ) : null}
      {inviting ? <PlanSheet visible friend={user} onClose={() => setInviting(false)} /> : null}

      {badges.length > 0 ? (
        <>
          <SectionHeader title={`Badges · ${badges.length}`} />
          <BadgeGrid badges={badges} progress={false} />
        </>
      ) : null}

      {sessions.length > 0 ? (
        <>
          <SectionHeader title="Lifts" />
          <LiftsView sessions={sessions} exercises={exercises} />
          <SectionHeader title="Recent workouts" />
          <ListGroup>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} session={s} exercises={exercises} onPress={null} />
            ))}
          </ListGroup>
        </>
      ) : (
        <Glass radius={22} style={{ padding: 16 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {relation === 'friend' || relation === 'self'
              ? 'No finished workouts yet.'
              : 'Workouts are visible to friends and members of the same gym.'}
          </Text>
        </Glass>
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
