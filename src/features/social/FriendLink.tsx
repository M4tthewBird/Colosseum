/**
 * Adding friends in person: "My QR code" shows a code for a link to /add/<username>. A friend
 * scans it with the phone camera, Colosseum opens on that profile with Add friend. Signed out,
 * the link is remembered and opened after sign-up or sign-in (FriendLinkResume).
 */
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Share as RNShare, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Share } from '@/components/icons';
import { QrCode } from '@/components/QrCode';
import { Sheet } from '@/components/Sheet';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

/** The link a friend opens: https://…/add/<username> on the web, colosseum://add/… in the app. */
export function friendLink(username: string): string {
  return Linking.createURL(`/add/${encodeURIComponent(username)}`);
}

async function shareLink(link: string, username: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Colosseum',
          text: `Add me on Colosseum: @${username}`,
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast('Link copied');
      return;
    }
    await RNShare.share({ message: `Add me on Colosseum: ${link}` });
  } catch {
    // Closed the share sheet: nothing to do.
  }
}

export function MyQrSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const profile = useData((s) => s.profile);
  if (!profile) return null;
  const link = friendLink(profile.username);
  return (
    <Sheet visible={visible} onClose={onClose} title="My QR code">
      <View style={styles.head}>
        <Avatar name={profile.display_name} url={profile.avatar_url} size={54} />
        <Text style={type.title}>{profile.display_name}</Text>
        <Text style={type.caption}>@{profile.username}</Text>
      </View>
      <View style={styles.code}>
        <QrCode value={link} size={220} />
      </View>
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Your friend scans this with the phone camera and taps Add friend.
      </Text>
      <FillButton
        label="Share link"
        icon={Share}
        onPress={() => void shareLink(link, profile.username)}
        style={{ marginBottom: 8 }}
      />
    </Sheet>
  );
}

/** After signing in, opens a friend link that came in while signed out. */
export function FriendLinkResume() {
  const pending = usePrefs((s) => s.pendingFriend);
  const tour = usePrefs((s) => s.tourPending);
  useEffect(() => {
    if (!pending || tour) return;
    usePrefs.getState().setPendingFriend(null);
    router.push({ pathname: '/add/[username]', params: { username: pending } });
  }, [pending, tour]);
  return null;
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4 },
  code: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 24,
    backgroundColor: colors.white,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
});
