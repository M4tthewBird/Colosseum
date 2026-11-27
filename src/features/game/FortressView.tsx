/**
 * A fortress (of a ludus or a gym): its hours (the time its members spent at the gym, from
 * verified visits) and the buildings with their level, what they do, what the next level costs in
 * hours, and the one being built (docs/GAME.md §5).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Anvil,
  ChevronRight,
  Church,
  Dumbbell,
  Fence,
  Hammer,
  Hourglass,
  Tent,
  Warehouse,
  type LucideIcon,
} from '@/components/icons';
import {
  buildDays,
  buildingsFor,
  currentLevel,
  fortressLevel,
  fortressStage,
  FORTRESS_STAGES,
  levelMinutes,
  repairMinutes,
  timeLeftText,
  underConstruction,
  type Building,
  type BuildingDef,
  type BuildingId,
  type OwnerKind,
} from '@/lib/game/fortress';
import { rootPicture } from '@/lib/game/grounds';
import { formatMinutes } from '@/lib/game/hours';
import { useNow } from '@/lib/useNow';
import { confirm, toast } from '@/stores/ui';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useFortress, useRepairBuilding, useStartBuilding } from './api';
import { CITY_PIECES } from './city/pieces';

const ICONS: Record<BuildingId, LucideIcon> = {
  bench: Dumbbell,
  rack: Warehouse,
  cable: Anvil,
  platform: Hammer,
  palisade: Fence,
  barracks: Tent,
  temple: Church,
};

export function FortressView({
  kind,
  id,
  title,
  extra,
}: {
  kind: OwnerKind;
  id: string;
  title: string;
  /** Shown under a temple: the records it honours. */
  extra?: React.ReactNode;
}) {
  const fortress = useFortress(kind, id);
  const now = useNow(true, 60000);
  const start = useStartBuilding();
  const repair = useRepairBuilding();
  const data = fortress.data;
  if (!data) {
    return (
      <Text style={type.caption}>
        {fortress.isError ? 'Could not load. Are you online?' : 'Loading…'}
      </Text>
    );
  }
  const busy = data.buildings.find((b) => underConstruction(b, new Date(now)));
  const byId = new Map(data.buildings.map((b) => [b.building, b]));

  const build = async (def: BuildingDef, b: Building | undefined) => {
    const next = currentLevel(b, new Date(now)) + 1;
    const cost = formatMinutes(levelMinutes(def.id, next, kind));
    const ok = await confirm({
      title: `${b ? 'Upgrade' : 'Build'} ${def.name}?`,
      message: `Level ${next}: ${def.effect(next, kind)}. Costs ${cost} of the treasury’s hours and takes ${buildDays(next)} day${buildDays(next) === 1 ? '' : 's'}.`,
      confirmLabel: b ? 'Upgrade' : 'Build',
    });
    if (ok)
      start.mutate(
        { kind, id, building: def.id },
        {
          onSuccess: () => toast(`${def.name}: building started`, true),
          onError: (e) => toast(e.message),
        },
      );
  };

  const fix = async (def: BuildingDef, b: Building) => {
    const cost = formatMinutes(repairMinutes(def.id, Math.max(1, currentLevel(b)), kind));
    const ok = await confirm({
      title: `Repair ${def.name}?`,
      message: `It was damaged in a war and gives nothing until repaired. Costs ${cost} of the treasury’s hours.`,
      confirmLabel: 'Repair',
    });
    if (ok)
      repair.mutate(
        { kind, id, building: def.id },
        { onSuccess: () => toast(`${def.name} repaired`, true), onError: (e) => toast(e.message) },
      );
  };

  const total = fortressLevel(data.buildings, new Date(now));
  const stage = fortressStage(total);
  const here = FORTRESS_STAGES[stage];
  const ahead = FORTRESS_STAGES[stage + 1];

  return (
    <View style={{ gap: 12 }}>
      <GroundEntry kind={kind} id={id} title={title} stage={stage} />
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <Text style={type.bodyStrong}>
          {here.name} · <Text style={tabular}>lv {total}</Text>
        </Text>
        {ahead ? (
          <>
            <ProgressBar value={(total - here.from) / (ahead.from - here.from)} height={5} />
            <Text style={type.small}>
              At level {ahead.from} it becomes{' '}
              {ahead.name === 'Colosseum' ? 'the Colosseum' : `a ${ahead.name.toLowerCase()}`}.
              Every building level counts.
            </Text>
          </>
        ) : (
          <Text style={type.small}>The fortress is a Colosseum.</Text>
        )}
      </View>
      <GlassCard radius={22} style={styles.treasury}>
        <View style={styles.coin}>
          <Hourglass size={20} color={colors.accent} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.small}>Hours to build with</Text>
          <Text style={[styles.big, tabular]}>{formatMinutes(data.treasury)}</Text>
          <Text style={type.small}>
            {kind === 'gym'
              ? 'Every verified visit to this gym adds its time.'
              : 'Every member’s verified visit to the gym adds its time.'}
          </Text>
        </View>
      </GlassCard>

      <View style={styles.grid}>
        {buildingsFor(kind).map((def) => {
          const b = byId.get(def.id);
          const level = currentLevel(b, new Date(now));
          const building = underConstruction(b, new Date(now));
          const Icon = ICONS[def.id];
          const top = level >= def.maxLevel;
          const next = level + 1;
          return (
            <Glass key={def.id} radius={20} style={styles.tile}>
              <View style={styles.tileHead}>
                <View
                  style={[
                    styles.tileIcon,
                    level > 0 && !b?.damaged && { backgroundColor: accentA(0.08) },
                  ]}
                >
                  <Icon
                    size={20}
                    color={level > 0 && !b?.damaged ? colors.accent : colors.text2}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.pips} accessibilityLabel={`Level ${level} of ${def.maxLevel}`}>
                  {Array.from({ length: def.maxLevel }, (_, i) => (
                    <View key={i} style={[styles.pip, i < level && styles.pipOn]} />
                  ))}
                </View>
              </View>
              <Text style={type.bodyStrong} numberOfLines={1}>
                {def.name}
              </Text>
              <Text style={type.small} numberOfLines={2}>
                {b?.damaged
                  ? 'Damaged in a war: no effect'
                  : level
                    ? def.effect(level, kind)
                    : def.effect(1, kind)}
              </Text>
              {building && b?.ready_at ? (
                <View style={{ gap: 4 }}>
                  <ProgressBar
                    value={
                      1 -
                      (new Date(b.ready_at).getTime() - now) /
                        (buildDays(b.target_level ?? 1) * 86400000)
                    }
                    height={4}
                  />
                  <Text style={[type.small, tabular]}>
                    <Hourglass size={11} color={colors.text2} /> Level {b.target_level} in{' '}
                    {timeLeftText(b.ready_at, new Date(now))}
                  </Text>
                </View>
              ) : b?.damaged ? (
                <FillButton
                  size="sm"
                  label="Repair"
                  icon={Hammer}
                  onPress={() => void fix(def, b)}
                />
              ) : top ? (
                <Text style={[type.small, { color: colors.accent, fontWeight: '600' }]}>
                  Top level
                </Text>
              ) : (
                <FillButton
                  size="sm"
                  label={`${level ? 'Lv ' + next : 'Build'} · ${formatMinutes(levelMinutes(def.id, next, kind))}`}
                  icon={Hammer}
                  disabled={!!busy || start.isPending}
                  accessibilityLabel={`${level ? 'Upgrade' : 'Build'} ${def.name} for ${formatMinutes(levelMinutes(def.id, next, kind))}`}
                  onPress={() => void build(def, b)}
                />
              )}
            </Glass>
          );
        })}
      </View>
      {busy ? (
        <Text style={[type.small, { textAlign: 'center' }]}>
          One building at a time: wait for the one being built.
        </Text>
      ) : null}
      {extra}
    </View>
  );
}

