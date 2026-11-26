/**
 * The city around the Colosseum, the forge (gear) and the fighting style (docs/GAME.md §9).
 * Every building of the city opens one part of the game.
 */
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ArtStage, CityArt, GearArt, GladiatorArt, StyleArt } from '@/components/art/Art';
import { FillButton, IconButton, Tap } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Bath,
  Castle,
  ChevronLeft,
  ChevronRight,
  Coins,
  Hammer,
  House,
  Landmark,
  Lock,
  Store,
  Swords,
  Trophy,
  type LucideIcon,
} from '@/components/icons';
import { ListGroup, ListRow } from '@/components/List';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { homeStage } from '@/lib/game/attributes';
import { STYLE } from '@/lib/game/config';
import { fortressLevel } from '@/lib/game/fortress';
import {
  GEAR_ITEMS,
  GEAR_SLOTS,
  gearInSlot,
  owns,
  unlockText,
  worn,
  type GearItem,
  type GearSlot,
} from '@/lib/game/gear';
import { nextSeason, seasonName, seasonOf } from '@/lib/game/levels';
import { canChangeStyle, STYLES, styleDef, type StyleId } from '@/lib/game/styles';
import { useGym } from '@/features/social/api';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, shadows, tabular, type } from '@/theme/tokens';
import { useFortress, useMyLudus, useWallet } from './api';
import { useBuyGear, useChooseStyle, useEquipGear, useGladiator, useTribeWars } from './cityApi';
import { chooseGame, useGameOn } from './gameMode';
import { LevelLine, XpBar } from './GameViews';
import { useGearProgress, useMyGame } from './hooks';

const fmt = (n: number) => n.toLocaleString('en-US');

/** The white pill with my denarii, top right of the city screens. */
export function DenariiPill() {
  const game = useMyGame();
  const wallet = useWallet(game.denariiEarned).data;
  return (
    <Glass radius={999} style={styles.pill} accessibilityLabel={`${wallet ?? 0} denarii`}>
      <Coins size={16} color={colors.text} strokeWidth={2.2} />
      <Text style={[styles.pillText, tabular]}>{wallet == null ? '—' : fmt(wallet)}</Text>
    </Glass>
  );
}

