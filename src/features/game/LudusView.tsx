/**
 * City → Clan (a ludus in code): your crew of 2–10 (any gyms). Create or join one; then the crew, its wars and
 * its fortress. The leader declares wars and can remove members.
 */
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { FormField, FormGroup } from '@/components/Form';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Crown,
  LogIn,
  Plus,
  QrCode as QrIcon,
  Share as ShareIcon,
  Swords,
  X,
} from '@/components/icons';
import { EmptyState, ListGroup, ListRow, SectionHeader } from '@/components/List';
import { LogoMark } from '@/components/Logo';
import { QrCode } from '@/components/QrCode';
import { SearchField } from '@/components/SearchField';
import { Sheet } from '@/components/Sheet';
import { LAURELS, LUDUS, WAR } from '@/lib/game/config';
import { currentLevel, timeLeftText } from '@/lib/game/fortress';
import { formatKg } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import {
  useCreateLudus,
  useDeclareWar,
  useJoinLudus,
  useLeaveLudus,
  useLudusDirectory,
  useLudusRanking,
  useLudusRecords,
  useMyLudus,
  useRemoveMember,
  useWars,
  type Ludus,
  type LudusListing,
  type War,
} from './api';
import { FortressView } from './FortressView';
import { GloriaRules, GloriaStats, LudusBadges, LudusRanking, WarHistory } from './GloriaViews';

export function ludusLink(code: string): string {
  return Linking.createURL(`/ludus/${code}`);
}

export function LudusView() {
  const ludus = useMyLudus();
  if (ludus.isLoading) return <Text style={type.caption}>Loading…</Text>;
  if (ludus.isError) return <EmptyState title="Could not load" text="Are you online?" />;
  return ludus.data ? <MyLudus ludus={ludus.data} /> : <NoLudus />;
}

function NoLudus() {
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null);
  return (
    <View style={{ gap: 16 }}>
      <GlassCard radius={24} style={styles.intro}>
        <View style={styles.introIcon}>
          <LogoMark size={40} />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>Your clan</Text>
        <Text style={[type.caption, { textAlign: 'center' }]}>
          A crew of {LUDUS.minMembers}–{LUDUS.maxMembers} friends, from any gym. Give the denarii
          you earn by training, build your fortress together and fight other clans: the crew that
          trains more wins.
        </Text>
      </GlassCard>
      <FillButton label="Create a clan" icon={Plus} onPress={() => setSheet('create')} />
      <FillButton label="Join with a code" icon={LogIn} onPress={() => setSheet('join')} />
      <LudusRanking mine={null} />
      {sheet === 'create' ? <CreateSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'join' ? <JoinSheet onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const create = useCreateLudus();
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const ok = name.trim().length >= 3 && name.trim().length <= LUDUS.nameMax;
  return (
    <Sheet
      visible
      onClose={onClose}
      title="New clan"
      doneLabel="Create"
      doneDisabled={!ok || create.isPending}
      onDone={() =>
        create.mutate(
          { name, motto },
          {
            onSuccess: () => (toast('Your clan is ready. Invite your crew!', true), onClose()),
            onError: (e) => toast(e.message),
          },
        )
      }
    >
      <FormGroup>
        <FormField
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={LUDUS.nameMax}
          placeholder="Ferrum Vincit"
          autoFocus
        />
        <FormField
          label="Motto"
          value={motto}
          onChangeText={setMotto}
          maxLength={LUDUS.mottoMax}
          placeholder="Optional"
        />
      </FormGroup>
      <Text style={type.small}>You lead it: you declare wars and can remove members.</Text>
    </Sheet>
  );
}

function JoinSheet({ onClose, initial = '' }: { onClose: () => void; initial?: string }) {
  const join = useJoinLudus();
  const [code, setCode] = useState(initial);
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Join a clan"
      doneLabel="Join"
      doneDisabled={clean.length !== 6 || join.isPending}
      onDone={() =>
        join.mutate(clean, {
          onSuccess: () => (toast('Welcome to the clan!', true), onClose()),
          onError: (e) => toast(e.message),
        })
      }
    >
      <FormGroup>
        <FormField
          label="Code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={8}
          placeholder="6 characters"
          autoFocus
        />
      </FormGroup>
      <Text style={type.small}>
        Ask the crew for their code, or scan their invite QR with the phone camera.
      </Text>
    </Sheet>
  );
}

