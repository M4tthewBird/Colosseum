/** Barbell lifts: which plates go on each side for the next set; tap for the bar's weight. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { formatKg } from '@/lib/formulas';
import { BARS, platesFor, type PlateLoad } from '@/lib/plates';
import { usePrefs } from '@/stores/prefs';
import { colors, tabular, type } from '@/theme/tokens';

const plateText = (load: PlateLoad) =>
  // Plain numbers: formatKg would round the 1.25 kg plate.
  load.perSide.length ? load.perSide.join(' + ') : 'Empty bar';

export function PlateHint({ weightKg }: { weightKg: number }) {
  const barKg = usePrefs((s) => s.barKg);
  const setBarKg = usePrefs((s) => s.setBarKg);
  const [open, setOpen] = useState(false);
  const load = platesFor(weightKg, barKg);
  if (weightKg <= 0) return null;
  const text = load ? plateText(load) : `Under the ${barKg} kg bar`;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Plates per side for ${formatKg(weightKg)} kg: ${text}`}
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        <Text style={type.small}>Plates per side</Text>
        <Text style={[type.small, tabular, styles.value]} numberOfLines={1}>
          {text}
        </Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={`${formatKg(weightKg)} kg`}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={type.small}>On each side</Text>
          <Text style={[type.title, tabular, { textAlign: 'center' }]}>{text}</Text>
          {load?.short ? (
            <Text style={type.small}>{formatKg(load.short)} kg more than the plates can make</Text>
          ) : null}
        </View>
        <Segmented
          options={BARS.map((b) => ({ value: String(b), label: `${b} kg bar` }))}
          value={String(barKg)}
          onChange={(v) => setBarKg(Number(v) as typeof barKg)}
          accessibilityLabel="Bar weight"
        />
        <View style={{ height: 12 }} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  value: { color: colors.text, fontWeight: '600', flexShrink: 1 },
});
