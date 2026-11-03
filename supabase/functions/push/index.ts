// Colosseum web push (Supabase Edge Function "push"). Deploy it from the dashboard, see
// docs/PUSH.md. It sends to the devices in public.push_subscriptions and drops the ones the
// browser says are gone. Three callers:
//   - the app, signed in: { type: 'test' } to the caller's own devices;
//   - the admin, signed in: { type: 'announcement', title, body } to everyone;
//   - a Database Webhook on feedback inserts (service role): a push to the admins.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Trimmed: a value pasted into the dashboard easily brings a newline along.
const secret = (name: string) => (Deno.env.get(name) ?? '').trim();
webpush.setVapidDetails(
  secret('VAPID_SUBJECT') || 'mailto:admin@colosseum.app',
  secret('VAPID_PUBLIC_KEY'),
  secret('VAPID_PRIVATE_KEY'),
);

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

interface Message {
  title: string;
  body: string;
  /** Path inside the app to open on tap, e.g. "/profile/admin". */
  url?: string;
  /** A newer message with the same tag replaces the older one. */
  tag?: string;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

async function sendTo(subs: Sub[], message: Message): Promise<{ sent: number; gone: number }> {
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 24 * 3600 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser threw the subscription away (notifications off, app removed).
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.warn('push failed', status, (e as Error).message);
      }
    }),
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return { sent, gone: gone.length };
}

async function subsOf(userIds: string[] | null): Promise<Sub[]> {
  let q = db.from('push_subscriptions').select('endpoint,p256dh,auth');
  if (userIds) q = q.in('user_id', userIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The role in the caller's JWT (the gateway has checked the signature already). */
function roleOf(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/i, '').split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

const FEEDBACK_TITLE: Record<string, string> = {
  message: 'New feedback',
  crash: 'Crash report',
  sync: 'Sync refused',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const authHeader = req.headers.get('Authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  try {
    // Database Webhook: a new row in public.feedback.
    if (body.type === 'INSERT' && body.table === 'feedback') {
      if (roleOf(authHeader) !== 'service_role') return json({ error: 'Not allowed' }, 403);
      const f = body.record as { kind: string; message: string; user_id: string };
      const { data: admins } = await db.from('admins').select('user_id');
      const ids = (admins ?? []).map((a) => a.user_id).filter((id) => id !== f.user_id);
      if (!ids.length) return json({ sent: 0 });
      const { data: who } = await db.from('profiles').select('username').eq('id', f.user_id).single();
      return json(
        await sendTo(await subsOf(ids), {
          title: FEEDBACK_TITLE[f.kind] ?? 'Feedback',
          body: `${who?.username ? `@${who.username}: ` : ''}${f.message}`.slice(0, 180),
          url: '/profile/admin',
          tag: `feedback-${f.kind}`,
        }),
      );
    }

    // Signed-in callers: who are they?
    const user = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: me } = await user.auth.getUser();
    if (!me.user) return json({ error: 'Sign in first' }, 401);

    if (body.type === 'test') {
      return json(
        await sendTo(await subsOf([me.user.id]), {
          title: 'Colosseum',
          body: 'Notifications are on. This is what they look like.',
          url: '/profile/settings',
          tag: 'test',
        }),
      );
    }

    if (body.type === 'announcement') {
      const { data: isAdmin } = await user.rpc('is_admin');
      if (!isAdmin) return json({ error: 'Admins only' }, 403);
      const title = String(body.title ?? '').trim().slice(0, 60);
      const text = String(body.body ?? '').trim().slice(0, 180);
      if (!title || !text) return json({ error: 'A title and a text, please' }, 400);
      return json(await sendTo(await subsOf(null), { title, body: text, url: '/', tag: 'announcement' }));
    }

    return json({ error: 'Unknown request' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
