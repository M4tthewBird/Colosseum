/** Profile → Body. Private: only ever rendered for the signed-in owner. */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Sparkline } from '@/components/Charts';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { SectionHeader } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import { addDays, fromLocalDate, shortDate, toLocalDate } from '@/lib/dates';
import { formatKg, parseNumber } from '@/lib/formulas';
import {
  MEASUREMENT_KEYS,
  MEASUREMENT_LABELS,
  type BodyMeasurement,
  type MeasurementKey,
} from '@/lib/types';
import { useData } from '@/stores/data';
import { colors, type } from '@/theme/tokens';

function signed(n: number, digits = 1): string {
  if (Math.abs(n) < 0.05) return '—';
  return `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;
}

export function BodyView() {
  const bodyweights = useData((s) => s.bodyweights);
  const measurements = useData((s) => s.measurements);
  const [weightOpen, setWeightOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const logs = useMemo(
    () => Object.values(bodyweights).sort((a, b) => a.logged_on.localeCompare(b.logged_on)),
    [bodyweights],
  );
  const latest = logs[logs.length - 1];
  const monthAgo = toLocalDate(addDays(new Date(), -30));
  const base = [...logs].reverse().find((l) => l.logged_on <= monthAgo) ?? logs[0];
  const change = latest && base && base !== latest ? latest.weight_kg - base.weight_kg : null;
  const spark = logs.filter((l) => l.logged_on >= toLocalDate(addDays(new Date(), -90))).slice(-12);

  const ms = useMemo(
    () => Object.values(measurements).sort((a, b) => a.logged_on.localeCompare(b.logged_on)),
    [measurements],
  );
  const lastLogged = ms[ms.length - 1]?.logged_on;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add today's bodyweight"
        onPress={() => setWeightOpen(true)}
      >
        <Glass radius={22} style={styles.weight}>
          <View style={{ gap: 2 }}>
            <Text style={type.captionStrong}>Bodyweight</Text>
            {latest ? (
              <>
                <Text style={styles.big}>
                  {formatKg(latest.weight_kg)} <Text style={styles.unit}>kg</Text>
                </Text>
                <Text style={type.small}>
                  {change == null
                    ? `Logged ${shortDate(fromLocalDate(latest.logged_on))}`
                    : `${signed(change)} kg in 30 days`}
                </Text>
              </>
            ) : (
              <Text style={[type.body, { color: colors.text2 }]}>Tap to add today’s weight</Text>
            )}
          </View>
          {spark.length >= 2 ? (
            <Sparkline
              values={spark.map((s) => s.weight_kg)}
              accessibilityLabel={`Bodyweight from ${formatKg(spark[0].weight_kg)} to ${formatKg(spark[spark.length - 1].weight_kg)} kg`}
            />
          ) : null}
        </Glass>
      </Pressable>

      <View style={{ gap: 8 }}>
        <SectionHeader
          title="Measurements"
          right={
            <FillButton
              label="Log"
              size="sm"
              style={{ height: 30, paddingHorizontal: 12 }}
              onPress={() => setLogOpen(true)}
            />
          }
        />
        <Glass radius={22} style={styles.grid}>
          {MEASUREMENT_KEYS.map((k, i) => {
            const withValue = ms.filter((m) => m[k] != null);
            const cur = withValue[withValue.length - 1]?.[k] ?? null;
            const prev = withValue[withValue.length - 2]?.[k] ?? null;
            const delta = cur != null && prev != null ? cur - prev : null;
            return (
              <View
                key={k}
                style={[styles.cell, i < MEASUREMENT_KEYS.length - 2 && styles.cellBorder]}
              >
                <View>
                  <Text style={type.small}>{MEASUREMENT_LABELS[k]}</Text>
                  <Text style={styles.cellValue}>
                    {cur != null ? cur.toFixed(1) : '—'} <Text style={styles.cellUnit}>cm</Text>
                  </Text>
                </View>
                <Text
                  style={[
                    styles.delta,
                    { color: delta && Math.abs(delta) >= 0.05 ? colors.accent : colors.text2 },
                  ]}
                >
                  {delta == null ? '' : signed(delta)}
                </Text>
              </View>
            );
          })}
        </Glass>
        <Text style={[type.small, { paddingHorizontal: 4 }]}>
          {lastLogged
            ? `Last logged ${shortDate(fromLocalDate(lastLogged))} · change since previous entry`
            : 'No measurements yet. Tap Log to add them.'}
        </Text>
        <Text style={[type.small, { paddingHorizontal: 4 }]}>Only you can see your body data.</Text>
      </View>

      <WeightSheet visible={weightOpen} onClose={() => setWeightOpen(false)} />
      <MeasurementsSheet
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        latest={ms[ms.length - 1]}
      />
    </>
  );
}

function WeightSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const log = useData((s) => s.logBodyweight);
  const [value, setValue] = useState('');
  const kg = parseNumber(value);
  const ok = kg != null && kg > 20 && kg < 400;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Today’s weight"
      doneLabel="Save"
      doneDisabled={!ok}
      onDone={() => {
        if (!ok) return;
        log(kg!);
        setValue('');
        onClose();
      }}
    >
      <FormGroup>
        <FormField
          label="Bodyweight"
          value={value}
          onChangeText={setValue}
          placeholder="80.0"
          keyboardType="decimal-pad"
          suffix="kg"
          autoFocus
        />
      </FormGroup>
      <FieldHint text="Logging again today replaces today’s entry." />
    </Sheet>
  );
}

function MeasurementsSheet({
  visible,
  onClose,
  latest,
}: {
  visible: boolean;
  onClose: () => void;
  latest?: BodyMeasurement;
}) {
  const log = useData((s) => s.logMeasurements);
  const [values, setValues] = useState<Partial<Record<MeasurementKey, string>>>({});
  const parsed = Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, parseNumber(v ?? '')])
      .filter(([, v]) => v != null && (v as number) > 0),
  ) as Partial<Record<MeasurementKey, number>>;
  const any = Object.keys(parsed).length > 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Log measurements"
      doneLabel="Save"
      doneDisabled={!any}
      onDone={() => {
        log(parsed);
        setValues({});
        onClose();
      }}
    >
      <FieldHint text="Fill in any of them. Values are in cm, for today." />
      <FormGroup>
        {MEASUREMENT_KEYS.map((k) => (
          <FormField
            key={k}
            label={MEASUREMENT_LABELS[k]}
            value={values[k] ?? ''}
            onChangeText={(t) => setValues((v) => ({ ...v, [k]: t }))}
            placeholder={latest?.[k] != null ? String(latest[k]) : '—'}
            keyboardType="decimal-pad"
            suffix="cm"
          />
        ))}
      </FormGroup>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  weight: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  big: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  unit: { fontSize: 15, fontWeight: '600', color: colors.text2 },
  grid: {
    paddingVertical: 2,
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
  },
  cell: {
    width: '46%',
    flexGrow: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cellBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.separator },
  cellValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  cellUnit: { fontSize: 12, fontWeight: '500', color: colors.text2 },
  delta: { fontSize: 12, fontWeight: '600' },
});
