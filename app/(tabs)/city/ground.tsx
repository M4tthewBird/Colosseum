/** City → a training ground (ludus or tribe) or your house, as a grid you build on. */
import { useLocalSearchParams } from 'expo-router';

import { PaintedGround } from '@/features/game/city/PaintedGround';

export default function Ground() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const k = kind === 'gym' || kind === 'home' ? kind : 'ludus';
  return <PaintedGround kind={k} id={k === 'home' ? null : (id ?? null)} />;
}
