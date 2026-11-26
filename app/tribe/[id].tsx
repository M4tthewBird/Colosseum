import { useLocalSearchParams } from 'expo-router';

import { EnemyScreen } from '@/features/game/MapViews';

export default function Tribe() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <EnemyScreen id={id} />;
}
