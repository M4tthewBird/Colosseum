import { router } from 'expo-router';
import { Play, Plus } from '@/components/icons';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { openWorkout } from '@/features/workout/actions';
import { estimateMinutes } from '@/lib/formulas';
import type { ProgramDay } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import { type } from '@/theme/tokens';
import { useUpNext } from './hooks';

const askReplace = () =>
  confirm({
    title: 'Workout in progress',
    message: 'Finish or discard the current workout first?',
    confirmLabel: 'Discard and start new',
    cancelLabel: 'Resume current',
    destructive: true,
  });

export function startDay(day: ProgramDay | null) {
  void openWorkout(day, askReplace);
}

/** "Up next" card. Today shows count + duration; Workouts lists the exercises and a "+" button. */
export function UpNextCard({ variant }: { variant: 'today' | 'workouts' }) {
  const { program, day } = useUpNext();
  const exercises = useData((s) => s.exercises);

  if (!program || !day) {
    return (
      <GlassCard style={styles.card}>
        <View style={{ gap: 3 }}>
          <Text style={type.captionStrong}>Up next</Text>
          <Text style={type.title}>No program yet</Text>
          <Text style={type.caption}>Create a program or just start lifting.</Text>
        </View>
        <FillButton
          label="Start empty workout"
          icon={Play}
          iconFill
          onPress={() => startDay(null)}
        />
        <FillButton
          label="Create program"
          icon={Plus}
          onPress={() => router.push({ pathname: '/program/[id]', params: { id: 'new' } })}
        />
      </GlassCard>
    );
  }

  const names = day.exercises
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((e, i) => {
      const n = exercises[e.exercise_id]?.name ?? 'Exercise';
      return i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1);
    });
  const minutes = estimateMinutes(day.exercises);
  const count = day.exercises.length;

  const detail =
    variant === 'today'
      ? `${count} exercise${count === 1 ? '' : 's'} · about ${minutes} min`
      : names.length > 3
        ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
        : names.join(', ') || 'No exercises yet';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.top}>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={type.captionStrong}>Up next</Text>
          <Text style={type.title} numberOfLines={1}>
            {day.name}
          </Text>
          <Text style={type.caption} numberOfLines={2}>
            {detail}
          </Text>
        </View>
        {variant === 'today' ? (
          <TextButton label="Change" onPress={() => router.push('/workouts/programs')} />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <FillButton
          label="Start workout"
          icon={Play}
          iconFill
          onPress={() => startDay(day)}
          style={{ flex: 1 }}
        />
        {variant === 'workouts' ? (
          <IconButton
            icon={Plus}
            size={50}
            accessibilityLabel="Start an empty workout"
            onPress={() => startDay(null)}
          />
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
});
