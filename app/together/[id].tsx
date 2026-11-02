/** A scanned workout code: confirms that you trained with its owner. Asks to sign in first if needed. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, TextButton } from '@/components/Buttons';
import { Check, UserPlus } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/auth';
import { useConfirmTogether, useTogetherSession } from '@/features/together/api';
import { isNetworkError } from '@/lib/errors';
import { confirmOpen, trainedRecently } from '@/lib/together';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

export default function ConfirmTogether() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const authed = useAuth((s) => s.status === 'signedIn');
  const myId = useData((s) => s.profile?.id);
  const signedIn = authed && !!myId;
  const sessions = useData((s) => s.sessions);
  const info = useTogetherSession(id, signedIn);
  const confirm = useConfirmTogether();
  const trained = useMemo(() => trainedRecently(Object.values(sessions)), [sessions]);

  useEffect(() => {
    if (!signedIn) usePrefs.getState().setPendingTogether(id);
  }, [signedIn, id]);

  if (!signedIn) {
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title="Trained together?"
          text="Join Colosseum or sign in first. You come back here right after."
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
  }

  const data = info.data;
  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const close = <TextButton label="Close" style={styles.secondary} onPress={done} />;

  if (info.isLoading) return <Screen tabs={false}>{<Head title="One moment…" text="" />}</Screen>;
  if (!data || !data.finished_at) {
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title="Not ready yet"
          text={
            info.isError
              ? 'Could not check this code. Are you online?'
              : 'This workout has not reached the server yet. Ask them to go online, then scan again.'
          }
        />
        {close}
      </Screen>
    );
  }
  if (data.owner.id === myId) {
    return (
      <Screen tabs={false} gap={16}>
        <Head title="This is your code" text="Your training partner scans it on their phone." />
        {close}
      </Screen>
    );
  }

  const name = data.owner.display_name;
  const face = <Avatar name={name} url={data.owner.avatar_url} size={72} />;
  if (data.confirmed) {
    return (
      <Screen tabs={false} gap={16}>
        <Head face={face} title="Confirmed" text={`You trained with ${name}.`} />
        <FillButton label="See the Arena" onPress={() => router.replace('/arena')} />
        {close}
      </Screen>
    );
  }
  if (!confirmOpen(data.finished_at)) {
    return (
      <Screen tabs={false} gap={16}>
        <Head
          face={face}
          title="This code has expired"
          text="It works for 12 hours after a workout."
        />
        {close}
      </Screen>
    );
  }
  if (!trained) {
    return (
      <Screen tabs={false} gap={16}>
        <Head
          face={face}
          title="Log your workout first"
          text={`Both of you need a workout from today to confirm you trained with ${name}.`}
        />
        {close}
      </Screen>
    );
  }
  return (
    <Screen tabs={false} gap={16}>
      <Head
        face={face}
        title={`Trained with ${name}?`}
        text={`${data.name}. It counts for both of you in the Arena.`}
      />
      <FillButton
        label="Confirm"
        icon={Check}
        ready
        loading={confirm.isPending}
        disabled={confirm.isPending}
        onPress={() =>
          confirm.mutate(id, {
            onError: (e) =>
              toast(isNetworkError(e) ? 'Could not confirm. Are you online?' : e.message),
          })
        }
      />
      {close}
    </Screen>
  );
}

function Head({ face, title, text }: { face?: React.ReactNode; title: string; text: string }) {
  return (
    <View style={styles.head}>
      {face ?? (
        <View style={styles.icon}>
          <LogoMark size={40} color="#fff" />
        </View>
      )}
      <Text style={[type.title, { textAlign: 'center' }]} accessibilityRole="header">
        {title}
      </Text>
      {text ? (
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>{text}</Text>
      ) : null}
    </View>
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
