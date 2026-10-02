import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, tabular, type } from '@/theme/tokens';
import { Glass } from './Glass';

/** Grouped form list (radius 20, rows 50 px, separators between rows). */
export function FormGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Glass radius={20} style={{ paddingHorizontal: 16 }}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {row}
          {i < rows.length - 1 ? <View style={styles.sep} /> : null}
        </Fragment>
      ))}
    </Glass>
  );
}

/** Label + text input on one row. */
export function FormField({
  label,
  labelWidth = 96,
  suffix,
  right,
  align = 'left',
  ...input
}: TextInputProps & {
  label: string;
  labelWidth?: number;
  suffix?: string;
  right?: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { width: labelWidth }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { textAlign: align }]}
        {...input}
      />
      {suffix ? (
        <Text style={[type.body, { color: colors.text2, fontSize: 16 }]}>{suffix}</Text>
      ) : null}
      {right}
    </View>
  );
}

/** Label on the left, any control on the right. Tappable when onPress is set. */
export function FormRow({
  label,
  children,
  onPress,
}: {
  label: string;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      {children}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function FieldHint({ text, error }: { text: string; error?: boolean }) {
  return (
    <Text
      style={[type.small, { paddingHorizontal: 16, color: error ? colors.accent : colors.text2 }]}
    >
      {text}
    </Text>
  );
}

export function FieldLabel({ text, right }: { text: string; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 }}>
      <Text style={type.caption}>{text}</Text>
      {right ? <Text style={type.caption}>{right}</Text> : null}
    </View>
  );
}

/** − | + grey pill. */
export function Stepper({
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
}: {
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={minusLabel}
        onPress={onMinus}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.stepBtn}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <View style={styles.stepSep} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={plusLabel}
        onPress={onPlus}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.stepBtn}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

/** A labelled stepper row: "Length   8 weeks  [− | +]". */
export function StepperRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={[styles.row, { gap: 10 }]}>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      <Text style={[styles.value, tabular]}>{format(value)}</Text>
      <Stepper
        minusLabel={`Decrease ${label.toLowerCase()}`}
        plusLabel={`Increase ${label.toLowerCase()}`}
        onMinus={() => onChange(Math.max(min, value - step))}
        onPlus={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { height: 0.5, backgroundColor: colors.separator },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: 12 },
  label: { fontSize: 16, color: colors.text },
  value: { fontSize: 16, color: colors.text2 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as object,
  stepper: {
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: colors.text },
  stepSep: { width: 0.5, height: 18, backgroundColor: 'rgba(60,60,67,0.25)' },
});
