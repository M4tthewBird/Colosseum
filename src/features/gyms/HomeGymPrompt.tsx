/**
 * "Where do you train?": asked once after signing in when the account has no home gym (skipped at
 * sign-up, or an older account). Waits until the tour, the Home Screen tip and What's new are done.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { MapPin } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { CHANGELOG } from '@/data/changelog';
import { createGym } from '@/features/social/api';
import { unseenReleases } from '@/lib/changelog';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { GymPicker } from './GymPicker';

export function HomeGymPrompt() {
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setHydrated(true)), []);
  const profile = useData((s) => s.profile);
  const asked = usePrefs((s) => s.homeGymAsked);
  const busy = usePrefs(
    (s) =>
      s.tourPending || s.installTipPending || unseenReleases(CHANGELOG, s.changelogSeen).length > 0,
  );
  const setAsked = usePrefs((s) => s.setHomeGymAsked);
  const [picking, setPicking] = useState(false);
  const show = hydrated && !!profile && !profile.home_gym_id && !asked && !busy;

  return (
    <>
      <Sheet visible={show && !picking} onClose={() => setAsked(true)} title="Home gym">
        <View style={styles.head}>
          <View style={styles.pin}>
            <MapPin size={26} color={colors.accent} strokeWidth={2} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>Where do you train?</Text>
          <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
            Your home gym unlocks My gym in the Arena: its leaderboard, challenges and who is
            training now.
          </Text>
        </View>
        <FillButton label="Choose my gym" icon={MapPin} onPress={() => setPicking(true)} />
        <TextButton label="Not now" style={styles.later} onPress={() => setAsked(true)} />
      </Sheet>
      <GymPicker
        visible={show && picking}
        onClose={() => setPicking(false)}
        onPick={async (g) => {
          try {
            const id = 'id' in g ? g.id : (await createGym(g.name, g.city)).id;
            const { profile: p, saveProfile } = useData.getState();
            if (p) saveProfile({ ...p, home_gym_id: id });
            setAsked(true);
            toast(`Home gym: ${g.name}`);
          } catch {
            toast('Could not add the gym. Are you online?');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  pin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  later: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
});
