/** A friend link (from a QR code): opens that profile, or asks to sign in first and remembers it. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { UserPlus } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/auth';
import { userByUsername } from '@/features/social/api';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { colors, type } from '@/theme/tokens';

export default function AddFriendLink() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const name = username.toLowerCase().replace(/^@/, '');
  const authed = useAuth((s) => s.status === 'signedIn');
  const myName = useData((s) => s.profile?.username);
  const signedIn = authed && !!myName;
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      usePrefs.getState().setPendingFriend(name);
      return;
    }
    if (name === myName) {
      router.replace('/arena/friends');
      return;
    }
    let live = true;
    userByUsername(name)
      .then((u) => {
        if (!live) return;
        if (u) router.replace({ pathname: '/user/[id]', params: { id: u.id } });
        else setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [signedIn, name, myName]);

  return (
    <Screen tabs={false} gap={16}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <LogoMark size={40} color="#fff" />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>
          {missing ? `No one is called @${name}` : `Add @${name} as a friend`}
        </Text>
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
          {missing
            ? 'Check the username, or ask them to show their QR code again.'
            : signedIn
              ? 'Opening their profile…'
              : 'Join Colosseum or sign in first. You come back here right after.'}
        </Text>
      </View>
      {!signedIn ? (
        <>
          <FillButton
            label="Create account"
            icon={UserPlus}
            onPress={() => router.replace('/onboarding')}
          />
          <TextButton
            label="I have an account"
            style={styles.secondary}
            onPress={() => router.replace('/sign-in')}
          />
        </>
      ) : missing ? (
        <FillButton label="Find friends" onPress={() => router.replace('/arena/friends')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingTop: 40 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
