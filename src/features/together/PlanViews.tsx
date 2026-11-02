/** "Going to train": the plan cards, the section that lists them and the sheet that posts one. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { Calendar, Check } from '@/components/icons';
import { SectionHeader } from '@/components/List';
import { Chip, Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { NewTag } from '@/features/onboarding/NewTag';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { useFriends, useGym } from '@/features/social/api';
import { isNetworkError } from '@/lib/errors';
import { defaultPlan, goingText, planDate, whenLabel, type PlanDay } from '@/lib/together';
import type { PublicUser } from '@/lib/types';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { confirm, toast } from '@/stores/ui';
import { accentA, colors, type } from '@/theme/tokens';
import {
  useAnswerPlan,
  useCreatePlan,
  useDeletePlan,
  useTrainingPlans,
  type TrainingPlan,
} from './api';

const NOTE_MAX = 140;

const failed = (e: unknown) =>
  toast(isNetworkError(e) ? 'Could not save it. Are you online?' : 'Could not save it. Try again.');

export function PlanCard({ plan }: { plan: TrainingPlan }) {
  const myId = useData((s) => s.userId);
  const answer = useAnswerPlan();
  const remove = useDeletePlan();
  const mine = plan.user.id === myId;
  const invitedMe = plan.inviteeId === myId;
  const waiting = invitedMe && plan.myAnswer === null;
  const where = plan.gymName ? ` · ${plan.gymName}` : '';
  const send = (going: boolean | null) =>
    answer.mutate({ planId: plan.id, going }, { onError: failed });
  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this plan?',
      message: plan.going.length ? 'People who said they are in will no longer see it.' : undefined,
      confirmLabel: 'Cancel plan',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (ok) remove.mutate(plan.id, { onError: failed });
  };
  const going = goingText(plan.going.map((u) => (u.id === myId ? 'You' : u.display_name)));

  return (
    <Glass radius={22} style={styles.card}>
      <Pressable
        accessibilityRole={mine ? undefined : 'button'}
        disabled={mine}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: plan.user.id } })}
        style={styles.head}
      >
        <Avatar name={plan.user.display_name} url={plan.user.avatar_url} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            {mine ? 'You' : plan.user.display_name}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {whenLabel(plan.planned_at)}
            {where}
          </Text>
        </View>
        {invitedMe ? <Text style={styles.tag}>Invited you</Text> : null}
      </Pressable>
      {mine && plan.invitee ? (
        <Text style={type.small}>You invited {plan.invitee.display_name}</Text>
      ) : null}
      {plan.note ? <Text style={type.body}>{plan.note}</Text> : null}
      {going ? <Text style={type.small}>{going}</Text> : null}
      {mine ? (
        <TextButton
          label="Cancel plan"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => void cancel()}
        />
      ) : plan.myAnswer === true ? (
        <FillButton
          label="You're in"
          icon={Check}
          size="sm"
          accessibilityState={{ selected: true }}
          accessibilityHint="Tap to take it back"
          onPress={() => send(null)}
        />
      ) : (
        <View style={styles.actions}>
          <FillButton
            label="I'm in"
            icon={Check}
            size="sm"
            style={{ flex: 1 }}
            onPress={() => send(true)}
          />
          {waiting ? (
            <FillButton label="Can't" size="sm" style={{ flex: 1 }} onPress={() => send(false)} />
          ) : null}
        </View>
      )}
    </Glass>
  );
}

/**
 * The plans people I know posted. `limit` shows only the first few and hides the whole section when
 * there are none (Today); without it, the section is always there with its Going to train button.
 */
