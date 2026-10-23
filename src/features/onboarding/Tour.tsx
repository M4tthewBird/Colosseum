/**
 * The app tour: right after sign-up, Colosseum walks the new user through the real app. Each step
 * opens the screen it talks about; a red ring glides along the tab bar to the tab in question,
 * the part of the screen the step is about is lit up (a TourTarget), and a card says what lives
 * there. Skippable at every step; Settings can start it again.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import {
  Bookmark,
  Check,
  ChevronLeft,
  Clock,
  CopyPlus,
  Flame,
  Globe,
  Landmark,
  Layers,
  MapPin,
  MessageCircle,
  Play,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from '@/components/icons';
import { MAX_WIDTH } from '@/components/Screen';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { dur, ease, useReducedMotion } from '@/theme/motion';
import { colors, space, type } from '@/theme/tokens';
import {
  HALO,
  haloAround,
  roundRect,
  Scrim,
  SpotRing,
  useTargetRect,
  type Halo,
} from './Spotlight';

interface Me {
  firstName: string;
  username: string;
}

interface Step {
  route: Href;
  /** Tab bar slot the step is about (0 Today … 3 Profile), or null off the tab bar. */
  tab: number | null;
  /** TourTarget id lit up on the screen, and its corner radius. */
  target?: string;
  radius?: number;
  title: string | ((me: Me) => string);
  body: string | ((me: Me) => string);
  points: { icon: LucideIcon; text: string }[];
}

const FRIENDS: Href = '/arena/friends';

const STEPS: Step[] = [
  {
    route: '/',
    tab: 0,
    target: 'today-week',
    radius: 24,
    title: ({ firstName }) => (firstName ? `Welcome, ${firstName}` : 'Welcome to Colosseum'),
    body: 'A one-minute look around. Today is your home screen.',
    points: [
      { icon: TrendingUp, text: 'Your week at a glance: workouts, volume, streak and Arena rank' },
      { icon: Play, text: "Up next: your program's next day, one tap to start" },
      { icon: Landmark, text: "Further down: the Forum and your friends' PRs" },
    ],
  },
  {
    route: '/workouts',
    tab: 1,
    target: 'workouts-programs',
    radius: 18,
    title: 'Workouts',
    body: 'Everything you train lives here. Programs holds your splits and ready-made templates.',
    points: [
      { icon: Layers, text: 'Programs: your own split or a template, with weekly periodization' },
      { icon: Bookmark, text: 'Saved workouts for one-off sessions' },
      { icon: Clock, text: 'A calendar and the history of every workout' },
    ],
  },
  {
    route: '/workouts',
    tab: 1,
    target: 'upnext-start-workouts',
    radius: 25,
    title: 'During a workout',
    body: 'Start workout opens your next day. Built for the gym floor, and it works without signal.',
    points: [
      { icon: Check, text: 'Tick a set to log it. The rest timer starts on its own' },
      { icon: Flame, text: 'Tap a set number for a drop set or to mark failure' },
      { icon: TrendingUp, text: 'Next time you get a suggested weight based on how it went' },
    ],
  },
  {
    route: '/arena',
    tab: 2,
    target: 'arena-scopes',
    radius: 14,
    title: 'Arena',
    body: 'Train together, compete together. Choose who you are up against.',
    points: [
      { icon: Trophy, text: 'Rank against friends by volume, workouts or any lift, in kg or DOTS' },
      { icon: Globe, text: 'Join the global leaderboard to take on everyone, if you want to' },
      { icon: MapPin, text: "My gym: who's training now, challenges and the gym feed" },
    ],
  },
  {
    route: FRIENDS,
    tab: 2,
    target: 'friends-search',
    radius: 12,
    title: 'Add your friends',
    body: ({ username }) =>
      `Search for your training partners here. They find you as @${username}. Open this page any time with the people icon in Arena.`,
    points: [
      { icon: UserPlus, text: 'Send a request; it becomes a friendship once they accept' },
      { icon: Trophy, text: 'Friends meet you on the Arena leaderboard' },
      { icon: Users, text: 'Their new PRs and shared workouts show up on Today' },
    ],
  },
  {
    route: '/forum',
    tab: null,
    target: 'forum-post',
    radius: 24,
    title: 'Forum',
    body: 'Share a finished workout with your friends and your gym. Open it from Today.',
    points: [
      { icon: MessageCircle, text: 'Comment on and like what others share' },
      { icon: CopyPlus, text: 'Copy a workout you like straight into your own' },
      { icon: SlidersHorizontal, text: 'Filter by Push, Pull, Legs and more' },
    ],
  },
  {
    route: '/profile',
    tab: 3,
    target: 'profile-sections',
    radius: 20,
    title: 'Profile',
    body: 'Your progress, private where it matters.',
    points: [
      { icon: User, text: 'Body: bodyweight and measurements. Only you can see them' },
      { icon: TrendingUp, text: 'Lifts: records, estimated 1RM and how your training feels' },
      { icon: Settings2, text: 'Settings: home gym, global leaderboard, and this tour again' },
    ],
  },
  {
    route: '/',
    tab: 0,
    target: 'upnext-start-today',
    radius: 25,
    title: 'You’re ready',
    body: 'Start your first workout from Up next, or pick a program in Workouts first. Every set you log builds your records.',
    points: [],
  },
];

