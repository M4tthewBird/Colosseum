/**
 * A scanned gym poster (in the app or with the phone camera): checks in, or out when already in
 * at that gym. Needs the position; the server checks the code and the place.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { MapPinCheck, RotateCcw, ShieldCheck, UserPlus } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/auth';
import { scanVisit, type ScanResult } from '@/features/game/visit';
import { useGym } from '@/features/social/api';
import { VISIT } from '@/lib/game/config';
import { minutesText, parseVisitCode, visitMinutes } from '@/lib/game/visits';
import { isDemo } from '@/lib/supabase';
import { clock } from '@/lib/together';
import { useData } from '@/stores/data';
import { accentA, colors, type } from '@/theme/tokens';

export default function VisitScan() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const parsed = parseVisitCode(`/visit/${code}`);
  const authed = useAuth((s) => s.status === 'signedIn');
  const hasProfile = useData((s) => !!s.profile?.id);
  const signedIn = authed && hasProfile;
  const gym = useGym(parsed?.gymId).data?.gym;
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (!signedIn || !parsed || started.current === attempt) return;
    started.current = attempt;
    setError(null);
    scanVisit(parsed)
      .then(setResult)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not read your position'),
      );
  }, [signedIn, parsed, attempt]);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const close = <TextButton label="Done" style={styles.secondary} onPress={done} />;
  const gymName = gym?.name ?? 'the gym';

  if (!parsed)
    return (
      <Screen tabs={false} gap={16}>
        <Head title="Not a gym code" text="This link does not belong to a gym poster." />
        {close}
      </Screen>
    );

  if (!signedIn)
    return (
      <Screen tabs={false} gap={16}>
        <Head
          title="Check in at the gym"
          text="Join Colosseum or sign in first, then scan the poster again."
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

  if (error)
    return (
      <Screen tabs={false} gap={16}>
        <Head title="Could not check in" text={error} />
        <FillButton label="Try again" icon={RotateCcw} onPress={() => setAttempt((n) => n + 1)} />
        {close}
      </Screen>
    );

  if (!result)
    return (
      <Screen tabs={false} gap={16}>
        <Head title="Finding you…" text={`Checking that you are at ${gymName}.`} />
      </Screen>
    );

  const v = result.visit;
  if (result.kind === 'out') {
    const minutes = visitMinutes(v) ?? 0;
    const counted = minutes >= VISIT.minMinutes && minutes <= VISIT.maxMinutes;
    return (
      <Screen tabs={false} gap={16}>
        <Head
          verified
          title="Checked out"
          text={
            counted
              ? `${minutesText(minutes)} at ${gymName}. ${isDemo ? 'Verified.' : 'Verified as soon as it syncs.'} Workouts from this visit earn the full reward.`
              : `${minutesText(minutes)} at ${gymName}. Visits under ${VISIT.minMinutes} minutes or over ${VISIT.maxMinutes / 60} hours do not count for wars.`
          }
        />
        {close}
      </Screen>
    );
  }
  return (
    <Screen tabs={false} gap={16}>
      <Head
        verified={v.in_ok !== false}
        title={result.kind === 'again' ? 'You are checked in' : `Welcome to ${gymName}`}
        text={
          v.in_ok === false
            ? 'This scan could not be verified: the code or the place did not match. Your workout still counts for your log and PRs.'
            : `Checked in at ${clock(new Date(v.in_at))}. Train, then scan the poster again on your way out. If you forget, it closes by itself after ${VISIT.autoCloseHours} hours with a smaller reward.`
        }
      />
      <FillButton
        label="Start training"
        icon={MapPinCheck}
        onPress={() => router.replace('/workouts')}
      />
      {close}
    </Screen>
  );
}

function Head({ title, text, verified }: { title: string; text: string; verified?: boolean }) {
  return (
    <View style={styles.head}>
      <View style={[styles.icon, verified && { backgroundColor: accentA(0.1) }]}>
        <ShieldCheck size={34} color={verified ? colors.accent : colors.text2} strokeWidth={2} />
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
