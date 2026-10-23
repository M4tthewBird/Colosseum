import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatKg, isSideSet, parseNumber } from '@/lib/formulas';
import type { SetEntry } from '@/lib/types';
import { colors, tabular } from '@/theme/tokens';
import { toggleSet, updateSet, updateSide } from './actions';
import { DoneCheck, useDoneProgress, useRowTint } from './DoneCheck';

/** A per-side set has two reps boxes (left, right) of `side` each, `sideGap` apart. */
export const SET_GRID = { n: 30, kg: 64, reps: 52, side: 44, sideGap: 4, check: 36, gap: 8 };
const SIDES_WIDTH = SET_GRID.side * 2 + SET_GRID.sideGap;

export function SetHeader({ sides }: { sides?: boolean }) {
  return (
    <View style={[styles.row, styles.header]}>
      <Text style={[styles.head, { width: SET_GRID.n }]}>Set</Text>
      <Text style={[styles.head, { flex: 1 }]}>Last time</Text>
      <Text style={[styles.head, { width: SET_GRID.kg, textAlign: 'center' }]}>kg</Text>
      {sides ? (
        <View style={{ width: SIDES_WIDTH, flexDirection: 'row', gap: SET_GRID.sideGap }}>
          <Text style={[styles.head, styles.sideHead]}>Left</Text>
          <Text style={[styles.head, styles.sideHead]}>Right</Text>
        </View>
      ) : (
        <Text style={[styles.head, { width: SET_GRID.reps, textAlign: 'center' }]}>Reps</Text>
      )}
      <View style={{ width: SET_GRID.check }} />
    </View>
  );
}

/** Digits only, at most 3. */
const cleanReps = (t: string) => t.replace(/[^0-9]/g, '').slice(0, 3);

/**
 * Grid 30 / 1fr / 64 / 52 / 36. A done row gets a 7 % accent tint and a red check. Tapping the
 * set number opens the set menu (drop set, failure). A drop set sits under its set, marked "↳".
 * A per-side set has a left and a right reps box instead of one.
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
  const sides = isSideSet(set);
  const [left, setLeft] = useState(set.left_reps ? String(set.left_reps) : '');
  const [right, setRight] = useState(set.right_reps ? String(set.right_reps) : '');
  const drop = !!set.drop_of;

  // Switching the exercise to per side (or back) changes the reps from outside.
  const [seenSides, setSeenSides] = useState(sides);
  if (seenSides !== sides) {
    setSeenSides(sides);
    setReps(set.reps ? String(set.reps) : '');
    setLeft(set.left_reps ? String(set.left_reps) : '');
    setRight(set.right_reps ? String(set.right_reps) : '');
  }
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
        accessibilityLabel={`${drop ? 'Drop set' : set.warmup ? 'Warm-up set' : `Set ${n}`} options${set.failure ? ', to failure' : ''}`}
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
        {/* Says the number opens the set menu. */}
        {!readOnly && onMenu ? (
          <Text style={styles.more} aria-hidden>
            •••
          </Text>
        ) : null}
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
      {sides ? (
        <View style={{ width: SIDES_WIDTH, flexDirection: 'row', gap: SET_GRID.sideGap }}>
          <TextInput
            accessibilityLabel={`Set ${n} reps, left side`}
            value={left}
            editable={!readOnly}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholder="L"
            placeholderTextColor={colors.text3}
            onChangeText={(t) => {
              const clean = cleanReps(t);
              setLeft(clean);
              updateSide(set.id, 'left', clean ? Number(clean) : 0);
            }}
            style={[styles.input, tabular, { width: SET_GRID.side }]}
          />
          <TextInput
            accessibilityLabel={`Set ${n} reps, right side`}
            value={right}
            editable={!readOnly}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholder="R"
            placeholderTextColor={colors.text3}
            onChangeText={(t) => {
              const clean = cleanReps(t);
              setRight(clean);
              updateSide(set.id, 'right', clean ? Number(clean) : 0);
            }}
            style={[styles.input, tabular, { width: SET_GRID.side }]}
          />
        </View>
      ) : (
        <TextInput
          accessibilityLabel={`Set ${n} reps`}
          value={reps}
          editable={!readOnly}
          keyboardType="number-pad"
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={colors.text3}
          onChangeText={(t) => {
            const clean = cleanReps(t);
            setReps(clean);
            updateSet(set.id, { reps: clean ? Number(clean) : 0 });
          }}
          style={[styles.input, tabular, { width: SET_GRID.reps }]}
        />
      )}
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
  sideHead: { width: SET_GRID.side, textAlign: 'center' },
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
  more: {
    position: 'absolute',
    left: 0,
    bottom: 5,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.text3,
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