function MyLudus({ ludus }: { ludus: Ludus }) {
  const myId = useData((s) => s.userId);
  const leader = ludus.myRole === 'leader';
  const [invite, setInvite] = useState(false);
  const [fight, setFight] = useState(false);
  const leave = useLeaveLudus();
  const remove = useRemoveMember();
  const wars = useWars(ludus.id);
  const place = useLudusRanking(ludus.id).data?.find((r) => r.id === ludus.id)?.place ?? null;
  const temple = currentLevel(ludus.buildings.find((b) => b.building === 'temple'));
  const active = (wars.data ?? []).find((w) => !w.settled_at);
  const past = (wars.data ?? []).filter((w) => w.settled_at);
  const full = ludus.members.length >= ludus.limit;

  return (
    <View style={{ gap: 16 }}>
      <GlassCard radius={24} style={{ gap: 12, padding: 18 }}>
        <View style={styles.row}>
          <View style={styles.crest}>
            <LogoMark size={30} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.title} numberOfLines={1}>
              {ludus.name}
            </Text>
            {ludus.motto ? (
              <Text style={[type.caption, { fontStyle: 'italic' }]} numberOfLines={2}>
                “{ludus.motto}”
              </Text>
            ) : null}
          </View>
          <IconButton
            icon={QrIcon}
            accessibilityLabel="Invite to the clan"
            onPress={() => setInvite(true)}
          />
        </View>
        <GloriaStats record={ludus.record} place={place} />
        <Text style={[type.small, tabular]}>
          {ludus.members.length} of {ludus.limit} members · {ludus.treasury.toLocaleString('en-US')}{' '}
          denarii in the treasury
        </Text>
      </GlassCard>

      <SectionHeader
        title="War"
        right={
          leader && !active ? (
            <TextButton label="Declare war" accent onPress={() => setFight(true)} />
          ) : undefined
        }
      />
      {active ? (
        <WarCard war={active} mine={ludus.id} />
      ) : (
        <EmptyState
          title="At peace"
          text={
            ludus.members.length < LUDUS.minMembers
              ? `A clan needs ${LUDUS.minMembers} members to fight. Invite your crew.`
              : leader
                ? `Declare war on another clan. For ${WAR.days} days, verified workouts at the gym score points; the crew with more per member wins.`
                : 'Your leader declares wars. When one starts, every verified workout counts.'
          }
        />
      )}
      <WarHistory wars={past} mine={ludus.id} />

      <SectionHeader title="Badges" />
      <LudusBadges record={ludus.record} />

      <SectionHeader
        title="Members"
        right={
          full ? (
            <Text style={type.small}>Full</Text>
          ) : (
            <TextButton label="Invite" accent onPress={() => setInvite(true)} />
          )
        }
      />
      <ListGroup>
        {ludus.members.map((m) => (
          <ListRow
            key={m.id}
            height={58}
            chevron={m.id !== myId}
            onPress={
              m.id === myId
                ? undefined
                : () => router.push({ pathname: '/user/[id]', params: { id: m.id } })
            }
            left={<Avatar name={m.display_name} url={m.avatar_url} size={36} />}
            title={
              <Text style={type.bodyStrong} numberOfLines={1}>
                {m.id === myId ? 'You' : m.display_name}{' '}
                {m.role === 'leader' ? (
                  <Crown size={13} color={colors.accent} strokeWidth={2.4} />
                ) : null}
              </Text>
            }
            subtitle={m.role === 'leader' ? 'Leader' : `@${m.username}`}
            rightInteractive={leader && m.id !== myId}
            right={
              leader && m.id !== myId ? (
                <IconButton
                  icon={X}
                  size={32}
                  iconSize={15}
                  accessibilityLabel={`Remove ${m.display_name}`}
                  onPress={async () => {
                    if (
                      await confirm({
                        title: `Remove ${m.display_name}?`,
                        message: 'They can join again with the code.',
                        confirmLabel: 'Remove',
                        destructive: true,
                      })
                    )
                      remove.mutate(m.id, { onError: (e) => toast(e.message) });
                  }}
                />
              ) : undefined
            }
          />
        ))}
      </ListGroup>

      <SectionHeader title="Fortress" />
      <FortressView
        kind="ludus"
        id={ludus.id}
        title={ludus.name}
        extra={temple ? <HallOfRecords ludusId={ludus.id} /> : undefined}
      />

      <LudusRanking mine={ludus.id} />
      <GloriaRules />

      <TextButton
        label="Leave the clan"
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
        onPress={async () => {
          const last = ludus.members.length === 1;
          if (
            await confirm({
              title: `Leave ${ludus.name}?`,
              message: last
                ? 'You are the last member: the clan, its treasury and fortress close for good.'
                : leader
                  ? 'The longest member becomes the leader. Denarii you gave stay in the treasury.'
                  : 'Denarii you gave stay in the treasury.',
              confirmLabel: 'Leave',
              destructive: true,
            })
          )
            leave.mutate(undefined, { onError: (e) => toast(e.message) });
        }}
      />
      {invite ? <InviteSheet ludus={ludus} onClose={() => setInvite(false)} /> : null}
      {fight ? <WarSheet ludus={ludus} onClose={() => setFight(false)} /> : null}
    </View>
  );
}

