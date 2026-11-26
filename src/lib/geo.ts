/** The device's position for a gym scan. Works on web (browser location) and native. */
import * as Location from 'expo-location';

export interface Position {
  lat: number;
  lng: number;
  /** Metres. */
  acc: number | null;
}

export async function currentPosition(): Promise<Position> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted)
    throw new Error('Allow location for Colosseum: it checks that you are at the gym.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? null };
}
