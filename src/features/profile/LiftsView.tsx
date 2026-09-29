import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/Charts';
import { Glass } from '@/components/Glass';
import { ListGroup, ListRow } from '@/components/List';
import { formatKg, formatVolume } from '@/lib/formulas';
import { liftsSummary, totalPrs, totalVolume } from '@/lib/stats';
import type { Exercise, Session } from '@/lib/types';
import { colors, type } from '@/theme/tokens';

const BIG3 = ['bench press', 'squat', 'deadlift'];

/** Summary tiles (Big 3, PRs, Lifted all time) and the list of logged exercises. */
export function LiftsView({
  sessions,
  exercises,
  onPressExercise,
}: {
  sessions: Session[];
  exercises: Record<string, Exercise>;
  onPressExercise?: (exerciseId: string) => void;
}) {
  const lifts = useMemo(() => liftsSummary(sessions), [sessions]);
  const big3 = useMemo(() => {
    let total = 0;
    for (const l of lifts) {
      const n = exercises[l.exerciseId]?.name.toLowerCase();
      if (n && BIG3.includes(n) && !exercises[l.exerciseId]?.created_by) total += l.best.e1rm;
    }
    return total;
  }, [lifts, exercises]);

  return (
    <>
      <Glass radius={22} style={styles.tiles}>
        <Tile value={big3 ? `${Math.round(big3)} kg` : '—'} label="Big 3 total" border />
        <Tile value={String(totalPrs(sessions))} label="PRs" border />
        <Tile value={formatVolume(totalVolume(sessions))} label="Lifted all time" />
      </Glass>
      {lifts.length > 0 ? (
        <ListGroup>
          {lifts.map((l) => {
            const name = exercises[l.exerciseId]?.name ?? 'Exercise';
            return (
              <ListRow
                key={l.exerciseId}
                height={58}
                title={name}
                subtitle={`Best ${formatKg(l.best.weight)} kg × ${l.best.reps}`}
                onPress={onPressExercise ? () => onPressExercise(l.exerciseId) : undefined}
                chevron={!!onPressExercise}
                right={
                  <>
                    <Sparkline
                      values={l.spark}
                      width={52}
                      height={22}
                      strokeWidth={2}
                      dot={false}
                      accessibilityLabel={`${name} estimated 1RM trend`}
                    />
                    <Text style={styles.gain}>
                      {l.gain == null
                        ? '—'
                        : `${l.gain >= 0 ? '+' : '−'}${formatKg(Math.abs(l.gain))} kg`}
                    </Text>
                  </>
                }
              />
            );
          })}
        </ListGroup>
      ) : (
        <Glass radius={22} style={{ padding: 16 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>No lifts logged yet.</Text>
        </Glass>
      )}
    </>
  );
}

function Tile({ value, label, border }: { value: string; label: string; border?: boolean }) {
  return (
    <View style={[styles.tile, border && styles.tileBorder]}>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: colors.text2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { paddingVertical: 12, flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  tileBorder: { borderRightWidth: 0.5, borderRightColor: colors.separator },
  tileValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  gain: { width: 54, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.accent },
});
