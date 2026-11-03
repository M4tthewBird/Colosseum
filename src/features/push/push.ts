/**
 * Web push on this device: turning it on asks the browser for permission, subscribes through the
 * service worker (public/sw.js) and saves the subscription (supabase/updates/2026-11-03-push.sql).
 * The "push" Edge Function sends (supabase/functions/push). On iPhone it only works in the app
 * added to the Home Screen (iOS 16.4+), and the permission can only be asked from a tap.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isDemo, supabase } from '@/lib/supabase';

/** VAPID public key: identifies our server to the browsers' push services. Public by design. */
const VAPID_PUBLIC_KEY =
  'BLqKEd2qkiVziWVZkElIkuiB6L-i8RxoF_FqD0Y-pjI7CUQabdqJh1I6x1OJlJIaAmn7wSWGSEYPyv_f7BKt6Zw';

export type PushState =
  /** Works here and is on. */
  | 'on'
  /** Works here, off (never asked, or turned off in the app). */
  | 'off'
  /** The user said no in the browser or phone settings: only they can change it there. */
  | 'blocked'
  /** iPhone in Safari: add to the Home Screen first. */
  | 'needs-install'
  /** This browser has no web push (or the app runs as a dev build without a service worker). */
  | 'unsupported';

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';

function isIos(): boolean {
  if (!web()) return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function standalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supported(): boolean {
  return (
    web() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  // Only the production build registers the service worker (app/+html.tsx).
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (isDemo) return 'unsupported';
  if (isIos() && !standalone()) return 'needs-install';
  const reg = await registration();
  if (!reg) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toBase64url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Call from a tap. Returns the new state ('blocked' when the user said no). */
export async function enablePush(): Promise<PushState> {
  const reg = await registration();
  if (!reg) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: toBase64url(sub.getKey('p256dh')),
    p_auth: toBase64url(sub.getKey('auth')),
  });
  if (error) {
    await sub.unsubscribe().catch(() => {});
    throw new Error(error.message);
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return pushState();
}

/**
 * The subscription can change behind our back (the browser renews it, or another account signed
 * in on this phone). Saving it again on every start keeps the server's copy right.
 */
export async function refreshPush(): Promise<void> {
  if (isDemo) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return;
  await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: toBase64url(sub.getKey('p256dh')),
    p_auth: toBase64url(sub.getKey('auth')),
  });
}

async function invoke(body: object): Promise<{ sent: number }> {
  const { data, error } = await supabase.functions.invoke('push', { body });
  if (error) throw new Error(error.message);
  return data as { sent: number };
}

/** A notification to this account's devices, to see that it works. */
export function sendTestPush() {
  return invoke({ type: 'test' });
}

/** Admin: to everyone with notifications on. */
export function sendAnnouncement(title: string, body: string) {
  return invoke({ type: 'announcement', title, body });
}

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = useCallback(() => {
    void pushState()
      .then(setState)
      .catch(() => setState('unsupported'));
  }, []);
  useEffect(refresh, [refresh]);
  return { state, setState, refresh };
}
