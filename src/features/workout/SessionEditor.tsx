/**
 * Correcting a finished workout: weight, reps, failure, removing a set or adding a forgotten one.
 * Works on a copy; nothing changes until Save. Saving works offline like any other write.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { Plus, X } from '@/components/icons';
import { clampWeight, formatKg, isSideSet, parseNumber, sideReps } from '@/lib/formulas';
import { dropChain, isMain } from '@/lib/dropsets';
import { addEditedSet, hasEmptySet, removeEditedSet } from '@/lib/sessionEdit';
import type { Session, SetEntry } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';
import { saveEditedSession } from './actions';
import { cleanReps, SET_GRID } from './SetRow';

export function SessionEditor({ session, onClose }: { session: Session; onClose: () => void }) {
  const exercises = useData((s) => s.exercises);
  const [sets, setSets] = useState(session.sets);
  const [error, setError] = useState<string | null>(null);

  const change = (next: (list: SetEntry[]) => SetEntry[]) => {
    setError(null);
    setSets(next);
  };
  const patch = (id: string, fields: Partial<SetEntry>) =>
    change((list) => list.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  const save = () => {
    if (sets.length === 0)
      return setError('A workout needs at least one set. To remove all of it, delete the workout.');
    if (hasEmptySet(sets))
      return setError('Some sets have no reps. Fill them in or remove those sets.');
    saveEditedSession({ ...session, sets });
    toast('Workout updated');
    onClose();
  };

  const positions = [...new Set(sets.map((x) => x.exercise_position))].sort((a, b) => a - b);

  return (
    <>
      {positions.map((pos) => {
        const mine = sets.filter((x) => x.exercise_position === pos);
        const mains = mine.filter(isMain).sort((a, b) => a.set_number - b.set_number);
        return (
          <Glass key={pos} radius={22} style={{ padding: 16, gap: 8 }}>
            <Text style={[type.bodyStrong, { fontSize: 17 }]}>
              {exercises[mine[0].exercise_id]?.name ?? 'Exercise'}
            </Text>
            {mains.map((m) =>
              [m, ...dropChain(mine, m.id)].map((x) => (
                <EditRow
                  key={x.id}
                  set={x}
                  onChange={patch}
                  onRemove={() => change((list) => removeEditedSet(list, x.id))}
                />
              )),
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add a set to ${exercises[mine[0].exercise_id]?.name ?? 'this exercise'}`}
              onPress={() => change((list) => addEditedSet(list, pos, uuid()))}
              style={({ pressed }) => [styles.add, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Plus size={15} color={colors.accent} strokeWidth={2.6} />
              <Text style={type.captionStrong}>Add a set</Text>
            </Pressable>
          </Glass>
        );
      })}
      {sets.length === 0 ? <Text style={type.caption}>No sets left.</Text> : null}
      {error ? <FieldHint text={error} error /> : null}
      <FillButton label="Save changes" onPress={save} />
      <FillButton label="Cancel" onPress={onClose} />
    </>
  );
}

function EditRow({
  set,
  onChange,
  onRemove,
}: {
  set: SetEntry;
  onChange: (id: string, change: Partial<SetEntry>) => void;
  onRemove: () => void;
}) {
  const [kg, setKg] = useState(set.weight_kg ? formatKg(set.weight_kg) : '');
  const label = set.drop_of ? '↳' : set.warmup ? 'W' : String(set.set_number);
  const name = set.drop_of ? 'Drop set' : set.warmup ? 'Warm-up' : `Set ${set.set_number}`;
  const sides = isSideSet(set);
  const repsBox = (value: number, what: string, width: number, write: (n: number) => void) => (
    <TextInput
      accessibilityLabel={`${name} ${what}`}
      defaultValue={value ? String(value) : ''}
      keyboardType="number-pad"
      selectTextOnFocus
      placeholder="0"
      placeholderTextColor={colors.text3}
      onChangeText={(t) => write(Number(cleanReps(t)))}
      maxLength={3}
      style={[styles.input, tabular, { width }]}
    />
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.num, { width: 22 }]}>{label}</Text>
      <TextInput
        accessibilityLabel={`${name} weight in kilograms`}
        value={kg}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={colors.text3}
        onChangeText={(t) => {
          const v = parseNumber(t);
          const capped = v == null ? 0 : clampWeight(v);
          setKg(v != null && capped !== v ? String(capped) : t);
          onChange(set.id, { weight_kg: capped });
        }}
        style={[styles.input, tabular, { width: SET_GRID.kg }]}
      />
      <Text style={styles.unit}>kg</Text>
      {sides ? (
        <>
          {repsBox(set.left_reps ?? 0, 'reps, left side', SET_GRID.side, (n) =>
            onChange(set.id, sideReps(n, set.right_reps ?? 0)),
          )}
          {repsBox(set.right_reps ?? 0, 'reps, right side', SET_GRID.side, (n) =>
            onChange(set.id, sideReps(set.left_reps ?? 0, n)),
          )}
        </>
      ) : (
        <>
          {repsBox(set.reps, 'reps', SET_GRID.reps, (n) => onChange(set.id, { reps: n }))}
          <Text style={styles.unit}>reps</Text>
        </>
      )}
      <View style={{ flex: 1 }} />
      {set.warmup ? null : (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!set.failure }}
          accessibilityLabel={`${name} taken to failure`}
          onPress={() => onChange(set.id, { failure: !set.failure })}
          hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
          style={[styles.fail, set.failure && styles.failOn]}
        >
          <Text style={[styles.failText, set.failure && { color: colors.white }]}>F</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name.toLowerCase()}`}
        onPress={onRemove}
        hitSlop={{ top: 9, bottom: 9, left: 4, right: 8 }}
        style={styles.remove}
      >
        <X size={15} color={colors.text2} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  num: { fontSize: 15, fontWeight: '600', color: colors.text },
  unit: { fontSize: 13, color: colors.text2, marginRight: 4 },
  input: {
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.fill,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    padding: 0,
  },
  fail: {
    width: SET_GRID.fail,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failOn: { backgroundColor: colors.accent },
  failText: { fontSize: 12, fontWeight: '800', color: colors.text2 },
  remove: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  add: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
