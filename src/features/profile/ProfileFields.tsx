import { Chip, Segmented } from '@/components/Segmented';
import type { Experience, Goal, Sex } from '@/lib/types';
import { StyleSheet, Text, View } from 'react-native';

import { type } from '@/theme/tokens';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'muscle', label: 'Build muscle' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'lean', label: 'Lose fat' },
  { value: 'health', label: 'Stay healthy' },
];

export function SexSwitch({ value, onChange }: { value: Sex | null; onChange: (s: Sex) => void }) {
  return (
    <Segmented
      compact
      height={30}
      options={SEX_OPTIONS}
      value={(value ?? '') as Sex}
      onChange={onChange}
      accessibilityLabel="Sex"
    />
  );
}

export function ExperiencePicker({
  value,
  onChange,
}: {
  value: Experience | null;
  onChange: (e: Experience) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={[type.caption, styles.label]}>Experience</Text>
      <Segmented
        options={EXPERIENCE_OPTIONS}
        value={(value ?? '') as Experience}
        onChange={onChange}
        accessibilityLabel="Experience"
      />
    </View>
  );
}

export function GoalsPicker({ value, onChange }: { value: Goal[]; onChange: (g: Goal[]) => void }) {
  return (
    <View style={styles.block}>
      <Text style={[type.caption, styles.label]}>Goals</Text>
      <View style={styles.chips} accessibilityLabel="Goals">
        {GOAL_OPTIONS.map((g) => {
          const on = value.includes(g.value);
          return (
            <Chip
              key={g.value}
              label={g.label}
              selected={on}
              check
              onPress={() =>
                onChange(on ? value.filter((x) => x !== g.value) : [...value, g.value])
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
