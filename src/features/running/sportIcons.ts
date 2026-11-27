/** The icon of each cardio sport: a run, a ride, a swim. */
import { Bike, Footprints, WavesLadder, type LucideIcon } from '@/components/icons';
import type { Sport } from '@/lib/cardio';

export const SPORT_ICONS: Record<Sport, LucideIcon> = {
  run: Footprints,
  ride: Bike,
  swim: WavesLadder,
};
