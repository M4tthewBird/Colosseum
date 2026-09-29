import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, type } from '@/theme/tokens';
import { ScreenGlow } from './Charts';

export const MAX_WIDTH = 520;

/** Space the floating tab bar (and the resume bar) takes at the bottom. */
export function useTabBarSpace(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + space.tabBarBottom + space.tabBarHeight + 24 + extra;
}

export function useTopPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top + 8, 24);
}

/** Scrolling screen with the background glow, safe-area padding and room for the tab bar. */
export function Screen({
  children,
  glow = 'right',
  glowTop,
  tabs = true,
  gap = 18,
  bottomExtra = 0,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  glow?: 'left' | 'right' | 'center' | 'none';
  glowTop?: number;
  tabs?: boolean;
  gap?: number;
  bottomExtra?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const top = useTopPadding();
  const tabSpace = useTabBarSpace(bottomExtra);
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: top,
            paddingBottom: tabs ? tabSpace : insets.bottom + 40 + bottomExtra,
            gap,
          },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {glow !== 'none' ? <ScreenGlow side={glow} top={glowTop} /> : null}
        {children}
      </ScrollView>
    </View>
  );
}

/** Large title header with an optional line above and a control on the right. */
export function Header({
  title,
  above,
  right,
  titleSize = 34,
}: {
  title: string;
  above?: ReactNode;
  right?: ReactNode;
  titleSize?: number;
}) {
  return (
    <View style={styles.header}>
      <View style={{ gap: 4, flexShrink: 1 }}>
        {typeof above === 'string' ? (
          <Text style={[type.caption, { fontWeight: '500' }]} numberOfLines={1}>
            {above}
          </Text>
        ) : (
          above
        )}
        <Text
          accessibilityRole="header"
          style={[type.largeTitle, { fontSize: titleSize }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: space.screen,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
});
