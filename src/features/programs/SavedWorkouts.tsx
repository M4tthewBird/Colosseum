import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Play, Plus } from '@/components/icons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { startDay } from '@/features/training/UpNextCard';
import { estimateMinutes } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { colors, type } from '@/theme/tokens';
import { isSavedWorkout } from './ops';

/** Saved one-off workouts, started on demand outside the program. */
export function SavedWorkouts() {
  const programs = useData((s) => s.programs);
  const list = useMemo(
    () =>
      Object.values(programs)
        .filter(isSavedWorkout)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [programs],
  );

  return (
    <View style={{ gap: 8 }}>
      <SectionHeader title="Saved workouts" />
      {list.length > 0 ? (
        <ListGroup>
          {list.map((w) => {
            const day = w.days[0];
            const n = day?.exercises.length ?? 0;
            return (
              <ListRow
                key={w.id}
                height={60}
                title={<Text style={[type.bodyStrong, { fontSize: 16 }]}>{w.name}</Text>}
                subtitle={`${n} exercise${n === 1 ? '' : 's'} · about ${estimateMinutes(day?.exercises ?? [])} min`}
                chevron={false}
                rightInteractive
                accessibilityLabel={`Edit ${w.name}`}
                onPress={() => router.push({ pathname: '/program/[id]', params: { id: w.id } })}
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${w.name}`}
                    disabled={!day || n === 0}
                    onPress={() => day && startDay(day)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.fill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed || n === 0 ? 0.5 : 1,
                    })}
                  >
                    <Play size={15} color={colors.accent} fill={colors.accent} />
                  </Pressable>
                }
              />
            );
          })}
        </ListGroup>
      ) : (
        <Text style={[type.caption, { paddingHorizontal: 4 }]}>
          One-off workouts outside your program, like a quick arm day or a hotel gym session.
        </Text>
      )}
      <FillButton
        label="New saved workout"
        icon={Plus}
        onPress={() =>
          router.push({ pathname: '/program/[id]', params: { id: 'new', kind: 'workout' } })
        }
      />
    </View>
  );
}
