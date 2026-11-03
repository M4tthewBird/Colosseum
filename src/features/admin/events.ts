/**
 * Usage events for the admin stats: the app was opened today (in the browser or from the Home
 * Screen) and the tour was finished. One row per user, event and day; nothing else is recorded.
 * Best effort: offline or before the admin SQL has run, it is simply skipped.
 */
import { Platform } from 'react-native';

import { toLocalDate } from '@/lib/dates';
import { isDemo, supabase } from '@/lib/supabase';
import { useData } from '@/stores/data';

type EventName = 'open' | 'open_installed' | 'tour_done';

/** Sent this session already, so reopening the app the same day sends nothing. */
const sent = new Set<string>();

async function track(name: EventName): Promise<void> {
  const userId = useData.getState().userId;
  if (isDemo || !userId) return;
  const day = toLocalDate(new Date());
  const key = `${userId}:${name}:${day}`;
  if (sent.has(key)) return;
  sent.add(key);
  const { error } = await supabase
    .from('app_events')
    .upsert(
      { user_id: userId, name, day },
      { onConflict: 'user_id,name,day', ignoreDuplicates: true },
    );
  if (error) sent.delete(key);
}

function installed(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Call when the app opens or comes back to the front, signed in. */
export function trackOpen(): void {
  void track(installed() ? 'open_installed' : 'open').catch(() => {});
}

export function trackTourDone(): void {
  void track('tour_done').catch(() => {});
}
