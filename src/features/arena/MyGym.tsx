import { router } from 'expo-router';
import { Heart, MapPin, MessageCircle, Plus, Send, X } from '@/components/icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { FieldHint, FormField, FormGroup, StepperRow } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { EmptyState, ListGroup, ListRow } from '@/components/List';
import { Chip, Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { GymPicker } from '@/features/gyms/GymPicker';
import {
  createGym,
  useAddComment,
  useCancelChallenge,
  useChallenge,
  useComments,
  useCreateChallenge,
  useFeed,
  useToggleLike,
  useTrainingNow,
  useUpdateChallenge,
  type Challenge,
  type FeedItem,
  type NewChallenge,
} from '@/features/social/api';
import { CURATED_EXERCISES } from '@/data/curated';
import { challengeExercisesText, challengeVariants } from '@/lib/challenge';
import { fromLocalDate, formatDuration, startOfDay, timeAgo } from '@/lib/dates';
import { formatVolume, parseNumber } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { dur, ease, easeIn, useReducedMotion } from '@/theme/motion';
import { colors, type } from '@/theme/tokens';

export function MyGym({ gymId }: { gymId: string | null }) {
  const profile = useData((s) => s.profile)!;
  const saveProfile = useData((s) => s.saveProfile);
  const [picker, setPicker] = useState(false);

  if (!gymId) {
    return (
      <>
        <EmptyState
          title="Choose your home gym"
          text="See who is training now, join gym challenges and follow the feed."
          action={<FillButton label="Choose gym" icon={MapPin} onPress={() => setPicker(true)} />}
        />
        <FeedList />
        <GymPicker
          visible={picker}
          onClose={() => setPicker(false)}
          onPick={async (g) => {
            try {
              const gym = 'id' in g ? g : await createGym(g.name, g.city);
              saveProfile({ ...profile, home_gym_id: gym.id });
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not save the gym');
            }
          }}
        />
      </>
    );
  }
  return (
    <>
      <TrainingNow gymId={gymId} />
      <ChallengeCard gymId={gymId} />
      <FeedList />
    </>
  );
}

function TrainingNow({ gymId }: { gymId: string }) {
  const now = useTrainingNow(gymId);
  const list = now.data ?? [];
  const shown = list.slice(0, 3);
  const more = list.length - shown.length;
  return (
    <Glass radius={22} style={styles.now}>
      <View style={styles.nowLeft}>
        <View style={styles.dot} />
        <Text style={type.bodyStrong}>{now.isLoading ? '…' : `${list.length} training now`}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((u, i) => (
          <Avatar
            key={u.id}
            name={u.display_name}
            url={u.avatar_url}
            size={30}
            ring={{ width: 2, color: '#fff' }}
            style={i > 0 ? { marginLeft: -8 } : undefined}
          />
        ))}
        {more > 0 ? (
          <View style={styles.more}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text2 }}>+{more}</Text>
          </View>
        ) : null}
      </View>
    </Glass>
  );
}

function ChallengeCard({ gymId }: { gymId: string }) {
  const exercises = useData((s) => s.exercises);
  const c = useChallenge(gymId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  if (c.isLoading) return null;
  if (!c.data) {
    return (
      <>
        <FillButton label="Start a gym challenge" icon={Plus} onPress={() => setCreating(true)} />
        <NewChallengeSheet gymId={gymId} visible={creating} onClose={() => setCreating(false)} />
      </>
    );
  }
  const ch = c.data;
  const daysLeft = Math.max(
    0,
    Math.round((fromLocalDate(ch.ends_on).getTime() - startOfDay(new Date()).getTime()) / 86400000),
  );
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  return (
    <Glass radius={22} style={{ padding: 16, gap: 10 }}>
      <View style={styles.between}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={type.captionStrong}>Gym challenge</Text>
          <Text style={[type.bodyStrong, { fontSize: 17, fontWeight: '700' }]}>{ch.title}</Text>
        </View>
        <Text style={type.caption}>
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left
        </Text>
      </View>
      {ch.exerciseIds.length ? (
        <Text style={type.small}>
          Counts:{' '}
          {challengeExercisesText(ch.exerciseIds.map((id) => exercises[id]?.name ?? 'Exercise'))}
        </Text>
      ) : null}
      <ProgressBar value={ch.target ? ch.gymTotal / ch.target : 0} />
      <View style={styles.between}>
        <Text style={type.caption}>
          Gym{' '}
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {fmt(ch.gymTotal)} / {fmt(ch.target)}
          </Text>
        </Text>
        <Text style={type.caption}>
          You <Text style={{ color: colors.text, fontWeight: '600' }}>{fmt(ch.myTotal)}</Text>
        </Text>
      </View>
      {ch.mine ? (
        <TextButton
          label="Edit or cancel"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => setEditing(true)}
        />
      ) : null}
      {editing ? (
        <EditChallengeSheet challenge={ch} daysLeft={daysLeft} onClose={() => setEditing(false)} />
      ) : null}
    </Glass>
  );
}

