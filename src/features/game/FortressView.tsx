/**
 * A fortress (of a ludus or a gym): the treasury, a gift from your wallet, and the buildings with
 * their level, what they do, what the next level costs, and the one being built.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ArtStage, FortressArt } from '@/components/art/Art';
import { FillButton } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { FormField, FormGroup } from '@/components/Form';
import { Glass, GlassCard } from '@/components/Glass';
import {
  Anvil,
  Church,
  Coins,
  Dumbbell,
  Fence,
  Hammer,
  Hourglass,
  Tent,
  Warehouse,
  type LucideIcon,
} from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import {
  buildDays,
  buildingsFor,
  currentLevel,
  fortressLevel,
  fortressStage,
  FORTRESS_STAGES,
  levelCost,
  repairCost,
  timeLeftText,
  underConstruction,
  type Building,
  type BuildingDef,
  type BuildingId,
  type OwnerKind,
} from '@/lib/game/fortress';
import { useNow } from '@/lib/useNow';
import { confirm, toast } from '@/stores/ui';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useDonate, useFortress, useRepairBuilding, useStartBuilding, useWallet } from './api';
import { useMyGame } from './hooks';

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
  const [giving, setGiving] = useState(false);
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
    const cost = levelCost(def.id, next, kind);
    const ok = await confirm({
      title: `${b ? 'Upgrade' : 'Build'} ${def.name}?`,
      message: `Level ${next}: ${def.effect(next, kind)}. Costs ${cost} denarii from the treasury and takes ${buildDays(next)} day${buildDays(next) === 1 ? '' : 's'}.`,
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
    const cost = repairCost(def.id, Math.max(1, currentLevel(b)), kind);
    const ok = await confirm({
      title: `Repair ${def.name}?`,
      message: `It was damaged in a war and gives nothing until repaired. Costs ${cost} denarii.`,
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
      <ArtStage
        height={200}
        overlay={
          <Text style={type.rpg} numberOfLines={1}>
            {title}
          </Text>
        }
      >
        <FortressArt stage={stage} width={stage === 3 ? 215 : 230} />
      </ArtStage>
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
          <Coins size={20} color={colors.accent} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.small}>{title} treasury</Text>
          <Text style={[styles.big, tabular]}>{data.treasury.toLocaleString('en-US')} denarii</Text>
        </View>
        <FillButton size="sm" label="Give" icon={Coins} onPress={() => setGiving(true)} />
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
                  label={`${level ? 'Lv ' + next : 'Build'} · ${levelCost(def.id, next, kind)}`}
                  icon={Hammer}
                  disabled={!!busy || start.isPending}
                  accessibilityLabel={`${level ? 'Upgrade' : 'Build'} ${def.name} for ${levelCost(def.id, next, kind)} denarii`}
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
      {giving ? (
        <GiveSheet kind={kind} id={id} title={title} onClose={() => setGiving(false)} />
      ) : null}
    </View>
  );
}

function GiveSheet({
  kind,
  id,
  title,
  onClose,
}: {
  kind: OwnerKind;
  id: string;
  title: string;
  onClose: () => void;
}) {
  const { denariiEarned } = useMyGame();
  const wallet = useWallet(denariiEarned);
  const donate = useDonate();
  const [text, setText] = useState('');
  const amount = Math.floor(Number(text.replace(/\s/g, '')) || 0);
  const have = wallet.data ?? 0;
  const send = () =>
    donate.mutate(
      { kind, id, amount, wallet: have },
      {
        onSuccess: () => {
          toast(`${amount} denarii given to ${title}`, true);
          onClose();
        },
        onError: (e) => toast(e.message),
      },
    );
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Give to ${title}`}
      doneLabel="Give"
      onDone={send}
      doneDisabled={amount <= 0 || amount > have || donate.isPending}
    >
      <Text style={[type.caption, tabular]}>
        Your wallet: {wallet.isLoading ? '…' : `${have} denarii`}. Denarii come from training; give
        them to build together.
      </Text>
      <FormGroup>
        <FormField
          label="Denarii"
          keyboardType="number-pad"
          value={text}
          onChangeText={setText}
          placeholder="0"
          autoFocus
        />
      </FormGroup>
      <View style={styles.quick}>
        {[25, 50, 100].map((n) => (
          <FillButton
            key={n}
            size="sm"
            label={String(n)}
            disabled={n > have}
            onPress={() => setText(String(n))}
          />
        ))}
        <FillButton size="sm" label="All" disabled={!have} onPress={() => setText(String(have))} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
