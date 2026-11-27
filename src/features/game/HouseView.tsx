/**
 * City → Your domus, at the top: your own house (docs/GAME.md §5a). You upgrade it with your own
 * hours (time at the gym from verified visits) and build a few things by it.
 */
import { Image, StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Check,
  Dumbbell,
  Droplets,
  Grape,
  Hourglass,
  House as HouseIcon,
  Landmark,
  Lock,
  Sprout,
  type LucideIcon,
} from '@/components/icons';
import { SectionHeader } from '@/components/List';
import {
  formatMinutes,
  HOUSE,
  HOUSE_ITEMS,
  houseItemBlock,
  houseName,
  houseUpgradeBlock,
  houseUpgradeMinutes,
  type HouseItemId,
} from '@/lib/game/hours';
import { confirm, toast } from '@/stores/ui';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useBuildHouseItem, useHouse, useUpgradeHouse } from './api';
import { CITY_PIECES } from './city/pieces';

const ITEM_ICONS: Record<HouseItemId, LucideIcon> = {
  hortus: Sprout,
  fountain: Droplets,
  pergola: Grape,
  lararium: Landmark,
  palaestra: Dumbbell,
};

/** The painted house of a level, or the nearest lower one already painted. */
export function housePicture(level: number): string | null {
  for (let n = level; n >= 1; n--) if (CITY_PIECES[`home-${n}`]) return `home-${n}`;
  return null;
}

export function HouseView() {
  const house = useHouse();
  const upgrade = useUpgradeHouse();
  const buildItem = useBuildHouseItem();
  const h = house.data;
  if (!h) {
    return (
      <Text style={type.caption}>
        {house.isError ? 'Could not load your house. Are you online?' : 'Loading your house…'}
      </Text>
    );
  }
  const cost = houseUpgradeMinutes(h.level);
  const block = houseUpgradeBlock(h);
  const picture = housePicture(h.level);
  const art = picture ? CITY_PIECES[picture] : null;
  const artWidth = 228;

  const onUpgrade = async () => {
    if (cost == null) return;
    const ok = await confirm({
      title: `Upgrade to ${houseName(h.level + 1).toLowerCase()}?`,
      message: `Costs ${formatMinutes(cost)} of your own hours.`,
      confirmLabel: 'Upgrade',
    });
    if (ok)
      upgrade.mutate(h, {
        onSuccess: () => toast(`Your house is a ${houseName(h.level + 1).toLowerCase()} now`, true),
        onError: (e) => toast(e.message),
      });
  };

  const onBuild = async (item: HouseItemId, name: string) => {
    const ok = await confirm({
      title: `Build a ${name.toLowerCase()}?`,
      message: `Costs ${HOUSE.itemHours} h of your own hours.`,
      confirmLabel: 'Build',
    });
    if (ok)
      buildItem.mutate(
        { house: h, item },
        { onSuccess: () => toast(`${name} built`, true), onError: (e) => toast(e.message) },
      );
  };

  return (
    <View style={{ gap: 12 }}>
      <GlassCard radius={24} style={styles.card}>
        <View style={styles.stage}>
          {art ? (
            <Image
              source={art.image}
              style={{ width: artWidth, height: (artWidth * art.height) / art.width }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel={houseName(h.level)}
            />
          ) : (
            <HouseIcon size={64} color={colors.text2} strokeWidth={1.4} />
          )}
          <View style={styles.levelChip}>
            <Text style={[styles.levelText, tabular]}>
              Lv {h.level} of {HOUSE.maxLevel}
            </Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={type.rpg}>{houseName(h.level)}</Text>
          <View style={styles.hours}>
            <View style={styles.hourIcon}>
              <Hourglass size={16} color={colors.accent} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, tabular]}>{formatMinutes(h.minutes)} of your own</Text>
              <Text style={type.small}>Every verified visit to the gym adds its time.</Text>
            </View>
          </View>
          {cost != null ? (
            <>
              <FillButton
                label={`Upgrade to ${houseName(h.level + 1).toLowerCase()} · ${formatMinutes(cost)}`}
                icon={HouseIcon}
                disabled={!!block || upgrade.isPending}
                loading={upgrade.isPending}
                onPress={() => void onUpgrade()}
              />
              {block ? (
                <Text style={[type.small, { textAlign: 'center' }, tabular]}>
                  {formatMinutes(Math.max(0, cost - h.minutes))} more at the gym
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={type.caption}>Your house is a palace. There is nothing grander.</Text>
          )}
        </View>
      </GlassCard>

      <SectionHeader title="By your house" />
      <View style={styles.grid}>
        {HOUSE_ITEMS.map((item) => {
          const built = h.items.includes(item.id);
          const itemBlock = houseItemBlock(h, item.id);
          const locked = h.level < HOUSE.itemsFrom;
          const Icon = ITEM_ICONS[item.id];
          const pic = CITY_PIECES[item.id];
          return (
            <Glass key={item.id} radius={20} style={styles.tile}>
              <View style={[styles.itemArt, built && { backgroundColor: accentA(0.08) }]}>
                {pic && built ? (
                  <Image
                    source={pic.image}
                    style={{ width: 64, height: (64 * pic.height) / pic.width }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Icon size={22} color={built ? colors.accent : colors.text2} strokeWidth={2} />
                )}
              </View>
              <Text style={type.bodyStrong} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.small} numberOfLines={2}>
                {item.text}
              </Text>
              {built ? (
                <View style={styles.built}>
                  <Check size={14} color={colors.accent} strokeWidth={2.6} />
                  <Text style={[type.small, { color: colors.accent, fontWeight: '600' }]}>
                    Built
                  </Text>
                </View>
              ) : locked ? (
                <View style={styles.built}>
                  <Lock size={12} color={colors.text2} strokeWidth={2.2} />
                  <Text style={type.small}>From level {HOUSE.itemsFrom}</Text>
                </View>
              ) : (
                <FillButton
                  size="sm"
                  label={`Build · ${HOUSE.itemHours} h`}
                  disabled={!!itemBlock || buildItem.isPending}
                  accessibilityLabel={`Build a ${item.name.toLowerCase()} for ${HOUSE.itemHours} hours`}
                  onPress={() => void onBuild(item.id, item.name)}
                />
              )}
            </Glass>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  stage: {
    height: 214,
    backgroundColor: '#F2EBDB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
  },
  levelChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  body: { padding: 16, gap: 12 },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hourIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', flexGrow: 1, flexBasis: 150, padding: 14, gap: 6 },
  itemArt: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  built: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
});
