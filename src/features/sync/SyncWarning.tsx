/** On Today when changes were refused by the server: they will not reach the account by waiting. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { ChevronRight, Info } from '@/components/icons';
import { useQueue } from '@/stores/queue';
import { colors, type } from '@/theme/tokens';

export function SyncWarning() {
  const failed = useQueue((s) => s.items.filter((i) => i.failed).length);
  if (!failed) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/profile/settings')}>
      <Glass radius={18} style={styles.card}>
        <Info size={18} color={colors.accent} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong}>
            {failed} change{failed === 1 ? '' : 's'} could not be saved
          </Text>
          <Text style={type.small}>Your other changes are fine. Tap to see what to do.</Text>
        </View>
        <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
});
