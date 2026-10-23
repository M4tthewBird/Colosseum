/**
 * "Add a profile picture" for accounts without one (sign-up asks for it now; older accounts did
 * not). "Later" asks again after a week. Waits until the tour, the Home Screen tip, What's new
 * and the home gym question are out of the way.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { Sheet } from '@/components/Sheet';
import { CHANGELOG } from '@/data/changelog';
import { useSpotlight } from '@/features/onboarding/Spotlight';
import { hasPicture } from '@/lib/avatars';
import { unseenReleases } from '@/lib/changelog';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { type } from '@/theme/tokens';
import { uploadAvatar } from './avatar';
import { AvatarPicker } from './AvatarPicker';

const WEEK = 7 * 86400000;

export function AvatarPrompt() {
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setHydrated(true)), []);
  const profile = useData((s) => s.profile);
  const askedAt = usePrefs((s) => s.avatarAskedAt);
  const busy = usePrefs(
    (s) =>
      s.tourPending ||
      s.installTipPending ||
      unseenReleases(CHANGELOG, s.changelogSeen).length > 0 ||
      (!profile?.home_gym_id && !s.homeGymAsked),
  );
  const spotlight = useSpotlight((s) => !!s.current);
  const setAskedAt = usePrefs((s) => s.setAvatarAskedAt);
  const [picking, setPicking] = useState(false);
  // Read once per mount; a week-old "Later" shows it again on the next visit.
  const [now] = useState(() => Date.now());
  const due = !askedAt || now - new Date(askedAt).getTime() > WEEK;
  const show =
    hydrated && !!profile && !hasPicture(profile.avatar_url) && due && !busy && !spotlight;
  const later = () => setAskedAt(new Date().toISOString());

  return (
    <>
      <Sheet visible={show && !picking} onClose={later} title="Profile picture">
        <View style={styles.head}>
          <Avatar name={profile?.display_name ?? '?'} size={72} />
          <Text style={[type.title, { textAlign: 'center' }]}>Add a profile picture</Text>
          <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
            A photo or an emoji, so friends spot you in the Arena and the Forum.
          </Text>
        </View>
        <FillButton label="Choose" onPress={() => setPicking(true)} />
        <TextButton label="Later" style={styles.later} onPress={later} />
      </Sheet>
      {profile ? (
        <AvatarPicker
          visible={show && picking}
          name={profile.display_name}
          current={null}
          onClose={() => setPicking(false)}
          onPick={async (value) => {
            try {
              const avatar_url = await uploadAvatar(profile.id, value);
              useData.getState().saveProfile({ ...profile, avatar_url });
              toast('Profile picture saved');
            } catch {
              toast('Could not save the picture. Are you online?');
            }
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  later: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
});
