/**
 * Building blocks of the game layer: level line and XP bar, the rank ladder, league emblem, the
 * cell (a cosmetic home), the character sheet and the season card. Same glass, grey and red as
 * everything else: red only for progress and highlights.
 */
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Tap } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Amphora,
  Bed,
  Check,
  ChevronRight,
  Crown,
  Dumbbell,
  HardHat,
  Lamp,
  Lock,
  Shield,
  Shirt,
  Sword,
  Swords,
  User,
  type LucideIcon,
} from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { ArtStage, GladiatorArt, HomeArt } from '@/components/art/Art';
import { cellItems, CELL_ROOMS, homeStage, type Attributes } from '@/lib/game/attributes';
import {
  leagueFor,
  nextLeague,
  RANKS,
  rankFor,
  seasonDaysLeft,
  seasonName,
  type League,
  type LevelProgress,
} from '@/lib/game/levels';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useMyGame } from './hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** "Level 7 · Gladiator" */
export function LevelLine({ level, style }: { level: number; style?: object }) {
  return (
    <Text style={[type.captionStrong, style]} numberOfLines={1}>
      Level {level} · <Text style={{ color: colors.accent }}>{rankFor(level).name}</Text>
    </Text>
  );
}

export function XpBar({ progress }: { progress: LevelProgress }) {
  return (
    <View
      style={{ gap: 5 }}
      accessibilityLabel={`${fmt(progress.into)} of ${fmt(progress.span)} XP to level ${progress.level + 1}`}
    >
      <ProgressBar value={progress.share} height={5} />
      <Text style={[type.small, tabular]}>
        {fmt(progress.into)} / {fmt(progress.span)} XP to level {progress.level + 1}
      </Text>
    </View>
  );
}

/** League emblem: a shield with the league's tier marks; the top league wears a red crown. */
export function LeagueEmblem({ league, size = 44 }: { league: League; size?: number }) {
  const tier = { bronze: 1, silver: 2, gold: 3, imperator: 4 }[league.id];
  const top = league.id === 'imperator';
  return (
    <View
      style={[
        styles.emblem,
        { width: size, height: size, borderRadius: size / 2 },
        top && { backgroundColor: accentA(0.1) },
      ]}
      accessibilityLabel={`${league.name} league`}
    >
      {top ? (
        <Crown size={size * 0.48} color={colors.accent} strokeWidth={2} />
      ) : (
        <Shield size={size * 0.5} color={colors.text} strokeWidth={2} />
      )}
      <View style={styles.pips}>
        {Array.from({ length: tier }, (_, i) => (
          <View key={i} style={[styles.pip, top && { backgroundColor: colors.accent }]} />
        ))}
      </View>
    </View>
  );
}

/** Today: where I stand in this season's league. */
export function SeasonCard() {
  const { season } = useMyGame();
  const league = leagueFor(season.score);
  const next = nextLeague(season.score);
  const from = league.from;
  const share = next ? (season.score - from) / (next.from - from) : 1;
  const days = seasonDaysLeft();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`Season, ${league.name} league, ${season.score} laurels`}
      onPress={() => router.navigate({ pathname: '/arena', params: { mode: 'league' } })}
    >
      <GlassCard radius={22} style={styles.season}>
        <LeagueEmblem league={league} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.row}>
            <Text style={type.bodyStrong} numberOfLines={1}>
              {league.name}
            </Text>
            <Text style={[type.small, tabular]}>
              {days} day{days === 1 ? '' : 's'} left
            </Text>
          </View>
          <ProgressBar value={share} height={5} />
          <Text style={[type.small, tabular]} numberOfLines={1}>
            {fmt(season.score)} laurels
            {next ? ` · ${fmt(next.from - season.score)} to ${next.name}` : ' · the top league'}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.text3} strokeWidth={2.4} />
      </GlassCard>
    </Tap>
  );
}

/**
 * The path of the gladiator: every rank with its look, the ones reached ticked, the current one
 * outlined in red. Rudiarius stays hidden until it is earned.
 */
