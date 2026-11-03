/**
 * Feedback and error reports for the admin (Settings → Admin → Feedback). The user writes one in
 * Settings → Send feedback; crashes and syncs the server refuses are sent on their own. Every
 * report carries the app version, the device and the screen, never workout or body data.
 * Online only and best effort: an automatic report that cannot be sent is not retried.
 */
import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Dimensions, Platform } from 'react-native';

import { CHANGELOG } from '@/data/changelog';
import { toLocalDate } from '@/lib/dates';
import { safeStorage } from '@/lib/storage';
import { isDemo, supabase } from '@/lib/supabase';
import { setRefusedListener } from '@/lib/sync';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

export type FeedbackKind = 'message' | 'crash' | 'sync';

/** The screen the user is on, kept up to date by the root layout. */
let currentRoute = '';
export function setCurrentRoute(route: string): void {
  currentRoute = route;
}

/** What helps to find a problem: version, device, screen. */
export function appInfo(): Record<string, unknown> {
  const { width, height } = Dimensions.get('window');
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  return {
    version: Constants.expoConfig?.version ?? null,
    release: CHANGELOG[0]?.id ?? null,
    platform: Platform.OS,
    device: web ? navigator.userAgent : `${Platform.OS} ${String(Platform.Version)}`,
    screen: `${Math.round(width)}×${Math.round(height)}`,
    installed: web
      ? window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      : true,
    route: currentRoute || null,
  };
}

async function uploadScreenshot(userId: string, id: string, uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1080 });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const body = await (await fetch(result.uri)).arrayBuffer();
  const path = `${userId}/${id}.jpg`;
  const { error } = await supabase.storage
    .from('feedback')
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

export async function sendFeedback(input: {
  kind: FeedbackKind;
  message: string;
  details?: Record<string, unknown>;
  screenshotUri?: string | null;
}): Promise<void> {
  const userId = useData.getState().userId;
  if (isDemo) return;
  if (!userId) throw new Error('Sign in to send feedback.');
  const id = uuid();
  const screenshot = input.screenshotUri
    ? await uploadScreenshot(userId, id, input.screenshotUri)
    : null;
  const { error } = await supabase.from('feedback').insert({
    id,
    user_id: userId,
    kind: input.kind,
    message: input.message.trim().slice(0, 2000),
    details: { ...appInfo(), ...input.details },
    screenshot,
  });
  if (error) throw new Error(error.message);
}

// ───────────── Automatic reports ─────────────

const SENT_KEY = 'colosseum-reported';
/** The same problem is reported once a day per device, however often it happens. */
async function firstToday(key: string): Promise<boolean> {
  const today = toLocalDate(new Date());
  let sent: Record<string, string> = {};
  try {
    sent = JSON.parse((await safeStorage.getItem(SENT_KEY)) ?? '{}') as Record<string, string>;
  } catch {
    sent = {};
  }
  if (sent[key] === today) return false;
  // Forget other days, so the list stays small.
  const kept = Object.fromEntries(Object.entries(sent).filter(([, day]) => day === today));
  await safeStorage.setItem(SENT_KEY, JSON.stringify({ ...kept, [key]: today }));
  return true;
}

function autoReport(kind: FeedbackKind, key: string, message: string, details: object) {
  if (isDemo || !useData.getState().userId) return;
  void (async () => {
    if (!(await firstToday(`${kind}:${key}`))) return;
    await sendFeedback({ kind, message, details: details as Record<string, unknown> });
  })().catch(() => {});
}

/** A crash: the crash screen, or an error nothing caught. */
export function reportCrash(error: unknown, where: string): void {
  const e = error instanceof Error ? error : new Error(String(error));
  const message = e.message || e.name || 'Unknown error';
  autoReport('crash', `${message}@${currentRoute}`, message, {
    where,
    name: e.name,
    stack: e.stack?.split('\n').slice(0, 12).join('\n') ?? null,
  });
}

/** Errors the browser reports that are not ours or not real problems. */
function noise(message: string, file?: string): boolean {
  if (/ResizeObserver loop|^Script error\.?$/i.test(message)) return true;
  // Offline in the gym: a failed request is not a bug.
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(message)) return true;
  return !!file && typeof window !== 'undefined' && !file.startsWith(window.location.origin);
}

let started = false;

/** Starts sending crashes nothing caught and refused syncs. Call once from the root layout. */
export function startErrorReports(): void {
  if (started || isDemo) return;
  started = true;
  setRefusedListener((item, message) =>
    autoReport('sync', `${item.table}:${item.op}:${message}`, message, {
      table: item.table,
      op: item.op,
      row: item.id,
    }),
  );
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    if (noise(ev.message, ev.filename)) return;
    reportCrash(ev.error ?? ev.message, 'window');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason: unknown = ev.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (noise(message)) return;
    reportCrash(reason, 'promise');
  });
}
