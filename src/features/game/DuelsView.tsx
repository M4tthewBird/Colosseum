/**
 * City → Colosseum → Duels: a 7-day challenge with a friend, most workouts or most kg added to a lift. The
 * winner gets laurels for the season.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Check, Swords, X } from '@/components/icons';
import { EmptyState, ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useFriends } from '@/features/social/api';
import { LAURELS } from '@/lib/game/config';
import type { DuelKind } from '@/lib/game/battles';
import { timeLeftText } from '@/lib/game/fortress';
import { formatKg } from '@/lib/formulas';
import type { PublicUser } from '@/lib/types';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';
import { useAnswerDuel, useCreateDuel, useDuels, useWithdrawDuel, type Duel } from './api';

const what = (d: Pick<Duel, 'kind' | 'exerciseName'>) =>
  d.kind === 'workouts' ? 'Most workouts' : `Most kg added · ${d.exerciseName ?? 'a lift'}`;

const scoreText = (d: Duel, v: number | null) =>
  v == null ? '—' : d.kind === 'workouts' ? String(v) : `+${formatKg(v)} kg`;

export function DuelsView() {
  const duels = useDuels();
  const [open, setOpen] = useState(false);
  const list = duels.data ?? [];
  const waiting = list.filter((d) => d.status === 'pending' && !d.mine);
  const running = list.filter((d) => d.status === 'active');
  const sent = list.filter((d) => d.status === 'pending' && d.mine);
  const done = list.filter((d) => d.status === 'done');

  return (
    <View style={{ gap: 16 }}>
      <FillButton label="Challenge a friend" icon={Swords} onPress={() => setOpen(true)} />
      {waiting.map((d) => (
        <Invite key={d.id} duel={d} />
      ))}
      {running.length ? <SectionHeader title="This week" /> : null}
      {running.map((d) => (
        <RunningDuel key={d.id} duel={d} />
      ))}
      {sent.length ? (
        <>
          <SectionHeader title="Waiting for an answer" />
          <ListGroup>
            {sent.map((d) => (
              <Sent key={d.id} duel={d} />
            ))}
          </ListGroup>
        </>
      ) : null}
      {!running.length && !waiting.length && !sent.length ? (
        <EmptyState
          title={duels.isLoading ? 'Loading…' : duels.isError ? 'Could not load' : 'No duels yet'}
          text={
            duels.isError
              ? 'Are you online?'
              : `Challenge a friend for a week: who trains more, or who adds more to a lift. The winner gets ${LAURELS.duelWin} laurels.`
          }
        />
      ) : null}
      {done.length ? (
        <>
          <SectionHeader title="Finished" />
          <ListGroup>
            {done.slice(0, 10).map((d) => (
              <Finished key={d.id} duel={d} />
            ))}
          </ListGroup>
        </>
      ) : null}
      {open ? <ChallengeSheet onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

function other(d: Duel): PublicUser {
  return d.mine ? d.opponent : d.challenger;
}

function Invite({ duel }: { duel: Duel }) {
  const answer = useAnswerDuel();
  const u = other(duel);
  return (
    <GlassCard radius={22} style={{ gap: 12, padding: 16 }}>
      <View style={styles.row}>
        <Avatar name={u.display_name} url={u.avatar_url} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            {u.display_name} challenges you
          </Text>
          <Text style={type.small}>{what(duel)} · 7 days from now</Text>
        </View>
      </View>
      <View style={styles.row}>
        <FillButton
          size="sm"
          label="Accept"
          icon={Check}
          style={{ flex: 1 }}
          disabled={answer.isPending}
          onPress={() =>
            answer.mutate(
              { id: duel.id, accept: true },
              {
                onSuccess: () => toast('Duel on! 7 days.', true),
                onError: (e) => toast(e.message),
              },
            )
          }
        />
        <FillButton
          size="sm"
          label="Not now"
          icon={X}
          style={{ flex: 1 }}
          disabled={answer.isPending}
          onPress={() =>
            answer.mutate({ id: duel.id, accept: false }, { onError: (e) => toast(e.message) })
          }
        />
      </View>
    </GlassCard>
  );
}

function RunningDuel({ duel }: { duel: Duel }) {
  const u = other(duel);
  const myScore = (duel.mine ? duel.challenger_score : duel.opponent_score) ?? 0;
  const theirs = (duel.mine ? duel.opponent_score : duel.challenger_score) ?? 0;
  const total = myScore + theirs || 1;
  return (
    <GlassCard
      radius={22}
      style={{ gap: 12, padding: 16 }}
      accessibilityLabel={`Duel with ${u.display_name}`}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong}>{what(duel)}</Text>
          <Text style={[type.small, tabular]}>
            Ends in {duel.ends_at ? timeLeftText(duel.ends_at) : '—'}
          </Text>
        </View>
        <Text style={[styles.state, myScore > theirs && { color: colors.accent }]}>
          {myScore > theirs ? 'Leading' : myScore === theirs ? 'Even' : 'Behind'}
        </Text>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.small}>You</Text>
          <Text style={[styles.score, tabular]}>{scoreText(duel, myScore)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
          <Text style={type.small} numberOfLines={1}>
            {u.display_name}
          </Text>
          <Text style={[styles.score, tabular, { color: colors.text2 }]}>
            {scoreText(duel, theirs)}
          </Text>
        </View>
      </View>
      <View style={styles.tug}>
        <View style={{ flex: myScore / total || 0.0001, backgroundColor: colors.accent }} />
        <View style={{ flex: theirs / total || 0.0001 }} />
      </View>
    </GlassCard>
  );
}

function Sent({ duel }: { duel: Duel }) {
  const withdraw = useWithdrawDuel();
  const u = other(duel);
  return (
    <ListRow
      height={58}
      chevron={false}
      left={<Avatar name={u.display_name} url={u.avatar_url} size={36} />}
      title={u.display_name}
      subtitle={what(duel)}
      rightInteractive
      right={
        <TextButton
          label="Withdraw"
          onPress={() => withdraw.mutate(duel.id, { onError: (e) => toast(e.message) })}
        />
      }
    />
  );
}

function Finished({ duel }: { duel: Duel }) {
  const myId = useData((s) => s.userId);
  const u = other(duel);
  const won = duel.winner_id === myId;
  const tie = !duel.winner_id;
  const mine = duel.mine ? duel.challenger_score : duel.opponent_score;
  const theirs = duel.mine ? duel.opponent_score : duel.challenger_score;
  return (
    <ListRow
      height={58}
      chevron={false}
      left={<Avatar name={u.display_name} url={u.avatar_url} size={36} />}
      title={`${tie ? 'Tie with' : won ? 'Beat' : 'Lost to'} ${u.display_name}`}
      subtitle={`${what(duel)}${won ? ` · +${LAURELS.duelWin} laurels` : ''}`}
      right={
        <Text style={[type.bodyStrong, tabular, won && { color: colors.accent }]}>
          {scoreText(duel, mine)} : {scoreText(duel, theirs)}
        </Text>
      }
    />
  );
}

function ChallengeSheet({ onClose }: { onClose: () => void }) {
  const friends = useFriends().data?.friends ?? [];
  const create = useCreateDuel();
  const exercises = useData((s) => s.exercises);
  const [kind, setKind] = useState<DuelKind>('workouts');
  const [lift, setLift] = useState<string | null>(
    () => Object.values(exercises).find((e) => e.name === 'Bench Press')?.id ?? null,
  );
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState<PublicUser | null>(null);
  const liftName = lift ? (exercises[lift]?.name ?? 'Exercise') : null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title="New duel"
      doneLabel="Challenge"
      doneDisabled={!who || (kind === 'lift' && !lift) || create.isPending}
      onDone={() =>
        who &&
        create.mutate(
          {
            opponent: who,
            kind,
            exerciseId: kind === 'lift' ? lift : null,
            exerciseName: kind === 'lift' ? liftName : null,
          },
          {
            onSuccess: () => (toast(`Challenge sent to ${who.display_name}`, true), onClose()),
            onError: (e) => toast(e.message),
          },
        )
      }
    >
      <Segmented
        options={[
          { value: 'workouts', label: 'Most workouts' },
          { value: 'lift', label: 'Most kg added' },
        ]}
        value={kind}
        onChange={setKind}
        accessibilityLabel="What counts"
      />
      {kind === 'lift' ? (
        <ListGroup>
          <ListRow
            height={50}
            title="Lift"
            onPress={() => setPicking(true)}
            right={<Text style={type.caption}>{liftName ?? 'Choose'}</Text>}
          />
        </ListGroup>
      ) : null}
      <Text style={type.small}>
        {kind === 'workouts'
          ? 'Who finishes more workouts in 7 days (3 sets or more).'
          : 'Who adds more kg to their best estimated 1RM in 7 days.'}{' '}
        The winner gets {LAURELS.duelWin} laurels.
      </Text>
      {friends.length ? (
        <ListGroup>
          {friends.map((f) => (
            <ListRow
              key={f.id}
              height={54}
              chevron={false}
              onPress={() => setWho(f)}
              left={<Avatar name={f.display_name} url={f.avatar_url} size={34} />}
              title={f.display_name}
              right={
                who?.id === f.id ? (
                  <Check size={18} color={colors.accent} strokeWidth={2.6} />
                ) : null
              }
            />
          ))}
        </ListGroup>
      ) : (
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Add friends first: Arena → Friends.
        </Text>
      )}
      {picking ? (
        <ExercisePicker
          visible
          title="Choose the lift"
          pickIcon={Check}
          onClose={() => setPicking(false)}
          onPick={(id: string) => {
            setLift(id);
            setPicking(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  state: { fontSize: 12, fontWeight: '700', color: colors.text2 },
  score: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
  tug: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
  },
});
