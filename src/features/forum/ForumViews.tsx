/** Forum pieces: a post card and the sheet that shares a finished workout. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { MessageCircle } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { LikeHeart } from '@/features/arena/MyGym';
import { timeAgo } from '@/lib/dates';
import { formatVolume } from '@/lib/formulas';
import { postSummary, snapshotOf } from '@/lib/forum';
import { muscleVector, workoutKind } from '@/lib/workoutType';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
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
        onError: () => toast('Could not share. Are you online?'),
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
});
