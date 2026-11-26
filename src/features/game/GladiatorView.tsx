/** City → Your domus: the gladiator, rank path, character sheet, wallet and the cell. */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ArtStage, GladiatorArt, StyleArt } from '@/components/art/Art';
import { GlassCard } from '@/components/Glass';
import { Coins, Flame, Hammer, Swords } from '@/components/icons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { DENARII, XP } from '@/lib/game/config';
import { nextRank } from '@/lib/game/levels';
import { styleDef } from '@/lib/game/styles';
import { weekStreak } from '@/lib/formulas';
import { weeklyTarget } from '@/lib/programs';
import { useActiveProgram, useFinishedSessions } from '@/features/training/hooks';
import { colors, tabular, type } from '@/theme/tokens';
import { useWallet } from './api';
import { useGladiator } from './cityApi';
import { AttributesCard, CellView, RankLadder } from './GameViews';
import { useMyAttributes, useMyGame } from './hooks';

export function GladiatorView() {
  const game = useMyGame();
  const attrs = useMyAttributes();
  const wallet = useWallet(game.denariiEarned);
  const next = nextRank(game.level);
  const glad = useGladiator().data;
  const sessions = useFinishedSessions();
  const target = weeklyTarget(useActiveProgram());
  const streak = useMemo(
    () =>
      weekStreak(
        sessions.map((s) => new Date(s.started_at)),
        target,
      ),
    [sessions, target],
  );

  return (
    <View style={{ gap: 14 }}>
      <ArtStage
        overlay={
          <View style={styles.chips}>
            <View style={styles.level}>
              <Text style={[styles.levelText, tabular]}>Lv {game.level}</Text>
            </View>
            {streak > 0 ? (
              <View style={styles.streak} accessibilityLabel={`${streak}-week streak`}>
                <Flame size={14} color={colors.accent} strokeWidth={2.2} />
                <Text style={[type.captionStrong, { color: colors.accent }, tabular]}>
                  {streak} week{streak === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          </View>
        }
      >
        {glad?.style ? (
          <StyleArt style={glad.style} width={190} />
        ) : (
          <GladiatorArt rank={game.rank.id} width={190} />
        )}
      </ArtStage>
      <View style={styles.rankLine}>
        <Text style={[type.rpg, styles.rankName]}>{game.rank.name}</Text>
        <Text style={type.caption} numberOfLines={1}>
          {next ? `${next.name} at level ${next.from}` : 'The highest rank'}
        </Text>
      </View>

      <ListGroup>
        <ListRow
          height={52}
          left={<Swords size={18} color={colors.accent} strokeWidth={2.2} />}
          title="Fighting style"
          right={
            <Text style={type.caption}>{glad?.style ? styleDef(glad.style).name : 'Choose'}</Text>
          }
          onPress={() => router.push('/style')}
        />
        <ListRow
          height={52}
          left={<Hammer size={18} color={colors.accent} strokeWidth={2.2} />}
          title="Forge"
          right={<Text style={[type.caption, tabular]}>power {glad?.power ?? '—'}</Text>}
          onPress={() => router.push('/forge')}
        />
      </ListGroup>

      <View style={styles.tiles}>
        <GlassCard radius={22} style={styles.tile}>
          <Text style={[styles.big, tabular]}>{game.xp.toLocaleString('en-US')}</Text>
          <Text style={type.small}>XP in total</Text>
        </GlassCard>
        <GlassCard radius={22} style={styles.tile}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Coins size={16} color={colors.accent} strokeWidth={2.2} />
            <Text style={[styles.big, tabular]}>{wallet.data ?? '—'}</Text>
          </View>
          <Text style={type.small}>Denarii to give</Text>
        </GlassCard>
      </View>

      <SectionHeader title="Attributes" />
      <AttributesCard attrs={attrs} />

      <SectionHeader title="Path of the gladiator" />
      <RankLadder level={game.level} />
      <Text style={[type.small, { paddingHorizontal: 4, textAlign: 'center' }]}>
        A rank never drops.
      </Text>

      <SectionHeader title="Your cell" />
      <CellView level={game.level} />

      <GlassCard radius={22} style={{ gap: 6, padding: 16 }}>
        <Text style={type.bodyStrong}>Earned only by training</Text>
        <Text style={type.caption}>
          {XP.workout} XP per workout (3 sets or more), +{XP.pr} per PR, +{XP.verified} when
          verified at the gym, +{XP.streakWeek} per week of your streak. Never for volume, so extra
          sets earn nothing. At most {XP.dailyCap} XP and {DENARII.dailyCap} denarii a day.
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: {
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  rankName: { fontSize: 22, color: colors.accent },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 16, gap: 2 },
  big: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
});
