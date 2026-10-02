import { ChevronRight } from '@/components/icons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, type } from '@/theme/tokens';
import { Glass } from './Glass';

/** Glass list with 0.5 px separators between rows (not after the last). */
export function ListGroup({
  children,
  style,
  inset = 16,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  inset?: number;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Glass radius={22} style={[{ paddingHorizontal: inset, paddingVertical: 2 }, style]}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {row}
          {i < rows.length - 1 ? <View style={styles.sep} /> : null}
        </Fragment>
      ))}
    </Glass>
  );
}

export function Separator() {
  return <View style={styles.sep} />;
}

/** Row: 50–64 px; grey chevron when tappable. */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  height = 60,
  chevron,
  rightInteractive,
  accessibilityLabel,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  height?: number;
  chevron?: boolean;
  /** The right side has its own buttons: keep it outside the row's pressable. */
  rightInteractive?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {left}
      <View style={styles.texts}>
        {typeof title === 'string' ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {typeof subtitle === 'string' ? (
          <Text style={type.caption} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {(chevron ?? !!onPress) ? (
        <ChevronRight size={14} color={colors.text3} strokeWidth={2.8} />
      ) : null}
    </>
  );
  if (!onPress && !onLongPress)
    return <View style={[styles.row, { minHeight: height }]}>{body}</View>;
  if (rightInteractive) {
    return (
      <View style={[styles.row, { minHeight: height }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => [
            styles.row,
            { flex: 1, minHeight: height, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {left}
          <View style={styles.texts}>
            {typeof title === 'string' ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
            {typeof subtitle === 'string' ? (
              <Text style={type.caption} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </View>
        </Pressable>
        {right}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, { minHeight: height, opacity: pressed ? 0.6 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.section} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <Glass radius={22} style={styles.empty}>
      <Text style={[type.bodyStrong, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.caption, { textAlign: 'center' }]}>{text}</Text> : null}
      {action}
    </Glass>
  );
}

const styles = StyleSheet.create({
  sep: { height: 0.5, backgroundColor: colors.separator },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
  },
  empty: { padding: 20, gap: 10, alignItems: 'stretch' },
});
