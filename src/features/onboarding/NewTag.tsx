/** The small red "New" mark on a feature that just arrived. */
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { accentA, colors } from '@/theme/tokens';

export function NewTag({ style }: { style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.tag, style]}>New</Text>;
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: accentA(0.1),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
