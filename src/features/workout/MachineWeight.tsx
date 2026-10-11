/**
 * The weight of a machine itself (sled, carriage, Smith bar), saved per exercise. Information
 * only: it is shown next to the records and not added to volume or PRs.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Sheet } from '@/components/Sheet';
import { formatKg, parseNumber } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { colors, tabular, type } from '@/theme/tokens';

export function MachineWeight({ exerciseId, name }: { exerciseId: string; name: string }) {
  const kg = useData((s) => s.exercisePrefs[exerciseId]?.machine_kg ?? null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          kg != null ? `Machine weight ${formatKg(kg)} kg, edit` : 'Add machine weight'
        }
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.record, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={type.small}>Machine</Text>
        <Text style={[styles.value, tabular, kg == null && { color: colors.accent }]}>
          {kg != null ? `${formatKg(kg)} kg` : '+ Add'}
        </Text>
      </Pressable>
      <MachineWeightSheet
        visible={open}
        exerciseId={exerciseId}
        name={name}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function MachineWeightSheet({
  visible,
  exerciseId,
  name,
  onClose,
}: {
  visible: boolean;
  exerciseId: string;
  name: string;
  onClose: () => void;
}) {
  const kg = useData((s) => s.exercisePrefs[exerciseId]?.machine_kg ?? null);
  const setMachineWeight = useData((s) => s.setMachineWeight);
  const [text, setText] = useState(kg != null ? formatKg(kg) : '');
  const value = parseNumber(text);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Machine weight"
      doneLabel="Save"
      doneDisabled={text.trim() !== '' && value == null}
      onDone={() => {
        setMachineWeight(exerciseId, text.trim() === '' ? null : value);
        onClose();
      }}
    >
      <FormGroup>
        <FormField
          label={name}
          labelWidth={170}
          value={text}
          onChangeText={setText}
          placeholder="0"
          keyboardType="decimal-pad"
          suffix="kg"
          align="right"
        />
      </FormGroup>
      <FieldHint text="What the machine weighs before plates, e.g. the hack squat sled. For reference only: log the plates as usual. Leave it empty to remove it." />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  record: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  value: { fontSize: 16, fontWeight: '700', color: colors.text },
});
