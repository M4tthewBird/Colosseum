/**
 * The gym's QR poster, for its manager: save the gym's position once (standing in the gym), then
 * print the poster for the desk. Members scan it when they arrive and when they leave.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton, TextButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { MapPin, Printer } from '@/components/icons';
import { LogoMark, Wordmark } from '@/components/Logo';
import { QrCode } from '@/components/QrCode';
import { Header, Screen } from '@/components/Screen';
import { fetchPoster, useGymManager } from '@/features/game/api';
import { useGym } from '@/features/social/api';
import { VISIT } from '@/lib/game/config';
import { visitPath } from '@/lib/game/visits';
import { currentPosition } from '@/lib/geo';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

export default function GymPoster() {
  const { gymId = '' } = useLocalSearchParams<{ gymId: string }>();
  const gym = useGym(gymId).data?.gym;
  const manager = useGymManager(gymId);
  const qc = useQueryClient();
  const poster = useQuery({
    queryKey: ['poster', gymId],
    enabled: !!manager.data,
    queryFn: () => fetchPoster(gymId),
  });
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      const data = await fetchPoster(gymId, pos);
      qc.setQueryData(['poster', gymId], data);
      toast('The gym’s position is saved');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read your position');
    } finally {
      setLocating(false);
    }
  };

  const data = poster.data;
  const placed = data?.lat != null;

  return (
    <Screen tabs={false} gap={16}>
      <BackLink label="Arena" fallback="/arena" />
      <Header title="QR poster" above={gym?.name} />
      {manager.isLoading ? (
        <Text style={type.caption}>Loading…</Text>
      ) : !manager.data ? (
        <Text style={type.caption}>
          Only the gym’s manager (whoever added it to Colosseum) can make its poster.
        </Text>
      ) : !placed ? (
        <View style={{ gap: 12 }}>
          <Text style={type.caption}>
            First, stand inside {gym?.name ?? 'the gym'} and save its position. Scans more than{' '}
            {VISIT.radiusM} m away will not count.
          </Text>
          <FillButton
            label={locating ? 'Finding you…' : 'Use my location'}
            icon={MapPin}
            disabled={locating}
            onPress={() => void locate()}
          />
        </View>
      ) : data ? (
        <>
          <Glass radius={26} style={styles.poster}>
            <Wordmark />
            <Text style={[type.title, { textAlign: 'center' }]}>{gym?.name}</Text>
            <View style={styles.code}>
              <QrCode value={Linking.createURL(visitPath(gymId, data.signature))} size={240} />
            </View>
            <Text style={[type.bodyStrong, { textAlign: 'center' }]}>
              Scan when you arrive and when you leave
            </Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              Open the phone camera or Colosseum → Today → Check in. Verified workouts earn more and
              count in wars.
            </Text>
            <LogoMark size={28} />
          </Glass>
          {Platform.OS === 'web' ? (
            <FillButton label="Print" icon={Printer} onPress={() => window.print()} />
          ) : null}
          <TextButton
            label={locating ? 'Finding you…' : 'Update the gym’s position'}
            style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
            disabled={locating}
            onPress={() => void locate()}
          />
        </>
      ) : (
        <Text style={type.caption}>
          {poster.isError ? 'Could not load. Are you online?' : 'Loading…'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  poster: { padding: 24, gap: 14, alignItems: 'center' },
  code: { padding: 14, backgroundColor: colors.white, borderRadius: 20 },
});
