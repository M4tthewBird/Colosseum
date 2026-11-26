/**
 * The places of the City tab that hold a part of the game: the Colosseum (league, duels, Bellum),
 * the ludus, the temple (your gym's tribe) and your domus (your gladiator). They used to be
 * sections of the Arena and of the Profile.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { IconButton } from '@/components/Buttons';
import { Map as MapIcon } from '@/components/icons';
import { EmptyState } from '@/components/List';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { ScopeTabs } from '@/features/arena/Ranks';
import { useGym } from '@/features/social/api';
import { useData } from '@/stores/data';
import { usePrefs, type ColosseumMode } from '@/stores/prefs';
import { type } from '@/theme/tokens';
import { BellumView } from './BellumView';
import { CityTopBar } from './CityViews';
import { DuelsView } from './DuelsView';
import { FortressView } from './FortressView';
import { GladiatorView } from './GladiatorView';
import { LeagueView } from './LeagueView';
import { LudusView } from './LudusView';

const MODES: { value: ColosseumMode; label: string }[] = [
  { value: 'league', label: 'League' },
  { value: 'duels', label: 'Duels' },
  { value: 'bellum', label: 'Bellum' },
];
const ABOUT: Record<ColosseumMode, string> = {
  league: 'Laurels from your training put you in a league. A new season every month.',
  duels: 'One on one with friends, a week at a time.',
  bellum: 'Gym against gym: the monthly war of the gyms in your city.',
};
const isMode = (m: unknown): m is ColosseumMode => MODES.some((x) => x.value === m);

export function ColosseumScreen() {
  const mode = usePrefs((s) => s.colosseumMode);
  const setMode = usePrefs((s) => s.setColosseumMode);
  const scope = usePrefs((s) => s.arenaScope);
  const setScope = usePrefs((s) => s.setArenaScope);
  // ?mode=league (Today's season card) opens a section, also when the Colosseum is already open.
  const { mode: asked } = useLocalSearchParams<{ mode?: string }>();
  const [lastAsked, setLastAsked] = useState<string | undefined>(undefined);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (isMode(asked)) setMode(asked);
  }
  return (
    <Screen glow="center" glowTop={260} gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <CityTopBar title="Colosseum" />
        </View>
        <IconButton
          icon={MapIcon}
          accessibilityLabel="The map of your city"
          onPress={() => router.push('/city/map')}
        />
      </View>
      <Segmented
        options={MODES}
        value={mode}
        onChange={setMode}
        height={34}
        accessibilityLabel="Colosseum sections"
      />
      <Text style={type.caption}>{ABOUT[mode]}</Text>
      {mode === 'league' ? (
        <>
          <View style={{ alignSelf: 'flex-start' }}>
            <ScopeTabs value={scope} onChange={setScope} />
          </View>
          <LeagueView scope={scope} />
        </>
      ) : mode === 'duels' ? (
        <DuelsView />
      ) : (
        <BellumView />
      )}
    </Screen>
  );
}

export function LudusScreen() {
  return (
    <Screen glow="center" gap={16}>
      <CityTopBar title="Clan" />
      <Text style={type.caption}>Your crew of 3–10 across gyms, its fortress and its wars.</Text>
      <LudusView />
    </Screen>
  );
}

export function TempleScreen() {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym;
  return (
    <Screen glow="center" gap={16}>
      <CityTopBar title="Temple" />
      {gymId ? (
        <>
          <Text style={type.caption}>
            Your tribe is everyone who trains at {gym?.name ?? 'your gym'}. Its fortress grows with
            the denarii its members give.
          </Text>
          <FortressView kind="gym" id={gymId} title={gym?.name ?? 'Gym'} />
        </>
      ) : (
        <EmptyState
          title="No home gym"
          text="The temple belongs to your gym’s tribe. Pick your home gym in Profile → Settings to join it."
        />
      )}
    </Screen>
  );
}

export function DomusScreen() {
  return (
    <Screen glow="center" gap={16}>
      <CityTopBar title="Your domus" />
      <GladiatorView />
    </Screen>
  );
}
