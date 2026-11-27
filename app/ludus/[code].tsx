/** A ludus invite (link or QR code): join it, then see it in City → Ludus. */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { Check, UserPlus } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/auth';
import { useJoinLudus, useMyLudus } from '@/features/game/api';
import { isNetworkError } from '@/lib/errors';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { accentA, type } from '@/theme/tokens';

export default function JoinLudus() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const authed = useAuth((s) => s.status === 'signedIn');
  const hasProfile = useData((s) => !!s.profile?.id);
  const signedIn = authed && hasProfile;
  const mine = useMyLudus();
  const join = useJoinLudus();
  const clean = code.toUpperCase();

  const open = () => {
    router.replace('/city/ludus');
  };
  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!signedIn)
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title="Join the ludus"
          text="Join Colosseum or sign in first, then open the invite again."
        />
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
      </Screen>
    );

  if (mine.data && mine.data.code !== clean)
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title={`You are in ${mine.data.name}`}
          text="One ludus at a time. Leave yours in City → Ludus first, then open the invite again."
        />
        <FillButton label="Open my ludus" onPress={open} />
        <TextButton label="Close" style={styles.secondary} onPress={done} />
      </Screen>
    );

  if (mine.data)
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title={`Welcome to ${mine.data.name}`}
          text="You are in. Train at the gym to help in wars."
        />
        <FillButton label="Open the ludus" icon={Check} onPress={open} />
      </Screen>
    );

  return (
    <Screen tabs={false} gap={16}>
      <Head
        title="Join this ludus?"
        text={`Invite code ${clean}. Train together, build your fortress and fight other ludi.`}
      />
      <FillButton
        label="Join"
        icon={Check}
        disabled={join.isPending || mine.isLoading}
        onPress={() =>
          join.mutate(clean, {
            onSuccess: open,
            onError: (e) =>
              toast(isNetworkError(e) ? 'Could not join. Are you online?' : e.message),
          })
        }
      />
      <TextButton label="Not now" style={styles.secondary} onPress={done} />
    </Screen>
  );
}

function Head({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.head}>
      <View style={styles.icon}>
        <LogoMark size={44} />
      </View>
      <Text style={[type.title, { textAlign: 'center' }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingTop: 40 },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: accentA(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
