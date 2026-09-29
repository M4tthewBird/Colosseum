import { router, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from 'react-native';

import { colors } from '@/theme/tokens';
import { Tap } from './Buttons';

/** "‹ Workouts" accent back link. Falls back to `fallback` when there is no history (web reload). */
export function BackLink({ label, fallback = '/' }: { label: string; fallback?: Href }) {
  return (
    <Tap
      accessibilityRole="link"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        alignSelf: 'flex-start',
        minHeight: 36,
      }}
    >
      <ChevronLeft size={18} color={colors.accent} strokeWidth={2.6} />
      <Text style={{ fontSize: 17, color: colors.accent }}>{label}</Text>
    </Tap>
  );
}
