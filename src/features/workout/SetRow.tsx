import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatKg, parseNumber } from '@/lib/formulas';
import type { SetEntry } from '@/lib/types';
import { colors, tabular } from '@/theme/tokens';
import { toggleSet, updateSet } from './actions';
import { DoneCheck, useDoneProgress, useRowTint } from './DoneCheck';

export const SET_GRID = { n: 30, kg: 64, reps: 52, check: 36, gap: 8 };

export function SetHeader() {
  return (
    <View style={[styles.row, styles.header]}>
      <Text style={[styles.head, { width: SET_GRID.n }]}>Set</Text>
      <Text style={[styles.head, { flex: 1 }]}>Last time</Text>
      <Text style={[styles.head, { width: SET_GRID.kg, textAlign: 'center' }]}>kg</Text>
      <Text style={[styles.head, { width: SET_GRID.reps, textAlign: 'center' }]}>Reps</Text>
      <View style={{ width: SET_GRID.check }} />
    </View>
  );
}

/**
 * Grid 30 / 1fr / 64 / 52 / 36. A done row gets a 7 % accent tint and a red check. Tapping the
 * set number opens the set menu (drop set, failure). A drop set sits under its set, marked "↳".
 */
export const SetRow = memo(function SetRow({
  set,
  last,
  readOnly,
  label,
  onMenu,
}: {
  set: SetEntry;
  last: string;
  readOnly?: boolean;
  /** Shown instead of the set number, e.g. "A1" / "B1" in a superset. */
  label?: string;
  onMenu?: (set: SetEntry) => void;
}) {
  const [kg, setKg] = useState(set.weight_kg ? formatKg(set.weight_kg) : '');
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '');
  const drop = !!set.drop_of;
  const n = drop ? '↳' : (label ?? String(set.set_number));
  const progress = useDoneProgress(set.done);
  const tint = useRowTint(progress);

  // The weight can change from outside (a suggestion applied to every set).
  const [seenKg, setSeenKg] = useState(set.weight_kg);
  if (seenKg !== set.weight_kg) {
    setSeenKg(set.weight_kg);
    if ((parseNumber(kg) ?? 0) !== set.weight_kg) setKg(formatKg(set.weight_kg));
  }

  return (
    <Animated.View style={[styles.row, styles.body, tint]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${drop ? 'Drop set' : `Set ${n}`} options${set.failure ? ', to failure' : ''}`}
        disabled={readOnly || !onMenu}
        onPress={() => onMenu?.(set)}
        hitSlop={{ top: 6, bottom: 6, left: 4 }}
        style={[styles.numCell, { width: SET_GRID.n }]}
      >
        <Text
          style={[styles.num, { color: set.done ? colors.accent : colors.text }]}
          numberOfLines={1}
        >
          {n}
        </Text>
        {set.failure ? <Text style={styles.fail}>F</Text> : null}
      </Pressable>
      <Text style={[styles.last, { flex: 1 }]} numberOfLines={1}>
        {drop ? 'Drop set' : last}
        {set.is_pr ? <Text style={styles.pr}> · PR</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={`Set ${n} weight in kilograms`}
        value={kg}
        editable={!readOnly}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={colors.text3}
        onChangeText={(t) => {
          setKg(t);
          const v = parseNumber(t);
          if (v != null) updateSet(set.id, { weight_kg: v });
          else if (t.trim() === '') updateSet(set.id, { weight_kg: 0 });
        }}
        style={[styles.input, tabular, { width: SET_GRID.kg }]}
      />
      <TextInput
        accessibilityLabel={`Set ${n} reps`}
        value={reps}
        editable={!readOnly}
        keyboardType="number-pad"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={colors.text3}
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9]/g, '').slice(0, 3);
          setReps(clean);
          updateSet(set.id, { reps: clean ? Number(clean) : 0 });
        }}
        style={[styles.input, tabular, { width: SET_GRID.reps }]}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.done }}
        accessibilityLabel={set.done ? `Set ${n} done` : `Mark set ${n} done`}
        disabled={readOnly}
        onPress={() => toggleSet(set.id)}
        hitSlop={6}
        style={{ width: SET_GRID.check, alignItems: 'center' }}
      >
        <DoneCheck done={set.done} pr={set.is_pr} progress={progress} />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SET_GRID.gap, paddingHorizontal: 4 },
  header: { paddingBottom: 2 },
  body: { height: 44, borderRadius: 14 },
  head: { fontSize: 12, color: colors.text2 },
  numCell: { height: 44, justifyContent: 'center' },
  num: { fontSize: 15, fontWeight: '600' },
  fail: {
    position: 'absolute',
    right: -2,
    top: 5,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
  },
  last: { fontSize: 14, color: colors.text2 },
  pr: { color: colors.accent, fontWeight: '700', fontSize: 12 },
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
});
