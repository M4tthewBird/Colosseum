/**
 * "Ready for the next step?": asks a beginner after 10 workouts whether to move up to intermediate.
 * "Not yet" asks again 10 workouts later. Waits until the other first-run prompts are done.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { TrendingUp } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { CHANGELOG } from '@/data/changelog';
import { useSpotlight } from '@/features/onboarding/Spotlight';
import { useFinishedSessions } from '@/features/training/hooks';
import { unseenReleases } from '@/lib/changelog';
import { askAgainAt, levelUpDue } from '@/lib/levelUp';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { accentA, colors, type } from '@/theme/tokens';

export function LevelUpPrompt() {
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setHydrated(true)), []);
  const profile = useData((s) => s.profile);
  const saveProfile = useData((s) => s.saveProfile);
  const workouts = useFinishedSessions().length;
  const askAt = usePrefs((s) => s.levelUpAskAt);
  const setAskAt = usePrefs((s) => s.setLevelUpAskAt);
  const busy = usePrefs(
    (s) =>
      s.tourPending ||
      s.installTipPending ||
      unseenReleases(CHANGELOG, s.changelogSeen).length > 0 ||
      (!profile?.home_gym_id && !s.homeGymAsked),
  );
  const spotlight = useSpotlight((s) => !!s.current);
  const show =
    hydrated &&
    !!profile?.avatar_url &&
    levelUpDue(profile.experience, workouts, askAt) &&
    !busy &&
    !spotlight;

  return (
    <Sheet visible={show} onClose={() => setAskAt(askAgainAt(workouts))} title="Your level">
      <View style={styles.head}>
        <View style={styles.icon}>
          <TrendingUp size={26} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>
          {workouts} workouts done. Ready for the next step?
        </Text>
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
          At the intermediate level, generated workouts can have more sets per muscle, heavier
          weights for strength goals and harder lifts like the deadlift. Move up if the machines and
          basics feel familiar. No rush: you can change it any time in Settings.
        </Text>
      </View>
      <FillButton
        label="Move up to intermediate"
        icon={TrendingUp}
        onPress={() => {
          if (profile) saveProfile({ ...profile, experience: 'intermediate' });
          toast('You are now intermediate');
        }}
      />
      <TextButton
        label="Not yet"
        style={styles.later}
        onPress={() => setAskAt(askAgainAt(workouts))}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: accentA(0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  later: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
});