/** The exercises whose repetitions count, with well-known variations to add in one tap. */
function ChallengeExercises({
  ids,
  onChange,
  onAdd,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  onAdd: () => void;
}) {
  const exercises = useData((s) => s.exercises);
  const chosen = ids.flatMap((id) => exercises[id] ?? []);
  const variants = challengeVariants(chosen, Object.values(exercises), CURATED_EXERCISES);
  return (
    <View style={{ gap: 10 }}>
      {chosen.length ? (
        <ListGroup>
          {chosen.map((e) => (
            <ListRow
              key={e.id}
              height={48}
              title={e.name}
              chevron={false}
              rightInteractive
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${e.name}`}
                  hitSlop={10}
                  onPress={() => onChange(ids.filter((id) => id !== e.id))}
                >
                  <X size={18} color={colors.text2} />
                </Pressable>
              }
            />
          ))}
        </ListGroup>
      ) : null}
      <FillButton
        label={chosen.length ? 'Add another exercise' : 'Choose exercise'}
        icon={Plus}
        onPress={onAdd}
      />
      {variants.length ? (
        <View style={{ gap: 6 }}>
          <Text style={[type.small, { paddingHorizontal: 4 }]}>Count these too?</Text>
          <View style={styles.chips}>
            {variants.map((e) => (
              <Chip key={e.id} label={`+ ${e.name}`} onPress={() => onChange([...ids, e.id])} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function EditChallengeSheet({
  challenge,
  daysLeft,
  onClose,
}: {
  challenge: Challenge;
  daysLeft: number;
  onClose: () => void;
}) {
  const update = useUpdateChallenge();
  const cancel = useCancelChallenge();
  const [title, setTitle] = useState(challenge.title);
  const [target, setTarget] = useState(String(challenge.target));
  const [days, setDays] = useState(Math.max(1, daysLeft));
  const t = parseNumber(target);
  const ok = title.trim().length > 2 && t != null && t > 0;
  const busy = update.isPending || cancel.isPending;

  // The question opens on its own: a sheet would cover it.
  const [asking, setAsking] = useState(false);
  const askCancel = async () => {
    setAsking(true);
    const yes = await confirm({
      title: 'Cancel this challenge?',
      message: 'It ends for everyone in your gym, and its progress goes away.',
      confirmLabel: 'Cancel challenge',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!yes) {
      setAsking(false);
      return;
    }
    cancel.mutate(challenge.id, {
      onSuccess: () => {
        toast('Challenge cancelled');
        onClose();
      },
      onError: (e) => {
        setAsking(false);
        toast(e.message);
      },
    });
  };

  return (
    <Sheet
      visible={!asking}
      onClose={onClose}
      title="Edit challenge"
      doneLabel="Save"
      doneDisabled={!ok || busy}
      onDone={() =>
        update.mutate(
          { id: challenge.id, changes: { title: title.trim(), target: t!, daysLeft: days } },
          {
            onSuccess: () => {
              toast('Challenge updated');
              onClose();
            },
            onError: (e) => toast(e.message),
          },
        )
      }
    >
      <FormGroup>
        <FormField label="Title" value={title} onChangeText={setTitle} />
        <FormField
          label="Target"
          value={target}
          onChangeText={setTarget}
          keyboardType="number-pad"
        />
        <StepperRow
          label="Days left"
          value={days}
          min={1}
          max={90}
          onChange={setDays}
          format={(d) => `${d} day${d === 1 ? '' : 's'}`}
        />
      </FormGroup>
      <FieldHint text="What it measures stays the same, so everyone's progress keeps counting." />
      <TextButton
        label="Cancel challenge"
        accent
        style={{ alignSelf: 'center', marginBottom: 8 }}
        disabled={busy}
        onPress={() => void askCancel()}
      />
    </Sheet>
  );
}

function NewChallengeSheet({
  gymId,
  visible,
  onClose,
}: {
  gymId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const create = useCreateChallenge();
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<NewChallenge['metric']>('reps');
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [days, setDays] = useState(30);
  const [picking, setPicking] = useState(false);
  const t = parseNumber(target);
  const ok =
    title.trim().length > 2 && t != null && t > 0 && (metric !== 'reps' || exerciseIds.length > 0);
  return (
    <>
      <Sheet
        visible={visible && !picking}
        onClose={onClose}
        title="New challenge"
        doneLabel="Create"
        doneDisabled={!ok || create.isPending}
        onDone={() =>
          create.mutate(
            {
              gymId,
              c: {
                title: title.trim(),
                metric,
                exercise_ids: metric === 'reps' ? exerciseIds : [],
                target: t!,
                days,
              },
            },
            {
              onSuccess: () => {
                toast('Challenge started');
                onClose();
              },
              onError: (e) => toast(e.message),
            },
          )
        }
      >
        <FormGroup>
          <FormField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="10,000 pull-ups together"
          />
          <FormField
            label="Target"
            value={target}
            onChangeText={setTarget}
            placeholder="10000"
            keyboardType="number-pad"
          />
          <StepperRow
            label="Duration"
            value={days}
            min={1}
            max={90}
            onChange={setDays}
            format={(d) => `${d} days`}
          />
        </FormGroup>
        <Segmented
          options={[
            { value: 'reps', label: 'Reps' },
            { value: 'volume', label: 'Volume (kg)' },
            { value: 'workouts', label: 'Workouts' },
          ]}
          value={metric}
          onChange={setMetric}
        />
        {metric === 'reps' ? (
          <ChallengeExercises
            ids={exerciseIds}
            onChange={setExerciseIds}
            onAdd={() => setPicking(true)}
          />
        ) : null}
        <FieldHint
          text={
            metric === 'reps'
              ? 'Repetitions of these exercises count, for everyone in your home gym.'
              : 'Everyone in your home gym counts towards the target.'
          }
        />
      </Sheet>
      <ExercisePicker
        visible={visible && picking}
        onClose={() => setPicking(false)}
        onPick={(id) => setExerciseIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
      />
    </>
  );
}

function FeedList() {
  const feed = useFeed();
  const [comments, setComments] = useState<string | null>(null);
  if (feed.isLoading) return <Text style={[type.caption, { textAlign: 'center' }]}>Loading…</Text>;
  if (feed.isError) {
    return (
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Could not load the feed. Are you online?
      </Text>
    );
  }
  const items = feed.data ?? [];
  if (items.length === 0) {
    return (
      <Text style={[type.caption, { textAlign: 'center', paddingVertical: 8 }]}>
        Finished workouts of your gym and friends show up here.
      </Text>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((p) => (
        <FeedCard key={p.id} item={p} onComments={() => setComments(p.id)} />
      ))}
      <CommentsSheet sessionId={comments} onClose={() => setComments(null)} />
    </View>
  );
}

function FeedCard({ item, onComments }: { item: FeedItem; onComments: () => void }) {
  const like = useToggleLike();
  const dur = formatDuration(
    new Date(item.finished_at).getTime() - new Date(item.started_at).getTime(),
  );
  return (
    <Glass radius={22} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.user.id } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Avatar name={item.user.display_name} url={item.user.avatar_url} size={36} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            {item.user.display_name}{' '}
            <Text style={{ fontWeight: '400', color: colors.text2 }}>finished {item.name}</Text>
          </Text>
          <Text style={type.small}>{timeAgo(item.finished_at)}</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <Text style={[type.caption, { color: colors.text, fontWeight: '600' }]}>{dur}</Text>
        <Text style={type.caption}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {formatVolume(item.volume_kg)}
          </Text>{' '}
          volume
        </Text>
        <Text style={type.caption}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{item.pr_count}</Text> PR
          {item.pr_count === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: item.liked }}
          accessibilityLabel={`Like, ${item.likes}`}
          onPress={() => like.mutate({ sessionId: item.id, like: !item.liked })}
          style={styles.react}
        >
          <LikeHeart liked={item.liked} />
          <Text style={[styles.reactText, item.liked && { color: colors.accent }]}>
            {item.likes}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${item.comments}`}
          onPress={onComments}
          style={styles.react}
        >
          <MessageCircle size={14} color={colors.text} strokeWidth={2} />
          <Text style={styles.reactText}>{item.comments}</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

function CommentsSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const comments = useComments(sessionId);
  const add = useAddComment();
  const [body, setBody] = useState('');
  const send = () => {
    const text = body.trim();
    if (!text || !sessionId) return;
    add.mutate(
      { sessionId, body: text },
      { onSuccess: () => setBody(''), onError: (e) => toast(e.message) },
    );
  };
  return (
    <Sheet visible={!!sessionId} onClose={onClose} title="Comments">
      {(comments.data ?? []).map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
          <Avatar name={c.user.display_name} url={c.user.avatar_url} size={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.bodyStrong}>
              {c.user.display_name} <Text style={type.small}>{timeAgo(c.created_at)}</Text>
            </Text>
            <Text style={type.body}>{c.body}</Text>
          </View>
        </View>
      ))}
      {comments.data?.length === 0 ? <Text style={type.caption}>No comments yet.</Text> : null}
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
        <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} hitSlop={8}>
          <Send size={18} color={body.trim() ? colors.accent : colors.text3} />
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  now: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  more: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
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
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.fill,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  composeInput: {
    flex: 1,
    height: 42,
    fontSize: 16,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
});

/** The like heart gives a quick squeeze-and-swell when you like a workout. */
export function LikeHeart({ liked }: { liked: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const was = useRef(liked);
  useEffect(() => {
    if (liked && !was.current && !reduced) {
      scale.value = withSequence(
        withTiming(0.7, { duration: dur.tap - 40, easing: easeIn }),
        withTiming(1.25, { duration: dur.tap + 20, easing: ease }),
        withTiming(1, { duration: dur.state, easing: ease }),
      );
    }
    was.current = liked;
  }, [liked, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Heart
        size={14}
        color={liked ? colors.accent : colors.text}
        fill={liked ? colors.accent : 'none'}
        strokeWidth={2}
      />
    </Animated.View>
  );
}
