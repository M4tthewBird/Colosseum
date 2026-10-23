/** Badge grid (Profile, another user's profile), the detail sheet and the summary card. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/Charts';
import { Glass, GlassCard } from '@/components/Glass';
import { Sheet } from '@/components/Sheet';
import { badgeLevel, type BadgeDef, type BadgeStatus, type EarnedTier } from '@/lib/badges';
import { shortDate } from '@/lib/dates';
import { colors, tabular, type } from '@/theme/tokens';
import { Medallion } from './Medallion';

/** The tier a badge shows: its highest earned one, or the first to go for. */
function shownTier(b: BadgeStatus): { threshold: number; index: number; earned: boolean } {
  const top = b.earned[b.earned.length - 1];
  if (top)
    return { threshold: top.threshold, index: b.def.tiers.indexOf(top.threshold), earned: true };
  return { threshold: b.def.tiers[0], index: 0, earned: false };
}

export function BadgeMedal({ b, size = 64 }: { b: BadgeStatus; size?: number }) {
  const t = shownTier(b);
  return (
    <Medallion
      icon={b.def.icon}
      level={badgeLevel(t.index, b.def.tiers.length)}
      earned={t.earned}
      size={size}
      value={t.threshold}
    />
  );
}

/**
 * Earned badges first (highest tiers first), then the rest with how close they are. `progress`
 * off (another user's profile) shows earned badges only.
 */
export function BadgeGrid({
  badges,
  progress = true,
}: {
  badges: BadgeStatus[];
  progress?: boolean;
}) {
  const [open, setOpen] = useState<BadgeStatus | null>(null);
  const earned = badges
    .filter((b) => b.earned.length)
    .sort(
      (a, b) =>
        b.earned.length / b.def.tiers.length - a.earned.length / a.def.tiers.length ||
        a.def.name.localeCompare(b.def.name),
    );
  const locked = progress ? badges.filter((b) => !b.earned.length) : [];
  const count = badges.reduce((n, b) => n + b.earned.length, 0);
  const total = badges.reduce((n, b) => n + b.def.tiers.length, 0);

  return (
    <View style={{ gap: 10 }}>
      {progress ? (
        <Text style={[type.caption, { paddingHorizontal: 4 }]}>
          {count} of {total} badges · tap one to see its tiers
        </Text>
      ) : null}
      {earned.length === 0 && !progress ? (
        <Glass radius={22} style={{ padding: 16 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>No badges yet.</Text>
        </Glass>
      ) : null}
      <Glass radius={22} style={styles.grid}>
        {[...earned, ...locked].map((b) => {
          const t = shownTier(b);
          const pct = b.next ? Math.min(1, b.value / b.next) : 1;
          return (
            <Pressable
              key={b.def.id}
              accessibilityRole="button"
              accessibilityLabel={`${b.def.name}: ${t.earned ? b.def.tierTitle(t.threshold) : `not yet, ${b.def.format(b.value)}`}`}
              onPress={() => setOpen(b)}
              style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
            >
              <BadgeMedal b={b} />
              <Text style={styles.name} numberOfLines={2}>
                {t.earned ? b.def.tierTitle(t.threshold) : b.def.name}
              </Text>
              {progress && b.next ? (
                <View style={{ width: '80%' }}>
                  <ProgressBar value={pct} height={4} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Glass>
      <BadgeSheet badge={open} progress={progress} onClose={() => setOpen(null)} />
    </View>
  );
}

function BadgeSheet({
  badge: b,
  progress,
  onClose,
}: {
  badge: BadgeStatus | null;
  progress: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!b} onClose={onClose} title={b?.def.name ?? ''}>
      {b ? (
        <>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <BadgeMedal b={b} size={120} />
            <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>{b.def.about}</Text>
            {progress ? (
              <Text style={[type.bodyStrong, tabular]}>
                {b.def.format(b.value)}
                {b.next ? ` · next ${b.def.tierTitle(b.next)}` : ' · every tier done'}
              </Text>
            ) : null}
          </View>
          <Glass radius={20} style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
            {b.def.tiers.map((t, i) => {
              const got = b.earned.find((e) => e.threshold === t);
              return (
                <View key={t} style={styles.tier}>
                  {/* Tiers still to earn show what they will look like, faded. */}
                  <View style={{ opacity: got ? 1 : 0.3 }}>
                    <Medallion
                      icon={b.def.icon}
                      level={badgeLevel(i, b.def.tiers.length)}
                      earned
                      size={40}
                      value={t}
                    />
                  </View>
                  <Text style={[type.body, { flex: 1 }, !got && { color: colors.text2 }]}>
                    {b.def.tierTitle(t)}
                  </Text>
                  <Text style={type.small}>
                    {got?.at ? shortDate(new Date(got.at)) : got ? '✓' : ''}
                  </Text>
                </View>
              );
            })}
          </Glass>
        </>
      ) : null}
    </Sheet>
  );
}

/** "New badge" card in the workout summary. */
export function NewBadges({
  items,
}: {
  items: { def: BadgeDef; tier: EarnedTier; index: number }[];
}) {
  if (!items.length) return null;
  return (
    <GlassCard radius={24} style={{ gap: 12, padding: 16 }} accessibilityLabel="New badges">
      <Text style={type.captionStrong}>
        {items.length === 1 ? 'New badge' : `${items.length} new badges`}
      </Text>
      <View style={styles.newRow}>
        {items.map((x) => (
          <View key={x.def.id} style={styles.newCell}>
            <Medallion
              icon={x.def.icon}
              level={badgeLevel(x.index, x.def.tiers.length)}
              earned
              size={76}
              value={x.tier.threshold}
            />
            <Text style={styles.name} numberOfLines={2}>
              {x.def.tierTitle(x.tier.threshold)}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 12,
    paddingHorizontal: 4,
    rowGap: 14,
  },
  cell: { width: '33.33%', alignItems: 'center', gap: 4, minHeight: 44 },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  newRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  newCell: { width: 96, alignItems: 'center', gap: 4 },
});