export function PlansSection({ limit }: { limit?: number }) {
  const plans = useTrainingPlans();
  const [posting, setPosting] = useState(false);
  const newPlans = usePrefs((s) => !s.newSeen.includes('train-together'));
  const markNewSeen = usePrefs((s) => s.markNewSeen);
  const list = plans.data ?? [];
  if (limit && list.length === 0) return null;
  const shown = limit ? list.slice(0, limit) : list;
  return (
    <View style={{ gap: 10 }}>
      <SectionHeader
        title="Training soon"
        right={
          limit ? (
            <TextButton label="See all" accent onPress={() => router.push('/forum')} />
          ) : undefined
        }
      />
      {shown.map((p) => (
        <PlanCard key={p.id} plan={p} />
      ))}
      {limit ? null : (
        <TourTarget id="forum-plans">
          <FillButton
            label="Going to train"
            icon={Calendar}
            onPress={() => {
              markNewSeen('train-together');
              setPosting(true);
            }}
          />
          {newPlans ? <NewTag style={styles.newTag} /> : null}
        </TourTarget>
      )}
      {posting ? <PlanSheet visible onClose={() => setPosting(false)} /> : null}
    </View>
  );
}

/** Posts a plan to friends and the gym, or invites one friend (`friend` starts on that friend). */
export function PlanSheet({
  visible,
  onClose,
  friend,
}: {
  visible: boolean;
  onClose: () => void;
  friend?: PublicUser;
}) {
  const homeGymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(homeGymId);
  const friends = useFriends();
  const create = useCreatePlan();
  const [start] = useState(() => defaultPlan());
  const [day, setDay] = useState<PlanDay>(start.day);
  const [time, setTime] = useState(start.time);
  const [who, setWho] = useState<'open' | 'friend'>(friend ? 'friend' : 'open');
  const [invitee, setInvitee] = useState<PublicUser | null>(friend ?? null);
  const [note, setNote] = useState('');

  const when = planDate(day, time);
  const list = friends.data?.friends ?? [];
  const ready = !!when && (who === 'open' || !!invitee) && !create.isPending;
  const gymName = gym.data?.gym?.name ?? null;

  const post = () => {
    if (!when) return;
    create.mutate(
      {
        planned_at: when.toISOString(),
        gym_id: homeGymId,
        gymName,
        note: note.trim(),
        invitee: who === 'friend' ? invitee : null,
      },
      {
        onSuccess: () => {
          toast(who === 'friend' && invitee ? `Invite sent to ${invitee.display_name}` : 'Posted');
          onClose();
        },
        onError: failed,
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={who === 'friend' ? 'Invite to train' : 'Going to train'}
      doneLabel={who === 'friend' ? 'Invite' : 'Post'}
      doneDisabled={!ready}
      onDone={post}
    >
      <Segmented
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
        ]}
        value={day}
        onChange={setDay}
        accessibilityLabel="Day"
      />
      <FormGroup>
        <FormField
          label="Time"
          value={time}
          onChangeText={setTime}
          placeholder="17:30"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <FormField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Legs, need a spotter"
          maxLength={NOTE_MAX}
        />
      </FormGroup>
      {!when && time.trim() ? (
        <FieldHint text="Enter a time still ahead, like 17:30." error />
      ) : null}
      <Text style={[type.small, { paddingHorizontal: 4 }]}>
        {gymName ? `At ${gymName}, your home gym.` : 'No home gym set, so no place is shown.'}
      </Text>
      <Segmented
        options={[
          { value: 'open', label: 'Friends and gym' },
          { value: 'friend', label: 'One friend' },
        ]}
        value={who}
        onChange={setWho}
        accessibilityLabel="Who sees it"
      />
      {who === 'friend' ? (
        list.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {list.map((f) => (
              <Chip
                key={f.id}
                label={f.display_name}
                selected={invitee?.id === f.id}
                onPress={() => setInvitee(f)}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={[type.small, { paddingHorizontal: 4 }]}>
            Add friends in the Arena to invite them.
          </Text>
        )
      ) : (
        <Text style={[type.small, { paddingHorizontal: 4 }]}>
          Your friends and people from your home gym see it here and on Today.
        </Text>
      )}
      <View style={{ height: 12 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  newTag: { position: 'absolute', right: 14, top: 18, pointerEvents: 'none' },
  card: { padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: accentA(0.1),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