const BAR_PAD = 5;
const BAR_GAP = 2;

/** Where each tab sits, mirroring TabBar's layout (4 equal slots in a centered capsule). */
function useTabGeometry() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barWidth = Math.min(width - space.tabBarSide * 2, MAX_WIDTH - space.tabBarSide * 2);
  const barLeft = (width - barWidth) / 2;
  const tabWidth = (barWidth - BAR_PAD * 2 - BAR_GAP * 3) / 4;
  const barBottom = insets.bottom + space.tabBarBottom;
  return {
    width,
    height,
    barLeft,
    barWidth,
    barBottom,
    barTop: barBottom + space.tabBarHeight,
    tabWidth,
    tabLeft: (i: number) => barLeft + BAR_PAD + i * (tabWidth + BAR_GAP),
    bottomInset: insets.bottom,
    topInset: insets.top,
  };
}

export function Tour() {
  const pending = usePrefs((s) => s.tourPending);
  return pending ? <TourOverlay /> : null;
}

function TourOverlay() {
  const setPending = usePrefs((s) => s.setTourPending);
  const firstName = useData((s) => s.profile?.display_name.trim().split(/\s+/)[0] ?? '');
  const username = useData((s) => s.profile?.username ?? '');
  const reduced = useReducedMotion();
  const g = useTabGeometry();
  const [step, setStep] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const target = useTargetRect(s.target);

  // The ring glides from tab to tab; off the tab bar it fades out.
  const ringX = useSharedValue(g.tabLeft(s.tab ?? 0));
  const ringOn = useSharedValue(s.tab == null ? 0 : 1);
  useEffect(() => {
    const config = { duration: reduced ? 0 : dur.layout, easing: ease };
    if (s.tab != null) ringX.value = withTiming(g.tabLeft(s.tab), config);
    ringOn.value = withTiming(s.tab == null ? 0 : 1, { duration: dur.state });
  }, [s.tab, g, reduced, ringX, ringOn]);
  const ring = useAnimatedStyle(() => ({
    opacity: ringOn.value,
    transform: [{ translateX: ringX.value }],
  }));

  // The Friends page is pushed onto the Arena tab; take it off again when the tour moves on,
  // so the Arena tab opens on the leaderboard later.
  const leave = (next: Href) => {
    if (s.route === FRIENDS && next !== FRIENDS) router.navigate('/arena');
    router.navigate(next);
  };
  const go = (i: number) => {
    setStep(i);
    leave(STEPS[i].route);
  };
  const finish = (then?: Href) => {
    setPending(false);
    leave(then ?? '/');
  };

  const me = { firstName, username };
  const cardWidth = Math.min(g.width - 32, MAX_WIDTH - 32);
  const cardLeft = (g.width - cardWidth) / 2;
  const onBar = s.tab != null;
  const cardBottom = onBar ? g.barTop + 18 : g.bottomInset + 24;
  // A card that would cover the lit-up element moves to the top of the screen.
  const cardTop = g.height - cardBottom - cardHeight;
  const atTop = !!target && cardHeight > 0 && target.y + target.height + HALO + 12 > cardTop;
  const caretX = onBar ? g.tabLeft(s.tab!) + g.tabWidth / 2 - cardLeft - 8 : 0;
  const title = typeof s.title === 'function' ? s.title(me) : s.title;
  const body = typeof s.body === 'function' ? s.body(me) : s.body;
  const halo = haloAround(target, s.radius);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {/* The screen stays visible but recedes; the tab bar and the step's target stay bright. */}
      <TourScrim g={g} hole={onBar} spot={halo} />
      {/* Taps on the tab bar wait until the tour is over. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => undefined} />
      <Animated.View
        aria-hidden
        style={[
          styles.ring,
          { width: g.tabWidth, bottom: g.barBottom + BAR_PAD - 1, height: space.tabBarHeight - 8 },
          ring,
        ]}
      />
      {halo ? <SpotRing halo={halo} k={`spot-${step}`} /> : null}

      <View
        onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
        style={[
          styles.card,
          { left: cardLeft, width: cardWidth },
          atTop ? { top: g.topInset + 16 } : { bottom: cardBottom },
        ]}
        accessibilityLiveRegion="polite"
      >
        {onBar && !atTop ? <View aria-hidden style={[styles.caret, { left: caretX }]} /> : null}
        <Animated.View
          key={step}
          entering={reduced ? undefined : FadeIn.duration(dur.state)}
          style={{ gap: 12 }}
        >
          <View style={{ gap: 4 }}>
            <Text style={type.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.body}>{body}</Text>
          </View>
          {s.points.length ? (
            <View style={{ gap: 10 }}>
              {s.points.map((p) => {
                const Icon = p.icon;
                return (
                  <View key={p.text} style={styles.point}>
                    <View style={styles.pointIcon}>
                      <Icon size={15} color={colors.accent} strokeWidth={2.2} />
                    </View>
                    <Text style={[type.body, { flex: 1 }]}>{p.text}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Animated.View>

        {last ? (
          <View style={{ gap: 4 }}>
            <FillButton label="Let’s go" icon={Play} iconFill onPress={() => finish()} />
            <TextButton
              label="Browse programs first"
              style={styles.secondary}
              onPress={() => finish('/workouts/programs')}
            />
            <TextButton
              label="Add friends first"
              style={styles.secondary}
              onPress={() => finish(FRIENDS)}
            />
          </View>
        ) : (
          <View style={styles.footer}>
            <TextButton label="Skip tour" onPress={() => finish()} style={styles.skip} />
            <Dots count={STEPS.length} active={step} />
            <View style={styles.nav}>
              {step > 0 ? (
                <IconButton
                  icon={ChevronLeft}
                  accessibilityLabel="Previous"
                  size={44}
                  onPress={() => go(step - 1)}
                />
              ) : null}
              <FillButton
                label="Next"
                size="sm"
                style={styles.next}
                onPress={() => go(step + 1)}
                accessibilityLabel={`Next, step ${step + 2} of ${STEPS.length}`}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Dims the whole screen; on tab steps the tab bar's capsule is cut out so it stays lit, and the
 * step's target is cut out too.
 */
function TourScrim({
  g,
  hole,
  spot,
}: {
  g: ReturnType<typeof useTabGeometry>;
  hole: boolean;
  spot: Halo | null;
}) {
  const capsule = roundRect(
    g.barLeft,
    g.height - g.barTop,
    g.barWidth,
    space.tabBarHeight,
    space.tabBarHeight / 2,
  );
  const target = spot ? roundRect(spot.x, spot.y, spot.width, spot.height, spot.r) : '';
  return <Scrim width={g.width} height={g.height} holes={`${hole ? capsule : ''}${target}`} />;
}

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Step ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotOn]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    left: 0,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.accent,
    pointerEvents: 'none',
  },
  card: {
    position: 'absolute',
    padding: 18,
    gap: 16,
    borderRadius: 26,
    backgroundColor: colors.glassFallback,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 18px 40px rgba(0,0,0,0.16)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(30px) saturate(180%)' } as object) : null),
  },
  caret: {
    position: 'absolute',
    bottom: -7,
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: colors.glassFallback,
    transform: [{ rotate: '45deg' }],
  },
  body: { fontSize: 15, lineHeight: 21, color: colors.text2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skip: { minHeight: 44, justifyContent: 'center' },
  nav: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  next: { minWidth: 84, height: 44 },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.fillStrong },
  dotOn: { width: 16, backgroundColor: colors.accent },
});
