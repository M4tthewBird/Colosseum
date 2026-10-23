import { router } from 'expo-router';
import { Landmark, UserPlus } from '@/components/icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { ProgressRing } from '@/components/Charts';
import { GlassCard } from '@/components/Glass';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Wordmark } from '@/components/Logo';
import { Header, Screen } from '@/components/Screen';
import { BadgeSync } from '@/features/badges/BadgeSync';
import { useForumPosts } from '@/features/forum/api';
import { HomeGymPrompt } from '@/features/gyms/HomeGymPrompt';
import { AvatarPrompt } from '@/features/profile/AvatarPrompt';
import { FriendLinkResume } from '@/features/social/FriendLink';
import { ForumRail } from '@/features/forum/ForumViews';
import { useFriendsPrs, useLeaderboard } from '@/features/social/api';
import { useActiveProgram, useFinishedSessions } from '@/features/training/hooks';
import { InstallTip } from '@/features/onboarding/InstallTip';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { WhatsNew } from '@/features/onboarding/WhatsNew';
import { UpNextCard } from '@/features/training/UpNextCard';
import { timeAgo } from '@/lib/dates';
import { formatKg, formatVolume, weekStreak } from '@/lib/formulas';
import { weeklyTarget } from '@/lib/programs';
import { deloadAdvice } from '@/lib/progression';
import { weekStats } from '@/lib/stats';
import { useData } from '@/stores/data';
import { colors, type } from '@/theme/tokens';

export default function Today() {
  const profile = useData((s) => s.profile);
  const sessions = useFinishedSessions();
  const program = useActiveProgram();
  const target = weeklyTarget(program);
  const week = useMemo(() => weekStats(sessions), [sessions]);
  const streak = useMemo(
    () =>
      weekStreak(
        sessions.map((s) => new Date(s.started_at)),
        target,
      ),
    [sessions, target],
  );
  const deload = useMemo(() => deloadAdvice(sessions), [sessions]);
  const ranks = useLeaderboard('friends', 'volume', 'week');
  const myRank = ranks.data?.find((r) => r.user_id === profile?.id)?.rank;

  return (
    <Screen glow="right">
      <Header
        above={<Wordmark />}
        title="Today"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.navigate('/profile')}
          >
            <Avatar name={profile?.display_name ?? '?'} url={profile?.avatar_url} size={40} />
          </Pressable>
        }
      />

      <TourTarget id="today-week">
        <GlassCard style={styles.week} accessibilityLabel="This week">
          <ProgressRing value={week.workouts / target}>
            <Text style={styles.ringValue}>
              {week.workouts}/{target}
            </Text>
            <Text style={styles.ringLabel}>workouts</Text>
          </ProgressRing>
          <View style={styles.stats}>
            <Stat value={formatVolume(week.volumeKg)} label="Volume" />
            <Stat value={`${streak} wk`} label="Streak" />
            <Stat value={myRank ? `#${myRank}` : '—'} label="Arena rank" />
            <Stat value={String(week.prs)} label="New PRs" />
          </View>
        </GlassCard>
      </TourTarget>

      {deload ? (
        <GlassCard radius={22} style={{ gap: 6, padding: 16 }} accessibilityLabel="Deload hint">
          <Text style={type.bodyStrong}>Time for a lighter week?</Text>
          <Text style={type.caption}>
            Your last {deload.hard} workouts were hard (effort 9+ or you felt bad). A deload week
            helps you recover: keep the weights, do about half the sets and stop well short of
            failure.
          </Text>
        </GlassCard>
      ) : null}

      <UpNextCard variant="today" />

      <ForumSection />

      <FriendsPrs />
      <InstallTip />
      <WhatsNew />
      <HomeGymPrompt />
      <AvatarPrompt />
      <FriendLinkResume />
      <BadgeSync />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

/** The newest Forum posts as a swipeable rail; the full Forum is one tap away. */
function ForumSection() {
  const posts = useForumPosts('all', 6);
  const list = posts.data ?? [];
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.forumHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Landmark size={20} color={colors.accent} strokeWidth={2.2} />
            <Text style={type.section} accessibilityRole="header">
              Forum
            </Text>
          </View>
          <Text style={type.caption}>What your friends and gym are training</Text>
        </View>
        <TextButton label="See all" accent onPress={() => router.push('/forum')} />
      </View>
      {list.length > 0 ? (
        <ForumRail posts={list} />
      ) : (
        <GlassCard radius={22} style={{ gap: 12, padding: 16 }}>
          <Text style={type.caption}>
            {posts.isLoading
              ? 'Loading…'
              : posts.isError
                ? 'Could not load the Forum. Are you online?'
                : 'Nothing shared yet. Finish a workout and share it: friends and your gym can comment on it and copy it.'}
          </Text>
        </GlassCard>
      )}
    </View>
  );
}

function FriendsPrs() {
  const prs = useFriendsPrs();
  const list = prs.data ?? [];
  return (
    <View style={{ gap: 8 }}>
      <SectionHeader
        title="Friends' PRs"
        right={<TextButton label="Arena" onPress={() => router.navigate('/arena')} />}
      />
      {list.length > 0 ? (
        <ListGroup>
          {list.map((p, i) => (
            <ListRow
              key={`${p.user.id}-${i}`}
              height={62}
              chevron={false}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.user.id } })}
              left={<Avatar name={p.user.display_name} url={p.user.avatar_url} size={38} />}
              title={
                <Text style={type.bodyStrong} numberOfLines={1}>
                  {p.user.display_name}{' '}
                  <Text style={{ fontWeight: '400', color: colors.text2 }}>· {p.exercise}</Text>
                </Text>
              }
              subtitle={timeAgo(p.at)}
              right={
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={[type.bodyStrong, { fontWeight: '700' }]}>
                    {formatKg(p.weight)} kg{p.reps > 1 ? ` × ${p.reps}` : ''}
                  </Text>
                  <Text style={styles.newPr}>New PR</Text>
                </View>
              }
            />
          ))}
        </ListGroup>
      ) : (
        <GlassCard radius={22} style={{ gap: 12, padding: 16 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {prs.isLoading
              ? 'Loading…'
              : prs.isError
                ? 'Could not load. Are you online?'
                : 'Add friends to see their PRs'}
          </Text>
          {!prs.isLoading ? (
            <FillButton
              label="Add friends"
              icon={UserPlus}
              onPress={() => router.push('/arena/friends')}
            />
          ) : null}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  ringLabel: { fontSize: 10, fontWeight: '500', color: colors.text2 },
  stats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  stat: { width: '50%' },
  statValue: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  newPr: { fontSize: 11, fontWeight: '600', color: colors.accent },
  forumHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 4 },
});
