/**
 * Gloria in the Arena → Ludus: the ludus's fame and war record, its badges, the ludus ranking
 * (tap a ludus to see its record and badges) and the full war history.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { EmptyState, ListGroup, ListRow, SectionHeader } from '@/components/List';
import { LogoMark } from '@/components/Logo';
import { Sheet } from '@/components/Sheet';
import { BadgeGrid } from '@/features/badges/BadgeViews';
import { formatKg } from '@/lib/formulas';
import { buildingDef, type BuildingId } from '@/lib/game/fortress';
import { GLORIA, LAURELS } from '@/lib/game/config';
import { ludusBadges, type WarRecord } from '@/lib/game/gloria';
import { accentA, colors, tabular, type } from '@/theme/tokens';

import { useLudusRanking, type LudusRank, type War } from './api';

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Gloria, place and wins–losses in one row. */
export function GloriaStats({ record, place }: { record: WarRecord; place: number | null }) {
  return (
    <View style={styles.stats}>
      <Stat label="Gloria" value={record.gloria.toLocaleString('en-US')} accent />
      <Stat label="Ranking" value={place ? `#${place}` : '–'} />
      <Stat label="Won – lost" value={`${record.wins} – ${record.losses}`} />
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.statValue, tabular, accent && { color: colors.accent }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

/** The crew's badges, earned together in wars. */
export function LudusBadges({ record }: { record: WarRecord }) {
  return <BadgeGrid badges={ludusBadges(record)} />;
}

/** The ludus ranking: the top 10 (and your own ludus), "See all" for the top 50. */
export function LudusRanking({ mine }: { mine: string | null }) {
  const ranking = useLudusRanking(mine);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<LudusRank | null>(null);
  const rows = ranking.data ?? [];
  const top = rows.filter((r) => r.place <= 10 || r.id === mine);
  return (
    <>
      <SectionHeader
        title="Ludus ranking"
        right={
          rows.length > top.length ? (
            <TextButton label="See all" accent onPress={() => setAll(true)} />
          ) : undefined
        }
      />
      {top.length ? (
        <RankList rows={top} mine={mine} onOpen={setOpen} />
      ) : (
        <EmptyState
          title={
            ranking.isLoading ? 'Loading…' : ranking.isError ? 'Could not load' : 'No ludi yet'
          }
          text={ranking.isError ? 'Are you online?' : 'Win wars to gain gloria and climb.'}
        />
      )}
      <Sheet visible={all} onClose={() => setAll(false)} title="Ludus ranking">
        <RankList
          rows={rows}
          mine={mine}
          onOpen={(r) => {
            setAll(false);
            setOpen(r);
          }}
        />
      </Sheet>
      <LudusSheet ludus={open} mine={open?.id === mine} onClose={() => setOpen(null)} />
    </>
  );
}

function RankList({
  rows,
  mine,
  onOpen,
}: {
  rows: LudusRank[];
  mine: string | null;
  onOpen: (r: LudusRank) => void;
}) {
  return (
    <ListGroup>
      {rows.map((r) => {
        const ours = r.id === mine;
        return (
          <ListRow
            key={r.id}
            height={58}
            onPress={() => onOpen(r)}
            left={
              <Text style={[styles.place, tabular, r.place <= 3 && { color: colors.accent }]}>
                {r.place}
              </Text>
            }
            title={
              <Text style={[type.bodyStrong, ours && { color: colors.accent }]} numberOfLines={1}>
                {r.name}
              </Text>
            }
            subtitle={`${r.record.wins} won · ${r.record.losses} lost · ${r.members} member${r.members === 1 ? '' : 's'}`}
            right={<Text style={[type.bodyStrong, tabular]}>{r.record.gloria}</Text>}
          />
        );
      })}
    </ListGroup>
  );
}

/** Another ludus (or your own) from the ranking: its record and badges. */
function LudusSheet({
  ludus,
  mine,
  onClose,
}: {
  ludus: LudusRank | null;
  mine: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!ludus} onClose={onClose} title={ludus?.name ?? ''}>
      {ludus ? (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={styles.crest}>
              <LogoMark size={30} />
            </View>
            {ludus.motto ? (
              <Text style={[type.caption, { fontStyle: 'italic', textAlign: 'center' }]}>
                “{ludus.motto}”
              </Text>
            ) : null}
            <Text style={type.small}>
              {mine ? 'Your ludus · ' : ''}
              {ludus.members} member{ludus.members === 1 ? '' : 's'}
            </Text>
          </View>
          <GlassCard radius={22} style={{ padding: 14 }}>
            <GloriaStats record={ludus.record} place={ludus.place} />
          </GlassCard>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {ludus.record.defences} attack{ludus.record.defences === 1 ? '' : 's'} beaten · best run{' '}
            {ludus.record.best_streak} win{ludus.record.best_streak === 1 ? '' : 's'}
            {ludus.record.streak >= 2 ? ` · ${ludus.record.streak} in a row now` : ''}
          </Text>
          <BadgeGrid badges={ludusBadges(ludus.record)} progress={false} />
        </>
      ) : null}
    </Sheet>
  );
}

/** One finished war, from `mine`'s side. */
function WarRow({ w, mine }: { w: War; mine: string }) {
  const won = w.winner_id === mine;
  const weAttacked = w.attacker.id === mine;
  const enemy = weAttacked ? w.defender : w.attacker;
  const gloria = weAttacked ? w.attacker_gloria : w.defender_gloria;
  const damaged = w.damaged_building
    ? (buildingDef(w.damaged_building as BuildingId)?.name ?? w.damaged_building)
    : null;
  const parts = [
    gloria != null && gloria !== 0 ? `${signed(gloria)} gloria` : null,
    won
      ? `+${w.spoils ?? 0} denarii, +${LAURELS.warWin} laurels each`
      : damaged
        ? `${damaged} damaged`
        : 'Nothing damaged',
  ].filter(Boolean);
  return (
    <ListRow
      height={58}
      chevron={false}
      title={`${won ? 'Won' : 'Lost'} ${weAttacked ? 'attacking' : 'defending against'} ${enemy.name}`}
      subtitle={parts.join(' · ')}
      right={
        <Text style={[type.bodyStrong, tabular, won && { color: colors.accent }]}>
          {formatKg(weAttacked ? w.attacker_score : w.defender_score)} :{' '}
          {formatKg(weAttacked ? w.defender_score : w.attacker_score)}
        </Text>
      }
    />
  );
}

/** The last 5 wars, "All wars" for the rest. */
export function WarHistory({ wars, mine }: { wars: War[]; mine: string }) {
  const [all, setAll] = useState(false);
  if (!wars.length) return null;
  return (
    <>
      <ListGroup>
        {wars.slice(0, 5).map((w) => (
          <WarRow key={w.id} w={w} mine={mine} />
        ))}
      </ListGroup>
      {wars.length > 5 ? (
        <TextButton
          label={`All ${wars.length} wars`}
          accent
          style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
          onPress={() => setAll(true)}
        />
      ) : null}
      <Sheet visible={all} onClose={() => setAll(false)} title="Wars">
        <ListGroup>
          {wars.map((w) => (
            <WarRow key={w.id} w={w} mine={mine} />
          ))}
        </ListGroup>
      </Sheet>
    </>
  );
}

/** How gloria works, in one card. */
export function GloriaRules() {
  return (
    <GlassCard radius={22} style={{ gap: 6, padding: 16 }}>
      <Text style={type.bodyStrong}>How to earn gloria</Text>
      <Text style={type.caption}>
        +{GLORIA.win} for every war won, up to +{GLORIA.maxUpset} more for beating a ludus with more
        gloria. A loss costs {GLORIA.loss}, or nothing when you were close (at least{' '}
        {Math.round(GLORIA.closeShare * 100)} % of their score). Gloria never resets.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  place: { width: 22, textAlign: 'right', fontSize: 15, fontWeight: '700', color: colors.text2 },
  crest: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
