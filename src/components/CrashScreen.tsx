/**
 * Shown instead of a white page when a screen crashes. It sits above every provider, so it uses
 * nothing from them. The error text is there for a screenshot.
 */
import type { ErrorBoundaryProps } from 'expo-router';
import { Platform, Text, View } from 'react-native';

import { colors, type } from '@/theme/tokens';
import { FillButton } from './Buttons';
import { RotateCcw } from './icons';

export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const again = () => {
    // A full reload also clears whatever broke; without it the same crash tends to come back.
    if (Platform.OS === 'web') window.location.reload();
    else void retry();
  };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: 'center',
        padding: 24,
        gap: 12,
      }}
    >
      <Text style={type.largeTitle} accessibilityRole="header">
        Something went wrong
      </Text>
      <Text style={type.body}>
        This screen crashed. What you logged is stored on this device, so it should still be here
        after you try again.
      </Text>
      <FillButton label="Try again" icon={RotateCcw} onPress={again} />
      <Text style={type.small} selectable>
        {error.message}
      </Text>
    </View>
  );
}