function InviteSheet({ ludus, onClose }: { ludus: Ludus; onClose: () => void }) {
  const link = ludusLink(ludus.code);
  return (
    <Sheet visible onClose={onClose} title="Invite">
      <View style={styles.qr}>
        <QrCode value={link} size={200} />
      </View>
      <Text
        style={[styles.code, tabular]}
        accessibilityLabel={`Code ${ludus.code.split('').join(' ')}`}
      >
        {ludus.code}
      </Text>
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Friends scan this with the phone camera, or type the code in City → Clan → Join.
      </Text>
      <FillButton
        label="Share link"
        icon={ShareIcon}
        onPress={() =>
          void Share.share({ message: `Join my clan ${ludus.name} on Colosseum: ${link}` }).catch(
            () => {},
          )
        }
        style={{ marginBottom: 8 }}
      />
    </Sheet>
  );
}

/** The leader picks a ludus to attack. */
function WarSheet({ ludus, onClose }: { ludus: Ludus; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = useLudusDirectory(q);
  const declare = useDeclareWar();
  const pick = async (target: LudusListing) => {
    if (
      await confirm({
        title: `Declare war on ${target.name}?`,
        message: `For ${WAR.days} days, verified workouts at the gym score points (${WAR.perWorkout} each, +${WAR.pr} per PR, +${WAR.perDay} per day). Points are divided by active members, so size does not decide. The winner takes up to ${WAR.maxSpoils} denarii, ${LAURELS.warWin} laurels each and gloria; one of the loser's buildings gets damaged.`,
        confirmLabel: 'Declare war',
      })
    )
      declare.mutate(target, {
        onSuccess: () => (toast(`War on ${target.name}! Train at the gym.`, true), onClose()),
        onError: (e) => toast(e.message),
      });
  };
  const rows = (list.data ?? []).filter((l) => l.id !== ludus.id);
  return (
    <Sheet visible onClose={onClose} title="Declare war">
      <SearchField value={q} onChangeText={setQ} placeholder="Search clans" />
      {rows.length ? (
        <ListGroup>
          {rows.map((l) => (
            <ListRow
              key={l.id}
              height={56}
              onPress={() => void pick(l)}
              left={
                <View style={styles.smallCrest}>
                  <Swords size={16} color={colors.text} strokeWidth={2} />
                </View>
              }
              title={l.name}
              subtitle={`${l.members} member${l.members === 1 ? '' : 's'}${l.motto ? ` · ${l.motto}` : ''}`}
            />
          ))}
        </ListGroup>
      ) : (
        <Text style={[type.caption, { textAlign: 'center', padding: 16 }]}>
          {list.isLoading ? 'Loading…' : 'No clan found'}
        </Text>
      )}
    </Sheet>
  );
}

export function WarCard({ war, mine }: { war: War; mine: string }) {
  const weAttack = war.attacker.id === mine;
  const us = weAttack ? war.attacker_score : war.defender_score;
  const them = weAttack ? war.defender_score : war.attacker_score;
  const enemy = weAttack ? war.defender : war.attacker;
  const total = us + them || 1;
  const leading = us > them || (us === them && !weAttack);
  return (
    <GlassCard
      radius={22}
      style={{ gap: 12, padding: 16 }}
      accessibilityLabel={`War against ${enemy.name}`}
    >
      <View style={styles.row}>
        <View style={[styles.smallCrest, { backgroundColor: accentA(0.1) }]}>
          <Swords size={16} color={colors.accent} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            {weAttack ? `You attack ${enemy.name}` : `${enemy.name} attacks you`}
          </Text>
          <Text style={[type.small, tabular]}>Ends in {timeLeftText(war.ends_at)}</Text>
        </View>
        <Text style={[styles.leading, leading && { color: colors.accent }]}>
          {leading ? 'Leading' : 'Behind'}
        </Text>
      </View>
      <View style={styles.versus}>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>You</Text>
          <Text style={[styles.score, tabular]}>{us.toFixed(1)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={type.small} numberOfLines={1}>
            {enemy.name}
          </Text>
          <Text style={[styles.score, tabular, { color: colors.text2 }]}>{them.toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.tug}>
        <View style={[styles.tugUs, { flex: us / total || 0.0001 }]} />
        <View style={{ flex: them / total || 0.0001 }} />
      </View>
      <Text style={type.small}>
        Points per active member. Only workouts verified at the gym count.
        {!weAttack && war.defender_palisade
          ? ` Your palisade adds ${war.defender_palisade * 5} %.`
          : weAttack && war.defender_palisade
            ? ` Their palisade adds ${war.defender_palisade * 5} %.`
            : ''}
      </Text>
    </GlassCard>
  );
}

function HallOfRecords({ ludusId }: { ludusId: string }) {
  const records = useLudusRecords(ludusId, true);
  const list = records.data ?? [];
  if (!list.length) return null;
  return (
    <Glass radius={22} style={{ padding: 16, gap: 10 }}>
      <Text style={type.bodyStrong}>Hall of records</Text>
      {list.map((r) => (
        <View key={r.lift} style={styles.row}>
          <Text style={[type.body, { flex: 1 }]}>{r.lift}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {r.display_name}
          </Text>
          <Text style={[type.bodyStrong, tabular]}>{formatKg(r.e1rm)} kg</Text>
        </View>
      ))}
      <Text style={type.small}>Estimated 1RM, built by your temple.</Text>
    </Glass>
  );
}

export { JoinSheet };

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 10, padding: 22 },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crest: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCrest: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qr: { alignSelf: 'center', padding: 14, backgroundColor: colors.white, borderRadius: 20 },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text,
  },
  leading: { fontSize: 12, fontWeight: '700', color: colors.text2 },
  versus: { flexDirection: 'row' },
  score: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  tug: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.fillStrong,
  },
  tugUs: { backgroundColor: colors.accent },
});
