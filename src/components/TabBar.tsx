import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ChevronUp, Dumbbell, House, Trophy, User, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resumeWorkout } from '@/features/workout/actions';
import { useNow } from '@/lib/useNow';
import { formatClock } from '@/lib/dates';
import { useData } from '@/stores/data';
import { useWorkout } from '@/stores/workout';
import { colors, space, tabular, type } from '@/theme/tokens';
import { Glass } from './Glass';
import { Pill, useSlidingPill } from './SlidingPill';
import { MAX_WIDTH } from './Screen';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Today', icon: House },
  workouts: { label: 'Workouts', icon: Dumbbell },
  arena: { label: 'Arena', icon: Trophy },
  profile: { label: 'Profile', icon: User },
};

/** Floating glass capsule with 4 tabs, plus the "Resume workout" bar above it. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + space.tabBarBottom;
  const pill = useSlidingPill(state.routes.length, state.index);
  return (
    <View style={[{ pointerEvents: 'box-none' }, styles.wrap, { bottom }]}>
      <ResumeBar />
      <Glass radius={31} style={styles.bar} accessibilityRole="tablist">
        {pill.animated ? <Pill pillStyle={pill.style} style={styles.lozenge} /> : null}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? colors.accent : colors.text2;
          const Icon = tab.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  // Tapping the active tab returns to its root screen.
                  if (focused) navigation.navigate(route.name, { screen: 'index' });
                  else navigation.navigate(route.name);
                }
              }}
              onLayout={pill.onItemLayout(index)}
              style={[styles.tab, focused && !pill.animated && { backgroundColor: colors.fill }]}
            >
              <Icon size={22} color={color} strokeWidth={2} />
              <Text style={[type.tab, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

function ResumeBar() {
  const sessionId = useWorkout((s) => s.sessionId);
  const session = useData((s) => (sessionId ? s.sessions[sessionId] : undefined));
  const now = useNow(!!session);
  if (!session || session.finished_at) return null;
  const elapsed = (now - new Date(session.started_at).getTime()) / 1000;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Resume workout"
      onPress={resumeWorkout}
    >
      <Glass radius={24} style={styles.resume}>
        <View style={styles.live} />
        <View style={{ flex: 1 }}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            Resume workout
          </Text>
          <Text style={[type.small, tabular]} numberOfLines={1}>
            {session.name} · {formatClock(elapsed)}
          </Text>
        </View>
        <ChevronUp size={18} color={colors.text} strokeWidth={2.4} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.tabBarSide,
    right: space.tabBarSide,
    maxWidth: MAX_WIDTH - space.tabBarSide * 2,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    gap: 10,
  },
  bar: {
    height: space.tabBarHeight,
    padding: 5,
    flexDirection: 'row',
    gap: 2,
  },
  lozenge: { top: 5, bottom: 5, borderRadius: 26, backgroundColor: colors.fill },
  tab: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  resume: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
