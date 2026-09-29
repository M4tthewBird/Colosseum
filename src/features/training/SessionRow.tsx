import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ListRow } from '@/components/List';
import { formatDuration } from '@/lib/dates';
import { formatKg, formatVolume, volume } from '@/lib/formulas';
import type { Exercise, Session } from '@/lib/types';
import { colors, type } from '@/theme/tokens';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** The best PR of a session as "Bench 100 kg". */
function bestPr(s: Session, exercises: Record<string, Exercise>): string | null {
  const prs = s.sets.filter((x) => x.is_pr).sort((a, b) => b.weight_kg - a.weight_kg);
  if (!prs[0]) return null;
  const name = exercises[prs[0].exercise_id]?.name.split(' ')[0] ?? 'PR';
  return `${name} ${formatKg(prs[0].weight_kg)} kg`;
}

/** Previous-workout row: weekday + date, name, duration · volume (· best PR), "PR" label. */
export function SessionRow({
  session,
  exercises,
  pending,
  onPress,
}: {
  session: Session;
  exercises: Record<string, Exercise>;
  pending?: boolean;
  /** null makes the row read-only. */
  onPress?: (() => void) | null;
}) {
  const d = new Date(session.started_at);
  const dur = session.finished_at
    ? formatDuration(new Date(session.finished_at).getTime() - d.getTime())
    : 'In progress';
  const pr = bestPr(session, exercises);
  const meta = [dur, formatVolume(session.volume_kg || volume(session.sets)), pr]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      height={64}
      onPress={
        onPress === null
          ? undefined
          : (onPress ??
            (() => router.push({ pathname: '/session/[id]', params: { id: session.id } })))
      }
      left={
        <View style={styles.date}>
          <Text style={styles.dow}>{DOW[d.getDay()]}</Text>
          <Text style={styles.day}>{d.getDate()}</Text>
        </View>
      }
      title={session.name}
      subtitle={
        <Text style={type.caption} numberOfLines={1}>
          {meta}
          {pending ? (
            <Text style={{ color: colors.text2, fontStyle: 'italic' }}> · Not synced yet</Text>
          ) : null}
        </Text>
      }
      right={session.pr_count > 0 ? <Text style={styles.pr}>PR</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  date: { width: 40, alignItems: 'center' },
  dow: { fontSize: 11, fontWeight: '600', color: colors.text2 },
  day: { fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: colors.text },
  pr: { fontSize: 11, fontWeight: '600', color: colors.accent },
});
