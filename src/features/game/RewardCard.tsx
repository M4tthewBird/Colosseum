/**
 * The workout summary's reward: "+145 XP" counting up, what it came from, the level bar, a
 * level-up or new-rank banner, and the laurels and denarii it brought.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { GladiatorArt } from '@/components/art/Art';
import { GlassCard } from '@/components/Glass';
import { Coins } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { QUALIFYING_SETS, RUN, XP } from '@/lib/game/config';
import { rankFor } from '@/lib/game/levels';
import { useTween } from '@/lib/useTween';
import { useData } from '@/stores/data';
import { useReducedMotion } from '@/theme/motion';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { LevelLine, XpBar } from './GameViews';
import { useMyGame } from './hooks';

export function RewardCard({ sessionId }: { sessionId: string }) {
  const game = useMyGame();
  const homeGym = useData((s) => s.profile?.home_gym_id);
  const run = useData((s) => s.sessions[sessionId]?.kind === 'run');
  const reduced = useReducedMotion();
  const r = game.sessions[sessionId];
  const xp = useTween(r?.xp ?? 0, 1100);
  if (!r) return null;

  if (!r.qualifies)
    return (
      <GlassCard radius={22} style={styles.card}>
        <Text style={type.bodyStrong}>No XP this time</Text>
        <Text style={type.small}>
          {run
            ? `Runs from ${RUN.minDistanceM / 1000} km or ${RUN.minDurationS / 60} minutes at a running pace count.`
            : `Log at least ${QUALIFYING_SETS} working sets for a workout to count.`}
        </Text>
      </GlassCard>
    );

  const levelUp = r.levelAfter > r.levelBefore;
  const newRank = rankFor(r.levelAfter).id !== rankFor(r.levelBefore).id;

  return (
    <GlassCard radius={22} style={styles.card} accessibilityLabel={`${r.xp} XP earned`}>
      <View style={styles.head}>
        <Text style={[styles.xp, tabular]}>+{Math.round(xp)} XP</Text>
        <LevelLine level={r.levelAfter} />
      </View>

      {newRank ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.delay(900).springify()}
          style={styles.rankUp}
          accessibilityLabel={`New rank: ${rankFor(r.levelAfter).name}`}
        >
          <Text style={styles.kicker}>NEW RANK</Text>
          <GladiatorArt rank={rankFor(r.levelAfter).id} width={150} />
          <Text style={[type.rpg, { fontSize: 26, letterSpacing: 2 }]}>
            {rankFor(r.levelAfter).name}
          </Text>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            Level {r.levelAfter} · your gladiator has a new look:{' '}
            {rankFor(r.levelAfter).look.toLowerCase()}. Your cell grew too.
          </Text>
        </Animated.View>
      ) : levelUp ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.delay(900).springify()}
          style={styles.banner}
        >
          <LogoMark size={26} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: colors.accent }]}>Level {r.levelAfter}!</Text>
            <Text style={type.small}>Something new may be waiting in your cell.</Text>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.parts}>
        {r.xpParts.map((p) => (
          <View key={p.label} style={styles.part}>
            <Text style={styles.partText}>
              {p.label} <Text style={{ color: colors.accent }}>+{p.amount}</Text>
            </Text>
          </View>
        ))}
      </View>

      <XpBar progress={game.progress} />

      <View style={styles.line}>
        <LogoMark size={15} bell={false} />
        <Text style={[type.small, tabular, { flex: 1 }]}>
          {r.laurels ? `+${r.laurels} laurels` : 'Laurels: already earned today'}
        </Text>
        <Coins size={14} color={colors.accent} strokeWidth={2.2} />
        <Text style={[type.small, tabular]}>+{r.denarii} denarii</Text>
      </View>

      {r.xpCapped > 0 ? (
        <Text style={type.small}>
          Daily limit reached: {r.xpCapped} XP over {XP.dailyCap} a day were not added.
        </Text>
      ) : null}
      {r.unusualPrs > 0 ? (
        <Text style={type.small}>
          {run
            ? `This run beat your best by more than ${RUN.unusualGain * 100} %`
            : r.unusualPrs === 1
              ? 'One PR jumped more than 25 % over the old best'
              : `${r.unusualPrs} PRs jumped more than 25 % over the old best`}
          : no reward for it this time.
        </Text>
      ) : null}
      {run && !r.verification ? (
        <Text style={type.small}>This run counts in wars, Bellum and tribe attacks.</Text>
      ) : !r.verification && homeGym ? (
        <Text style={type.small}>
          Check in at your gym with its QR code next time: +{XP.verified} XP, more denarii, and the
          workout counts in wars.
        </Text>
      ) : r.verification === 'verified' ? (
        <Text style={[type.small, { color: colors.accent, fontWeight: '600' }]}>
          Verified at the gym
        </Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16 },
  head: { gap: 2 },
  xp: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.accent },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: accentA(0.07),
  },
  rankUp: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 3, color: colors.accent },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  part: {
    borderRadius: 999,
    backgroundColor: colors.fill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  partText: { fontSize: 12, fontWeight: '600', color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