/** Back button, a title and the denarii pill. */
export function CityTopBar({
  title,
  fallback = '/city',
  pill = true,
}: {
  title: string;
  fallback?: Href;
  pill?: boolean;
}) {
  return (
    <View style={styles.topBar}>
      <IconButton
        icon={ChevronLeft}
        size={44}
        iconSize={22}
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      />
      <Text style={styles.topTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {pill ? <DenariiPill /> : null}
    </View>
  );
}

// ───────────── The city ─────────────

/** The City tab: your gladiator, the city, and its places, each opening one part of the game. */
export function CityScreen() {
  const gameOn = useGameOn();
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym;
  const tribe = useFortress('gym', gymId).data;
  const ludus = useMyLudus().data;
  const game = useMyGame();
  const progress = useGearProgress();
  const wars = useTribeWars(gymId).data;
  const now = new Date();
  const tribeLevel = tribe ? fortressLevel(tribe.buildings, now) : 0;
  const ludusLevel = ludus ? fortressLevel(ludus.buildings, now) : null;
  const atWar = wars?.some((w) => !w.settled_at);
  const owned = GEAR_ITEMS.filter((g) => owns(g, progress)).length;

  const row = ({
    icon: Icon,
    title,
    subtitle,
    right,
    to,
    soon,
  }: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    right?: string;
    to?: () => void;
    soon?: boolean;
  }) => (
    <ListRow
      height={58}
      left={<Icon size={22} color={soon ? colors.text3 : colors.accent} strokeWidth={2} />}
      title={title}
      subtitle={subtitle}
      right={
        right ? (
          <Text
            style={[type.captionStrong, tabular, right === 'war on' && { color: colors.accent }]}
          >
            {right}
          </Text>
        ) : undefined
      }
      onPress={to}
      chevron={!soon}
    />
  );

  return (
    <Screen glow="center" gap={16}>
      <Header
        above={gym ? `${gym.name} · tribe lv ${tribeLevel}` : 'No home gym yet'}
        title="City"
        right={<DenariiPill />}
      />
      {gameOn ? null : <GameOffCard />}
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Your gladiator, level ${game.level}, ${game.rank.name}`}
        onPress={() => router.push('/city/domus')}
      >
        <GlassCard radius={22} style={styles.gladiator}>
          <View style={{ flex: 1, gap: 8 }}>
            <LevelLine level={game.level} />
            <XpBar progress={game.progress} />
          </View>
          <ChevronRight size={16} color={colors.text3} strokeWidth={2.6} />
        </GlassCard>
      </Tap>
      <ArtStage height={226}>
        <CityArt width={340} />
      </ArtStage>
      <TourTarget id="city-places">
        <ListGroup>
          {row({
            icon: Trophy,
            title: 'Colosseum',
            subtitle: 'League, duels, Bellum and the map',
            right: atWar ? 'war on' : undefined,
            to: () => router.push('/city/colosseum'),
          })}
          {row({
            icon: Castle,
            title: ludus?.name ?? 'Clan',
            subtitle: 'Your clan, its fortress and wars',
            right: ludusLevel != null ? `lv ${ludusLevel}` : 'join one',
            to: () => router.push('/city/ludus'),
          })}
          {row({
            icon: Landmark,
            title: 'Temple',
            subtitle: 'Your gym’s tribe and its fortress',
            right: gymId ? `lv ${tribeLevel}` : undefined,
            to: () => router.push('/city/temple'),
          })}
          {row({
            icon: Hammer,
            title: 'Forge',
            subtitle: 'Gear and fighting style',
            right: `${owned} pieces`,
            to: () => router.push('/forge'),
          })}
          {row({
            icon: House,
            title: 'Your domus',
            subtitle: 'Your gladiator and home',
            right: `stage ${homeStage(game.rank.id) + 1}`,
            to: () => router.push('/city/domus'),
          })}
          {row({
            icon: Store,
            title: 'Market',
            subtitle: 'Trade for denarii',
            right: 'Soon',
            soon: true,
          })}
          {row({
            icon: Bath,
            title: 'Baths',
            subtitle: 'A bonus for a rest day',
            right: 'Soon',
            soon: true,
          })}
        </ListGroup>
      </TourTarget>
    </Screen>
  );
}

/** The City opened from a link while the game is off. */
function GameOffCard() {
  return (
    <GlassCard radius={22} style={{ gap: 10, padding: 16 }}>
      <Text style={type.bodyStrong}>The game is off</Text>
      <Text style={type.caption}>
        Your workouts still count in the background. Turn the game on to get the City tab back.
      </Text>
      <FillButton
        label="Turn the game on"
        size="sm"
        style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 18 }}
        onPress={() => chooseGame('on')}
      />
    </GlassCard>
  );
}

// ───────────── The forge ─────────────

export function ForgeScreen() {
  const game = useMyGame();
  const glad = useGladiator().data;
  const progress = useGearProgress();
  const wallet = useWallet(game.denariiEarned).data ?? 0;
  const [slot, setSlot] = useState<GearSlot>('helmet');
  const [picked, setPicked] = useState<string | null>(null);
  const buy = useBuyGear();
  const equip = useEquipGear();
  const loadout = useMemo(() => glad?.loadout ?? {}, [glad]);
  const items = gearInSlot(slot);
  const current = worn(loadout, slot);
  const sel = items.find((g) => g.id === picked) ?? null;

  const act = (g: GearItem) => {
    const has = owns(g, progress);
    if (has)
      equip.mutate(g, {
        onSuccess: () => toast(`${g.name} on`),
        onError: (e) => toast(e.message),
      });
    else
      buy.mutate(
        { item: g, wallet },
        {
          onSuccess: () => toast(`${g.name} bought and on`),
          onError: (e) => toast(e.message),
        },
      );
  };

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title="Forge · gear" />
      <ArtStage
        height={220}
        overlay={
          <View style={styles.forgeChips}>
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Fighting style"
              onPress={() => router.push('/style')}
            >
              <Glass radius={999} style={styles.styleChip}>
                <Swords size={14} color={colors.accent} strokeWidth={2.4} />
                <Text style={type.captionStrong}>
                  {glad?.style ? styleDef(glad.style).name : 'Choose a style'}
                </Text>
              </Glass>
            </Tap>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.power, tabular]}>{glad?.power ?? '—'}</Text>
              <Text style={type.small}>gear power</Text>
            </View>
          </View>
        }
      >
        {glad?.style ? (
          <StyleArt style={glad.style} width={180} />
        ) : (
          <GladiatorArt rank={game.rank.id} width={180} />
        )}
      </ArtStage>

      <Segmented
        options={GEAR_SLOTS.map((s) => ({ value: s.id, label: s.plural }))}
        value={slot}
        onChange={(v) => {
          setSlot(v);
          setPicked(null);
        }}
        accessibilityLabel="Gear"
      />

      <View style={styles.grid}>
        {items.map((g) => {
          const has = owns(g, progress);
          const on = current.id === g.id;
          const locked = !has && g.unlock.kind !== 'denarii';
          return (
            <Tap
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`${g.name}, ${on ? 'worn' : has ? 'owned' : unlockText(g.unlock)}`}
              onPress={() => setPicked(g.id)}
              style={styles.cell}
            >
              <Glass
                radius={20}
                style={[
                  styles.tile,
                  on && styles.tileOn,
                  picked === g.id && !on && styles.tilePicked,
                ]}
              >
                {locked ? (
                  <View style={styles.lock}>
                    <Lock size={12} color={colors.text3} strokeWidth={2.4} />
                  </View>
                ) : null}
                <View style={locked && { opacity: 0.45 }}>
                  <GearArt id={g.id} size={72} />
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text
                  style={[styles.tileState, on && { color: colors.accent, fontWeight: '600' }]}
                  numberOfLines={1}
                >
                  {on ? 'worn' : has ? 'owned' : unlockText(g.unlock)}
                </Text>
              </Glass>
            </Tap>
          );
        })}
      </View>

      {sel ? (
        <GlassCard radius={22} style={styles.detail}>
          <View style={styles.detailHead}>
            <Text style={type.bodyStrong}>{sel.name}</Text>
            <Text style={[type.captionStrong, tabular]}>
              power {sel.power}
              {sel.id !== current.id ? (
                <Text style={{ color: sel.power >= current.power ? colors.accent : colors.text2 }}>
                  {`  ${sel.power >= current.power ? '+' : '−'}${Math.abs(sel.power - current.power)}`}
                </Text>
              ) : null}
            </Text>
          </View>
          {sel.id === current.id ? (
            <Text style={type.caption}>You wear it now.</Text>
          ) : owns(sel, progress) ? (
            <FillButton
              label={`Wear the ${sel.name}`}
              icon={Swords}
              loading={equip.isPending}
              onPress={() => act(sel)}
            />
          ) : sel.unlock.kind === 'denarii' ? (
            <FillButton
              label={`Buy for ${sel.unlock.price} denarii`}
              icon={Coins}
              disabled={wallet < sel.unlock.price}
              loading={buy.isPending}
              onPress={() => act(sel)}
            />
          ) : (
            <Text style={type.caption}>Opens {lockText(sel)}. Keep training.</Text>
          )}
          {sel.unlock.kind === 'denarii' && !owns(sel, progress) && wallet < sel.unlock.price ? (
            <Text style={type.small}>You have {fmt(wallet)} denarii.</Text>
          ) : null}
        </GlassCard>
      ) : null}

      <Text style={[type.caption, { textAlign: 'center', paddingHorizontal: 8 }]}>
        Gear adds up to 15 % to your points in tribe wars. You earn it with denarii, levels or
        verified workouts, never with money.
      </Text>
    </Screen>
  );
}

function lockText(g: GearItem): string {
  const u = g.unlock;
  if (u.kind === 'level') return `at level ${u.level}`;
  if (u.kind === 'verified') return `after ${u.count} verified workouts`;
  if (u.kind === 'league')
    return u.league === 'imperator' ? 'in the Imperator’s Arena' : 'in the Gold league';
  return 'from the start';
}

// ───────────── The fighting style ─────────────

export function StyleScreen() {
  const glad = useGladiator().data;
  const choose = useChooseStyle();
  const [picked, setPicked] = useState<StyleId | null>(null);
  const season = seasonOf(new Date());
  const free = canChangeStyle(glad?.styleSeason ?? null, season);
  const chosen = glad?.style ?? null;
  const sel = picked ?? chosen;

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title="Fighting style" fallback="/forge" pill={false} />
      <View style={styles.note}>
        <Text style={type.body}>
          Your style sets your gladiator’s look and the training that earns +{STYLE.xp} XP a
          workout. You can change it once a season.
        </Text>
      </View>
      <View style={styles.grid2}>
        {STYLES.map((s) => {
          const on = sel === s.id;
          return (
            <Tap
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name}, ${s.trait}`}
              onPress={() => setPicked(s.id)}
              style={styles.cell2}
            >
              <Glass radius={22} style={[styles.styleCard, on && styles.tileOn]}>
                <StyleArt style={s.id} width={104} />
                <Text style={[type.rpg, on && { color: colors.accent }]}>{s.name}</Text>
                <Text style={[type.small, { textAlign: 'center' }]} numberOfLines={2}>
                  {s.trait}
                </Text>
              </Glass>
            </Tap>
          );
        })}
      </View>
      {sel ? (
        <GlassCard radius={22} style={styles.detail}>
          <Text style={type.bodyStrong}>{styleDef(sel).name}</Text>
          <Text style={type.caption}>
            +{STYLE.xp} XP: {styleDef(sel).rule.toLowerCase()}.
          </Text>
          {sel === chosen ? (
            <Text style={type.caption}>
              Your style.{' '}
              {free
                ? ''
                : `You can change it from ${seasonName(nextSeason(season)).split(' ')[0]}.`}
            </Text>
          ) : free ? (
            <FillButton
              label={`Fight as ${styleDef(sel).name}`}
              icon={Swords}
              loading={choose.isPending}
              onPress={() =>
                choose.mutate(sel, {
                  onSuccess: () => {
                    toast(`You fight as ${styleDef(sel).name}`);
                    setPicked(null);
                  },
                  onError: (e) => toast(e.message),
                })
              }
            />
          ) : (
            <Text style={type.caption}>
              You chose {chosen ? styleDef(chosen).name : 'a style'} this season. You can change it
              from {seasonName(nextSeason(season)).split(' ')[0]}.
            </Text>
          )}
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
  },
  pillText: { fontSize: 17, fontWeight: '700', color: colors.text },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  gladiator: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  forgeChips: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
  },
  power: { fontSize: 22, fontWeight: '700', color: colors.accent, letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '33.333%', padding: 5 },
  tile: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 2 },
  tileOn: { borderWidth: 1.5, borderColor: colors.accent },
  tilePicked: { borderWidth: 1.5, borderColor: colors.text3 },
  tileName: { fontSize: 13, fontWeight: '600', color: colors.text },
  tileState: { fontSize: 12, color: colors.text2 },
  lock: { position: 'absolute', top: 8, right: 8 },
  detail: { padding: 16, gap: 10 },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  note: { backgroundColor: colors.fill, borderRadius: 18, padding: 14 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell2: { width: '50%', padding: 5 },
  styleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
    boxShadow: shadows.glass,
  },
});
