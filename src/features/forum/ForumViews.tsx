/** Forum pieces: a post card and the sheet that shares a finished workout. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { ChevronRight, Heart, Landmark, MessageCircle } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { LikeHeart } from '@/features/arena/MyGym';
import { timeAgo } from '@/lib/dates';
import { isNetworkError } from '@/lib/errors';
import { formatVolume } from '@/lib/formulas';
import { postSummary, snapshotOf } from '@/lib/forum';
import { muscleVector, workoutKind } from '@/lib/workoutType';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';
import { useCreatePost, useToggleForumLike, type ForumPost } from './api';

export function PostCard({ post, lines = 3 }: { post: ForumPost; lines?: number }) {
  const like = useToggleForumLike();
  const w = post.workout;
  return (
    <Glass radius={22} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${post.title}, by ${post.user.display_name}`}
        onPress={() => router.push({ pathname: '/forum/[id]', params: { id: post.id } })}
        style={{ gap: 10 }}
      >
        <View style={styles.author}>
          <Avatar name={post.user.display_name} url={post.user.avatar_url} size={34} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={type.bodyStrong} numberOfLines={1}>
              {post.user.display_name}
            </Text>
            <Text style={type.small}>{timeAgo(post.created_at)}</Text>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          {post.body ? (
            <Text style={type.caption} numberOfLines={lines}>
              {post.body}
            </Text>
          ) : null}
        </View>
        <View style={styles.meta}>
          {w.kind ? <Tag text={w.kind} /> : null}
          <Text style={type.small}>
            {postSummary(w)} · {formatVolume(w.volume_kg)}
            {w.duration_min ? ` · ${w.duration_min} min` : ''}
          </Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.liked }}
          accessibilityLabel={`Like, ${post.likes}`}
          onPress={() => like.mutate({ postId: post.id, like: !post.liked })}
          style={styles.react}
        >
          <LikeHeart liked={post.liked} />
          <Text style={[styles.reactText, post.liked && { color: colors.accent }]}>
            {post.likes}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${post.comments}`}
          onPress={() => router.push({ pathname: '/forum/[id]', params: { id: post.id } })}
          style={styles.react}
        >
          <MessageCircle size={14} color={colors.text} strokeWidth={2} />
          <Text style={styles.reactText}>{post.comments}</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

export function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

/** Shares a finished workout on the Forum with a title and a few words. Needs a connection. */
export function ShareSheet({
  sessionId,
  visible,
  onClose,
}: {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const session = useData((s) => s.sessions[sessionId]);
  const exercises = useData((s) => s.exercises);
  const create = useCreatePost();
  const [title, setTitle] = useState(session?.name ?? '');
  const [body, setBody] = useState('');
  if (!session) return null;

  const post = () => {
    const kind = workoutKind(muscleVector(session.sets, (id) => exercises[id]?.muscles ?? []));
    const workout = snapshotOf(session, exercises, kind);
    create.mutate(
      { title: title.trim() || session.name, body: body.trim(), workout, sessionId },
      {
        onSuccess: (id) => {
          onClose();
          toast('Shared on the Forum');
          router.push({ pathname: '/forum/[id]', params: { id } });
        },
        onError: (e) =>
          toast(
            isNetworkError(e)
              ? 'Could not share. Are you online?'
              : `Could not share: ${e.message}`,
          ),
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Share on the Forum"
      doneLabel={create.isPending ? 'Sharing…' : 'Share'}
      doneDisabled={create.isPending}
      onDone={post}
    >
      <FormGroup>
        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          placeholder="e.g. Machine leg day"
        />
        <FormField
          label="Text"
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          placeholder="How it went, tips… (optional)"
        />
      </FormGroup>
      <FieldHint text="Your friends and people from your home gym can see the exercises, sets and weights, comment and copy the workout. How it felt and your body data stay private." />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.fill,
    justifyContent: 'center',
  },
  tagText: { fontSize: 11, fontWeight: '700', color: colors.text },
  react: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactText: { fontSize: 13, fontWeight: '600', color: colors.text },
  rail: { padding: 16, gap: 12, minHeight: 236 },
  railEnd: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  railEndIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  railStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  railTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  railList: { gap: 4, flex: 1 },
  railRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

/**
 * Today's Forum rail: the newest shared workouts as a swipeable row of tall cards, each with a
 * peek at its exercises, ending in a card that opens the whole Forum.
 */
export function ForumRail({ posts }: { posts: ForumPost[] }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 72, 292);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + 12}
      decelerationRate="fast"
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      accessibilityLabel="Latest on the Forum"
    >
      {posts.map((p) => (
        <RailCard key={p.id} post={p} width={cardW} />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the Forum"
        onPress={() => router.push('/forum')}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <Glass radius={24} style={[styles.rail, styles.railEnd, { width: Math.min(cardW, 200) }]}>
          <View style={styles.railEndIcon}>
            <Landmark size={24} color={colors.accent} strokeWidth={2} />
          </View>
          <Text style={[type.bodyStrong, { textAlign: 'center' }]}>Open the Forum</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Filter by Push, Legs, Upper and more
          </Text>
          <ChevronRight size={18} color={colors.accent} strokeWidth={2.6} />
        </Glass>
      </Pressable>
    </ScrollView>
  );
}

function RailCard({ post, width }: { post: ForumPost; width: number }) {
  const w = post.workout;
  const shown = w.exercises.slice(0, 3);
  const more = w.exercises.length - shown.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.title}, ${w.kind ?? 'workout'} by ${post.user.display_name}`}
      onPress={() => router.push({ pathname: '/forum/[id]', params: { id: post.id } })}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Glass radius={24} style={[styles.rail, { width }]}>
        <View style={styles.railTop}>
          {w.kind ? <Tag text={w.kind} /> : <View />}
          <View style={styles.railStat}>
            <Heart
              size={13}
              color={post.liked ? colors.accent : colors.text2}
              fill={post.liked ? colors.accent : 'none'}
              strokeWidth={2.2}
            />
            <Text style={type.small}>{post.likes}</Text>
            <MessageCircle size={13} color={colors.text2} strokeWidth={2.2} />
            <Text style={type.small}>{post.comments}</Text>
          </View>
        </View>
        <Text style={styles.railTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.railList}>
          {shown.map((e, i) => (
            <View key={`${e.exercise_id}-${i}`} style={styles.railRow}>
              <Text style={[type.caption, { flex: 1, color: colors.text }]} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={[type.caption, tabular]}>
                {e.sets.length} × {Math.max(...e.sets.map((s) => s.reps))}
              </Text>
            </View>
          ))}
          {more > 0 ? <Text style={type.small}>+ {more} more</Text> : null}
        </View>
        <View style={styles.railAuthor}>
          <Avatar name={post.user.display_name} url={post.user.avatar_url} size={26} />
          <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{post.user.display_name}</Text>{' '}
            · {timeAgo(post.created_at)} · {formatVolume(w.volume_kg)}
          </Text>
        </View>
      </Glass>
    </Pressable>
  );
}