/** The painted heart of the training ground; it opens the grid you build on. */
function GroundEntry({
  kind,
  id,
  title,
  stage,
}: {
  kind: OwnerKind;
  id: string;
  title: string;
  stage: number;
}) {
  const pic = CITY_PIECES[rootPicture(kind, stage, 1)];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/city/ground', params: { kind, id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open the training ground of ${title}`}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <GlassCard radius={24} style={styles.entry}>
        <View style={styles.stage}>
          {pic ? (
            <Image
              source={pic.image}
              style={{ width: 250, height: (250 * pic.height) / pic.width }}
              contentFit="contain"
              accessible={false}
            />
          ) : null}
          <Text style={[type.rpg, styles.stageTitle]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.enter}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.bodyStrong}>Training ground</Text>
            <Text style={type.small}>Build machines, walls and drill on a grid</Text>
          </View>
          <ChevronRight size={18} color={colors.text2} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: { padding: 0, overflow: 'hidden' },
  stage: {
    height: 200,
    backgroundColor: '#F2EBDB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  stageTitle: { position: 'absolute', top: 12, left: 14 },
  enter: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  treasury: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', flexGrow: 1, flexBasis: 150, padding: 14, gap: 6 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.fillStrong },
  pipOn: { backgroundColor: colors.accent },
});
