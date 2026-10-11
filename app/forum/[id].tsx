/** One Forum post: the workout with every set, likes, comments, and Copy to my workouts. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { CopyPlus, Link, Send, Trash2 } from '@/components/icons';
import { SectionHeader, Separator } from '@/components/List';
import { Screen } from '@/components/Screen';
import {
  useAddForumComment,
  useDeletePost,
  useForumComments,
  useForumPost,
} from '@/features/forum/api';
import { copyForumWorkout } from '@/features/forum/copy';
import { PostCard } from '@/features/forum/ForumViews';
import { timeAgo } from '@/lib/dates';
import { formatKg } from '@/lib/formulas';
import type { ForumSet } from '@/lib/forum';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

/** "100 × 8, 100 × 6 F ↳ 80 × 5" */
function setsText(sets: ForumSet[]): string {
  return sets
    .map(
      (s) =>
        `${formatKg(s.kg)} × ${s.reps}${s.failure ? ' F' : ''}` +
        (s.drops ?? []).map((d) => ` ↳ ${formatKg(d.kg)} × ${d.reps}`).join(''),
    )
    .join(', ');
}

export default function ForumPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useForumPost(id);
  const comments = useForumComments(id);
  const add = useAddForumComment();
  const del = useDeletePost();
  const myId = useData((s) => s.userId);
  const [body, setBody] = useState('');

  if (!post.data) {
    return (
      <Screen tabs={false}>
        <BackLink label="Forum" fallback="/forum" />
        <Text style={type.caption}>
          {post.isLoading
            ? 'Loading…'
            : post.isError
              ? 'Could not load this post. Are you online?'
              : 'This post no longer exists.'}
        </Text>
      </Screen>
    );
  }
  const p = post.data;
  const w = p.workout;

  const send = () => {
    const text = body.trim();
    if (!text) return;
    add.mutate(
      { postId: p.id, body: text },
      { onSuccess: () => setBody(''), onError: () => toast('Could not send. Are you online?') },
    );
  };

  const copy = () => {
    copyForumWorkout(w, p.title);
    toast('Copied to Workouts · Saved workouts');
  };

  return (
    <Screen tabs={false} gap={14} glow="left">
      <BackLink label="Forum" fallback="/forum" />
      <PostCard post={p} lines={50} />

      <FillButton label="Copy to my workouts" icon={CopyPlus} onPress={copy} />

      <Glass radius={22} style={styles.card}>
        <Text style={type.captionStrong}>{w.name}</Text>
        {w.exercises.map((e, i) => {
          const linked = !!e.superset && w.exercises[i - 1]?.superset === e.superset;
          return (
            <View key={`${e.exercise_id}-${i}`}>
              {i > 0 && !linked ? <Separator /> : null}
              <View style={styles.exRow}>
                <View style={styles.exTitle}>
                  {e.superset ? <Link size={12} color={colors.accent} strokeWidth={2.6} /> : null}
                  <Text style={[type.bodyStrong, { flexShrink: 1 }]}>{e.name}</Text>
                </View>
                <Text style={[type.small, tabular]}>{setsText(e.sets)}</Text>
              </View>
            </View>
          );
        })}
        <Text style={type.small}>F = to failure · ↳ = drop set · linked = superset</Text>
      </Glass>

      <SectionHeader title="Comments" />
      {(comments.data ?? []).map((c) => (
        <View key={c.id} style={styles.comment}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.user.display_name}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: c.user.id } })}
          >
            <Avatar name={c.user.display_name} url={c.user.avatar_url} size={34} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.bodyStrong}>
              {c.user.display_name.split(' ')[0]}{' '}
              <Text style={type.small}>{timeAgo(c.created_at)}</Text>
            </Text>
            <Text style={type.body}>{c.body}</Text>
          </View>
        </View>
      ))}
      {comments.data?.length === 0 ? (
        <Text style={type.caption}>No comments yet. Ask how it went or share a tip.</Text>
      ) : null}
      <View style={styles.compose}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment"
          placeholderTextColor={colors.placeholder}
          maxLength={500}
          onSubmitEditing={send}
          accessibilityLabel="Add a comment"
          style={styles.composeInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={send}
          hitSlop={12}
          disabled={add.isPending}
        >
          <Send size={18} color={body.trim() ? colors.accent : colors.text3} />
        </Pressable>
      </View>

      {p.user.id === myId ? (
        <FillButton
          label="Delete post"
          icon={Trash2}
          onPress={async () => {
            const ok = await confirm({
              title: 'Delete this post?',
              message: 'Its comments are deleted too. Your workout stays in your history.',
              confirmLabel: 'Delete',
              destructive: true,
            });
            if (!ok) return;
            del.mutate(p.id, {
              onSuccess: () => router.replace('/forum'),
              onError: () => toast('Could not delete. Are you online?'),
            });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  exRow: { paddingVertical: 8, gap: 2 },
  exTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comment: { flexDirection: 'row', gap: 10 },
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  composeInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
});
