import { useLocalSearchParams } from 'expo-router';

import { CompareScreen } from '@/features/game/MapViews';

export default function Compare() {
  const { gym = '', user = '0' } = useLocalSearchParams<{ gym: string; user?: string }>();
  return <CompareScreen gym={gym} user={Number(user) || 0} />;
}
