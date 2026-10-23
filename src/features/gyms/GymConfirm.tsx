/**
 * "Training at Iron Forum?" before a workout starts. At the home gym it checks you in (friends
 * there see you under Training now); another gym or no gym is only saved with the workout.
 * Driven by askGym(), like confirm() in stores/ui; GymConfirmHost renders it once at the root.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { FillButton, TextButton } from '@/components/Buttons';
import { MapPin } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { checkIn, createGym, useGym } from '@/features/social/api';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { GymPicker } from './GymPicker';

/** Where the workout happens: a gym id, null for no gym, or 'cancel' to not start. */
export type GymAnswer = { gymId: string | null } | 'cancel';

const useAsk = create<{ resolve: ((a: GymAnswer) => void) | null }>()(() => ({ resolve: null }));

export function askGym(): Promise<GymAnswer> {
  return new Promise((resolve) => useAsk.setState({ resolve }));
}

export function GymConfirmHost() {
  const resolve = useAsk((s) => s.resolve);
  const homeId = useData((s) => s.profile?.home_gym_id ?? null);
  const home = useGym(homeId);
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const homeName = home.data?.gym?.name ?? (homeId ? 'your gym' : null);

  const answer = (a: GymAnswer) => {
    resolve?.(a);
    useAsk.setState({ resolve: null });
    setPicking(false);
  };

  const atHome = () => {
    answer({ gymId: homeId });
    // Best effort: offline it just does not show under Training now.
    void checkIn(homeId!)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ['my-checkin'] });
        void qc.invalidateQueries({ queryKey: ['training-now'] });
      })
      .catch(() => undefined);
  };

  return (
    <>
      <Sheet visible={!!resolve && !picking} onClose={() => answer('cancel')} title="Start workout">
        <View style={styles.head}>
          <View style={styles.pin}>
            <MapPin size={26} color={colors.accent} strokeWidth={2} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>
            {homeName ? `Training at ${homeName}?` : 'Where are you training?'}
          </Text>
          {homeName ? (
            <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
              Yes checks you in, so your gym sees you under Training now.
            </Text>
          ) : null}
        </View>
        {homeName ? <FillButton label="Yes, I’m here" icon={MapPin} onPress={atHome} /> : null}
        <FillButton
          label={homeName ? 'Another gym' : 'Choose a gym'}
          loading={busy}
          onPress={() => setPicking(true)}
        />
        <TextButton
          label="Not at a gym"
          style={styles.none}
          onPress={() => answer({ gymId: null })}
        />
      </Sheet>
      <GymPicker
        visible={!!resolve && picking}
        title="Training at"
        hint="Saved with this workout. Your home gym stays the same."
        onClose={() => setPicking(false)}
        onPick={async (g) => {
          if ('id' in g) return answer({ gymId: g.id });
          setBusy(true);
          try {
            answer({ gymId: (await createGym(g.name, g.city)).id });
          } catch {
            toast('Could not add the gym. Starting without it');
            answer({ gymId: null });
          } finally {
            setBusy(false);
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
  none: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
});