export function RankLadder({ level }: { level: number }) {
  const current = rankFor(level);
  return (
    <View style={{ gap: 10 }}>
      {RANKS.map((r) => {
        const reached = level >= r.from;
        const here = r.id === current.id;
        const secret = r.id === 'rudiarius' && !reached;
        return (
          <Glass
            key={r.id}
            radius={22}
            style={[styles.rankRow, here && styles.rankHere]}
            accessibilityLabel={`${r.name}, ${here ? 'your rank' : reached ? 'reached' : `from level ${r.from}`}`}
          >
            <ArtStage height={76} style={styles.rankArt}>
              {secret ? (
                <Lock size={20} color={colors.text3} strokeWidth={2} />
              ) : (
                <View style={!reached && { opacity: 0.45 }}>
                  <GladiatorArt rank={r.id} width={68} />
                </View>
              )}
            </ArtStage>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.rpg}>{r.name}</Text>
              <Text style={type.caption}>
                {secret ? 'A legendary look, shown once earned' : r.look}
              </Text>
            </View>
            {here ? (
              <Text style={[type.captionStrong, { color: colors.accent }]}>now</Text>
            ) : reached ? (
              <View style={styles.reached}>
                <Check size={13} color={colors.text2} strokeWidth={2.6} />
                <Text style={type.captionStrong}>earned</Text>
              </View>
            ) : (
              <Text style={[type.captionStrong, tabular]}>from lv {r.from}</Text>
            )}
          </Glass>
        );
      })}
    </View>
  );
}

const ITEM_ICONS: Record<string, LucideIcon | 'laurel'> = {
  bed: Bed,
  lamp: Lamp,
  palus: Dumbbell,
  shield: Shield,
  helmet: HardHat,
  trident: Swords,
  amphora: Amphora,
  armour: Shirt,
  wreath: 'laurel',
  rudis: Sword,
  bust: User,
};

/** The cell: grows with the rank, fills with things at set levels. Cosmetic, for showing off. */
export function CellView({ level, owner }: { level: number; owner?: string }) {
  const rank = rankFor(level).id;
  const room = CELL_ROOMS[rank];
  const items = cellItems(level);
  const open = items.filter((i) => i.unlocked).length;
  return (
    <GlassCard radius={22} style={{ gap: 14, padding: 16 }}>
      <ArtStage height={190}>
        <HomeArt stage={homeStage(rank)} width={200} />
      </ArtStage>
      <View style={styles.row}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={type.bodyStrong}>
            {owner ? `${owner}’s ${room.toLowerCase()}` : `Your ${room.toLowerCase()}`}
          </Text>
          <Text style={type.small}>
            {open} of {items.length} things · grows with every level
          </Text>
        </View>
      </View>
      <View style={styles.items}>
        {items.map(({ item, unlocked }) => {
          const Icon = ITEM_ICONS[item.id];
          return (
            <View
              key={item.id}
              style={styles.item}
              accessibilityLabel={
                unlocked ? item.name : `${item.name}, opens at level ${item.level}`
              }
            >
              <View style={[styles.itemIcon, unlocked && styles.itemOpen]}>
                {Icon === 'laurel' ? (
                  <LogoMark size={26} color={unlocked ? colors.accent : colors.text3} />
                ) : (
                  <Icon size={22} color={unlocked ? colors.text : colors.text3} strokeWidth={2} />
                )}
              </View>
              <Text
                style={[styles.itemName, !unlocked && { color: colors.text3 }]}
                numberOfLines={1}
              >
                {unlocked ? item.name : `Lv ${item.level}`}
              </Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

/** Strength, Endurance and Discipline, 0–99. */
export function AttributesCard({ attrs }: { attrs: Attributes }) {
  const rows: { label: string; value: number | null; hint: string }[] = [
    {
      label: 'Strength',
      value: attrs.strength,
      hint:
        attrs.strength == null
          ? 'Log your bodyweight in Body to see it'
          : 'Best squat, bench and deadlift (DOTS)',
    },
    { label: 'Endurance', value: attrs.endurance, hint: 'Working sets in the last 90 days' },
    { label: 'Discipline', value: attrs.discipline, hint: 'Weeks on target in the last 12' },
  ];
  return (
    <GlassCard radius={22} style={{ gap: 14, padding: 16 }}>
      {rows.map((r) => (
        <View
          key={r.label}
          style={{ gap: 6 }}
          accessibilityLabel={`${r.label} ${r.value ?? 'unknown'}`}
        >
          <View style={styles.row}>
            <Text style={type.bodyStrong}>{r.label}</Text>
            <Text style={[styles.attr, tabular]}>{r.value ?? '—'}</Text>
          </View>
          <ProgressBar value={(r.value ?? 0) / 99} height={5} />
          <Text style={type.small}>{r.hint}</Text>
        </View>
      ))}
    </GlassCard>
  );
}

export function seasonTitle(season: string): string {
  return `${seasonName(season)} season`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  season: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  emblem: { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  pips: { position: 'absolute', bottom: 6, flexDirection: 'row', gap: 2 },
  pip: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text2 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
  },
  rankHere: { borderWidth: 1.5, borderColor: colors.accent },
  rankArt: { width: 68, borderRadius: 16, boxShadow: 'none' },
  reached: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  items: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  item: { width: '25%', alignItems: 'center', gap: 6 },
  itemIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOpen: { backgroundColor: colors.white, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
  itemName: { fontSize: 11, fontWeight: '500', color: colors.text, textAlign: 'center' },
  attr: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
});
