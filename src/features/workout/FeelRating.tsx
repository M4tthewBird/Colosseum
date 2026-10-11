/**
 * "How did it feel?" after a workout: overall effort (RPE) and four quick ratings. Saved as you
 * tap; used for next-time suggestions, the deload hint and the trend in Profile → Lifts.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Segmented } from '@/components/Segmented';
import { rpeHint } from '@/lib/periodization';
import { FEEL_KEYS } from '@/lib/progression';
import type { Feel, Session } from '@/lib/types';
import { type } from '@/theme/tokens';
import { rateWorkout } from './actions';

const RPE = ['5', '6', '7', '8', '9', '10'] as const;
const SCALE = ['1', '2', '3', '4', '5'] as const;

const LABELS: Record<keyof Feel, string> = {
  energy: 'Energy',
  sleep: 'Sleep',
  pump: 'Pump',
  joints: 'Joints',
};

const NONE = '' as const;

export function FeelRating({ session }: { session: Session }) {
  const feel = session.feel ?? null;
  const setFeel = (k: keyof Feel, v: number) => {
    const base: Feel = feel ?? { energy: 3, sleep: 3, pump: 3, joints: 3 };
    rateWorkout(session.id, { feel: { ...base, [k]: v } });
  };
  return (
    <Glass radius={22} style={styles.card}>
      <Text style={styles.cardTitle}>How did it feel?</Text>
      <View style={{ gap: 6 }}>
        <View style={styles.head}>
          <Text style={type.bodyStrong}>Effort (RPE)</Text>
          <Text style={type.small}>
            {session.rpe ? (session.rpe <= 5 ? 'easy' : rpeHint(session.rpe)) : 'how hard overall'}
          </Text>
        </View>
        <Segmented
          options={RPE.map((v) => ({ value: v, label: v === '5' ? '≤5' : v }))}
          value={session.rpe ? (String(Math.max(5, session.rpe)) as (typeof RPE)[number]) : NONE}
          onChange={(v) => rateWorkout(session.id, { rpe: Number(v) })}
          accessibilityLabel="Effort of the whole workout, RPE"
        />
      </View>
      {FEEL_KEYS.map((k) => (
        <View key={k} style={styles.feelRow}>
          <Text style={[type.bodyStrong, { width: 64 }]}>{LABELS[k]}</Text>
          <Segmented
            style={{ flex: 1 }}
            height={34}
            options={SCALE.map((v) => ({ value: v, label: v }))}
            value={feel ? (String(feel[k]) as (typeof SCALE)[number]) : NONE}
            onChange={(v) => setFeel(k, Number(v))}
            accessibilityLabel={`${LABELS[k]}, 1 bad to 5 great`}
          />
        </View>
      ))}
      <Text style={type.small}>
        1 = bad, 5 = great. Only you can see this, even when you share the workout. Hard workouts
        hold back the next weight increase, and three in a row suggest a lighter week.
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  cardTitle: { ...type.captionStrong },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  feelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
