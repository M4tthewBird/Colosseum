/**
 * Big features in What's new: a card with a live preview drawn from the real components, what the
 * feature does, where it lives, and "Show me", which opens that screen and lights up the spot.
 * Releases name these by FeatureId (src/data/changelog.ts).
 */
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { ChevronRight, MapPin, Star, Zap } from '@/components/icons';
import { QrCode } from '@/components/QrCode';
import { Chip } from '@/components/Segmented';
import { Medallion } from '@/features/badges/Medallion';
import { NewTag } from '@/features/onboarding/NewTag';
import { friendLink } from '@/features/social/FriendLink';
import type { FeatureId, Highlight } from '@/lib/changelog';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { colors, type } from '@/theme/tokens';
import { showGuide, showSpotlight } from './Spotlight';

/** The exercise the user logged most (sets), else Bench Press, else any. */
function favoriteDemoExercise(): string | null {
  const { sessions, exercises } = useData.getState();
  const count = new Map<string, number>();
  for (const s of Object.values(sessions))
    for (const x of s.sets) count.set(x.exercise_id, (count.get(x.exercise_id) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).find(([id]) => exercises[id]);
  if (top) return top[0];
  const all = Object.values(exercises);
  return (all.find((e) => e.name === 'Bench Press') ?? all[0])?.id ?? null;
}

const SHOW: Record<FeatureId, () => void> = {
  badges: () =>
    showSpotlight(
      {
        target: 'profile-sections',
        radius: 9,
        title: 'Your badges',
        body: 'They live in Profile → Badges. Tap a badge to see every tier and when you got it.',
      },
      { pathname: '/profile', params: { section: 'badges' } },
    ),
  'friend-qr': () =>
    showSpotlight(
      {
        target: 'friends-qr',
        radius: 16,
        title: 'My QR',
        body: 'Tap My QR and let a friend scan it with the phone camera. They tap Add friend and you’re in each other’s Arena.',
      },
      '/arena/friends',
      '/arena',
    ),
  favorites: () => {
    const id = favoriteDemoExercise();
    const request = {
      target: 'exercise-favorite',
      radius: 15,
      title: 'Tap the star',
      body: 'The star sits on every exercise: here, on the exercise image in a workout and in the list when you add one.',
    };
    if (id)
      showSpotlight(
        request,
        { pathname: '/profile/exercise/[id]', params: { id } } as Href,
        '/profile',
      );
    else showSpotlight({ ...request, target: 'profile-sections' }, '/profile');
  },
  generate: () =>
    showGuide([
      {
        route: '/workouts',
        target: 'workouts-generate',
        radius: 27,
        title: 'Generate a workout',
        body: 'It starts here, in Workouts. Let’s build one together.',
      },
      {
        route: { pathname: '/generate', params: { preset: 'full' } },
        target: 'gen-train',
        radius: 18,
        title: 'What to train',
        body: 'Pick Full body, Upper, Lower, Push or Pull. Prefer to choose? Tap single muscles below.',
      },
      {
        route: { pathname: '/generate', params: { preset: 'full' } },
        target: 'gen-equipment',
        radius: 18,
        title: 'What you have',
        body: 'A full gym, dumbbells, your bodyweight with a bar, or at home with nothing. Switch any time.',
      },
      {
        route: { pathname: '/generate', params: { preset: 'full' } },
        target: 'gen-time',
        radius: 18,
        title: 'How long you have',
        body: 'Colosseum tells you what fits, like 5 exercises with 2 sets each, and how hard to go. Prefer fewer exercises with more sets? One tap.',
      },
      {
        route: { pathname: '/generate', params: { preset: 'full' } },
        target: 'gen-plan',
        radius: 22,
        title: 'Your workout',
        body: 'Swap any exercise, shuffle them all, then start it or save it. New to the gym? A guide below explains how to do it.',
      },
    ]),
  'train-together': () => {
    usePrefs.getState().setArenaScope('friends');
    showGuide([
      {
        route: '/forum',
        target: 'forum-plans',
        radius: 27,
        title: 'Say you are going',
        body: 'Tap Going to train and pick a time. Friends and people from your gym see it here and on Today, and can say they are in.',
      },
      {
        route: '/arena/friends',
        via: '/arena',
        target: 'friends-search',
        radius: 16,
        title: 'Or invite one friend',
        body: 'Open a friend’s profile and tap Invite to train. They see the invite in the app and answer I’m in or Can’t.',
      },
      {
        route: '/arena',
        preview: <TogetherPreview />,
        title: 'After the workout',
        body: 'At the end of a workout, tap Confirm together. One of you shows this code, the other scans it and confirms. There you can also tap Share on the Forum.',
      },
      {
        route: '/arena',
        target: 'arena-together',
        radius: 22,
        title: 'It counts in the Arena',
        body: 'Workouts you confirm show up here, and on the Together board at the top of the Arena.',
      },
    ]);
  },
};

/** A code to show in the guide: only a picture, it leads nowhere. */
function TogetherPreview() {
  const username = useData((s) => s.profile?.username ?? 'you');
  return (
    <View style={styles.qr}>
      <QrCode value={friendLink(username)} size={96} />
    </View>
  );
}

const GUIDED: FeatureId[] = ['generate', 'train-together'];

function Preview({ feature }: { feature: FeatureId }) {
  const username = useData((s) => s.profile?.username ?? 'you');
  switch (feature) {
    case 'badges':
      return (
        <View style={styles.row}>
          <Medallion icon="dumbbell" level={2} earned size={60} />
          <Medallion icon="bench" level={3} earned size={76} value={100} />
          <Medallion icon="flame" level={5} earned size={60} />
        </View>
      );
    case 'friend-qr':
      return (
        <View style={styles.qr}>
          <QrCode value={friendLink(username)} size={96} />
        </View>
      );
    case 'favorites':
      return <FavoritesPreview />;
    case 'generate':
      return (
        <View style={{ gap: 10, alignItems: 'center' }}>
          <View style={[styles.row, { gap: 6 }]}>
            <Chip label="Full body" selected />
            <Chip label="Upper" />
            <Chip label="Lower" />
          </View>
          <View style={styles.list}>
            <View style={styles.item}>
              <Zap size={16} color={colors.accent} strokeWidth={2.2} />
              <Text style={type.bodyStrong}>45 min: 5 exercises, 2 sets each</Text>
            </View>
          </View>
        </View>
      );
    case 'train-together':
      return (
        <View style={[styles.row, { gap: 10 }]}>
          <Avatar name="Tomáš Král" size={44} />
          <View style={{ gap: 6 }}>
            <Text style={type.bodyStrong}>Today 17:30</Text>
            <Chip label="I'm in" selected />
          </View>
        </View>
      );
  }
}

function FavoritesPreview() {
  const names = useData((s) => {
    const fav = Object.entries(s.exercisePrefs)
      .filter(([, p]) => p.favorite)
      .map(([id]) => s.exercises[id]?.name)
      .filter(Boolean) as string[];
    return fav.slice(0, 2).join('|');
  });
  const list = names ? names.split('|') : ['Bench Press', 'Pull-up'];
  return (
    <View style={{ gap: 8, width: '100%', maxWidth: 260 }}>
      <View style={[styles.row, { gap: 6 }]}>
        <Chip label="★ Favorites" selected />
        <Chip label="Chest" />
      </View>
      <View style={styles.list}>
        {list.map((n, i) => (
          <View key={n} style={[styles.item, i > 0 && styles.itemLine]}>
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
              {n}
            </Text>
            <Star size={18} color={colors.accent} fill={colors.accent} strokeWidth={2.2} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function HighlightCard({
  highlight: h,
  beforeShow,
  fresh,
}: {
  highlight: Highlight;
  /** Just arrived: says so on the card. */
  fresh?: boolean;
  /** Runs before "Show me" leaves for the feature (What's new closes its sheet). */
  beforeShow?: () => void;
}) {
  return (
    <Glass radius={22} style={styles.card} accessibilityLabel={`New: ${h.title}`}>
      <PreviewFrame>
        <Preview feature={h.feature} />
      </PreviewFrame>
      <View style={{ gap: 4, paddingHorizontal: 2 }}>
        {fresh ? <NewTag /> : null}
        <Text style={type.title}>{h.title}</Text>
        <Text style={styles.body}>{h.body}</Text>
        <View style={styles.where}>
          <MapPin size={13} color={colors.accent} strokeWidth={2.2} />
          <Text style={type.captionStrong}>{h.where}</Text>
        </View>
      </View>
      <FillButton
        label={GUIDED.includes(h.feature) ? 'Show me how it works' : 'Show me'}
        icon={ChevronRight}
        size="sm"
        style={{ alignSelf: 'flex-start', height: 44, paddingRight: 18 }}
        onPress={() => {
          beforeShow?.();
          SHOW[h.feature]();
        }}
      />
    </Glass>
  );
}

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.preview} aria-hidden>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12 },
  preview: {
    minHeight: 132,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  qr: { backgroundColor: colors.white, borderRadius: 12, padding: 8 },
  list: { backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  body: { fontSize: 15, lineHeight: 21, color: colors.text2 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
});
