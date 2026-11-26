import { useLocalSearchParams } from 'expo-router';

import { TribeWarScreen } from '@/features/game/MapViews';

export default function TribeWar() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <TribeWarScreen id={id} />;
}
