/**
 * Server data for the social features (friends, Arena, gym, feed). Online only, via react-query.
 * In demo mode every call is answered from src/dev/seed.ts plus the local user's own data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEMO_CHALLENGE,
  DEMO_COMMENTS,
  DEMO_FEED,
  DEMO_FRIEND_PRS,
  DEMO_GYM_MEMBERS,
  DEMO_GYMS,
  DEMO_STATS,
  DEMO_TRAINING_NOW,
  DEMO_USERS,
  demoUser,
} from '@/dev/seed';
import { addDays, startOfMonth, startOfWeek, toLocalDate } from '@/lib/dates';
import { e1rm, volume } from '@/lib/formulas';
import { finished } from '@/lib/stats';
import { isDemo, supabase } from '@/lib/supabase';
import type { Gym, PublicUser, Session, SetEntry } from '@/lib/types';
import { useData } from '@/stores/data';
import type { ArenaPeriod } from '@/stores/prefs';

const PUBLIC_COLS = 'id,username,display_name,avatar_url,home_gym_id';

function me(): string {
  return useData.getState().userId;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

// ───────────── Demo state (in memory) ─────────────
const demo = {
  friends: new Set(['tomas', 'adam', 'jakub', 'ondrej', 'filip', 'lukas']),
  incoming: new Set(['petr']),
  outgoing: new Set<string>(),
  liked: new Set<string>(['demo-feed-0']),
  comments: new Map<string, { id: string; user: PublicUser; body: string; created_at: string }[]>(),
  checkedInAt: null as number | null,
  gyms: [...DEMO_GYMS],
};

// ───────────── Friends ─────────────

export interface FriendsData {
  friends: PublicUser[];
  incoming: PublicUser[];
  outgoing: PublicUser[];
}

export function useFriends() {
  return useQuery({
    queryKey: ['friends', me()],
    queryFn: async (): Promise<FriendsData> => {
      if (isDemo) {
        const pick = (s: Set<string>) => DEMO_USERS.filter((u) => s.has(u.username));
        return {
          friends: pick(demo.friends),
          incoming: pick(demo.incoming),
          outgoing: pick(demo.outgoing),
        };
      }
      const uid = me();
      const rows = check(
        await supabase
          .from('friendships')
          .select(
            `requester_id, addressee_id, status,
             requester:profiles!friendships_requester_id_fkey(${PUBLIC_COLS}),
             addressee:profiles!friendships_addressee_id_fkey(${PUBLIC_COLS})`,
          )
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      ) as unknown as {
        requester_id: string;
        status: string;
        requester: PublicUser;
        addressee: PublicUser;
      }[];
      const out: FriendsData = { friends: [], incoming: [], outgoing: [] };
      for (const r of rows) {
        const mine = r.requester_id === uid;
        const other = mine ? r.addressee : r.requester;
        if (r.status === 'accepted') out.friends.push(other);
        else if (mine) out.outgoing.push(other);
        else out.incoming.push(other);
      }
      out.friends.sort((a, b) => a.display_name.localeCompare(b.display_name));
      return out;
    },
  });
}

export async function searchUsers(q: string): Promise<PublicUser[]> {
  const term = q.trim().toLowerCase().replace(/^@/, '');
  if (term.length < 2) return [];
  if (isDemo) return DEMO_USERS.filter((u) => u.username.includes(term));
  return check(
    await supabase
      .from('profiles')
      .select(PUBLIC_COLS)
      .ilike('username', `%${term}%`)
      .neq('id', me())
      .limit(20),
  ) as PublicUser[];
}

type FriendAction = 'request' | 'accept' | 'decline' | 'remove';

async function friendAction(action: FriendAction, other: PublicUser) {
  if (isDemo) {
    const u = other.username;
    if (action === 'request') demo.outgoing.add(u);
    if (action === 'accept') {
      demo.incoming.delete(u);
      demo.friends.add(u);
    }
    if (action === 'decline') {
      demo.incoming.delete(u);
      demo.outgoing.delete(u);
    }
    if (action === 'remove') demo.friends.delete(u);
    return;
  }
  const uid = me();
  if (action === 'request') {
    check(await supabase.from('friendships').insert({ requester_id: uid, addressee_id: other.id }));
  } else if (action === 'accept') {
    check(
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester_id', other.id)
        .eq('addressee_id', uid),
    );
  } else {
    check(
      await supabase
        .from('friendships')
        .delete()
        .or(
          `and(requester_id.eq.${uid},addressee_id.eq.${other.id}),and(requester_id.eq.${other.id},addressee_id.eq.${uid})`,
        ),
    );
  }
}

export function useFriendAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, user }: { action: FriendAction; user: PublicUser }) =>
      friendAction(action, user),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['friends'] });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: ['friends-prs'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// ───────────── Leaderboard ─────────────

export interface RankRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  value: number;
}

/** Resolves 'name:Bench press' to the built-in exercise id. */
export function resolveMetric(metric: string): string {
  if (!metric.startsWith('name:')) return metric;
  const name = metric.slice(5).toLowerCase();
  const ex = Object.values(useData.getState().exercises).find(
    (e) => !e.created_by && e.name.toLowerCase() === name,
  );
  return ex?.id ?? metric;
}

function periodStart(period: ArenaPeriod, now = new Date()): Date | null {
  if (period === 'week') return startOfWeek(now);
  if (period === 'month') return startOfMonth(now);
  return null;
}

/** My own value computed from local data (used in demo mode). */
function myValue(metric: string, period: ArenaPeriod): number | null {
  const since = periodStart(period);
  const sessions = finished(Object.values(useData.getState().sessions)).filter(
    (s) => !since || new Date(s.started_at) >= since,
  );
  if (metric === 'volume') return sessions.reduce((sum, s) => sum + volume(s.sets), 0);
  if (metric === 'workouts') return sessions.length;
  let best = 0;
  for (const s of sessions)
    for (const x of s.sets)
      if (x.done && x.exercise_id === metric) best = Math.max(best, e1rm(x.weight_kg, x.reps));
  return best > 0 ? Math.round(best * 10) / 10 : null;
}

export function useLeaderboard(scope: 'friends' | 'gym', metric: string, period: ArenaPeriod) {
  const resolved = resolveMetric(metric);
  return useQuery({
    queryKey: ['leaderboard', me(), scope, resolved, period],
    queryFn: async (): Promise<RankRow[]> => {
      if (isDemo) return demoLeaderboard(resolved, period);
      const rows = check(
        await supabase.rpc('get_leaderboard', {
          p_scope: scope,
          p_metric: resolved,
          p_period: period,
          p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      ) as RankRow[];
      return rows.map((r) => ({ ...r, rank: Number(r.rank), value: Number(r.value) }));
    },
  });
}

function demoLeaderboard(metric: string, period: ArenaPeriod): RankRow[] {
  const exName = Object.values(useData.getState().exercises).find((e) => e.id === metric)?.name;
  const scale = period === 'week' ? 1 : period === 'month' ? 4.2 : 40;
  const rows: Omit<RankRow, 'rank'>[] = [];
  for (const u of DEMO_USERS.filter((x) => demo.friends.has(x.username))) {
    const st = DEMO_STATS[u.username];
    let value: number | null = null;
    if (metric === 'volume') value = st.weekVolume * scale;
    else if (metric === 'workouts') value = Math.round(st.workouts * scale);
    else if (exName === 'Bench press') value = st.bench;
    else if (exName === 'Squat') value = st.squat;
    else if (exName === 'Deadlift') value = st.deadlift;
    if (value != null)
      rows.push({
        user_id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: null,
        value,
      });
  }
  const p = useData.getState().profile;
  const mine = myValue(metric, period);
  if (p && mine != null) {
    rows.push({
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      value: mine,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ───────────── Friends' PRs ─────────────

export interface FriendPr {
  user: PublicUser;
  exercise: string;
  weight: number;
  reps: number;
  at: string;
}

export function useFriendsPrs() {
  return useQuery({
    queryKey: ['friends-prs', me()],
    queryFn: async (): Promise<FriendPr[]> => {
      if (isDemo) {
        return DEMO_FRIEND_PRS.filter((p) => demo.friends.has(p.user)).map((p) => ({
          user: demoUser(p.user),
          exercise: p.lift,
          weight: p.weight,
          reps: p.reps,
          at: minutesAgo(p.minutesAgo),
        }));
      }
      const rows = check(await supabase.rpc('friends_prs', { p_limit: 5 })) as {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        exercise_name: string;
        weight_kg: number;
        reps: number;
        finished_at: string;
      }[];
      return rows.map((r) => ({
        user: {
          id: r.user_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
        },
        exercise: r.exercise_name,
        weight: Number(r.weight_kg),
        reps: r.reps,
        at: r.finished_at,
      }));
    },
  });
}

// ───────────── Gyms ─────────────

export async function searchGyms(q: string): Promise<Gym[]> {
  const term = q.trim();
  if (isDemo) return demo.gyms.filter((g) => g.name.toLowerCase().includes(term.toLowerCase()));
  let query = supabase.from('gyms').select('id,name,city').order('name').limit(30);
  if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  return check(await query) as Gym[];
}

export async function createGym(name: string, city: string): Promise<Gym> {
  if (isDemo) {
    const g = { id: `demo-gym-${Date.now()}`, name, city: city || null };
    demo.gyms.push(g);
    return g;
  }
  return check(
    await supabase
      .from('gyms')
      .insert({ name: name.trim(), city: city.trim() || null, created_by: me() })
      .select('id,name,city')
      .single(),
  ) as Gym;
}

export function useGym(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym', gymId],
    enabled: !!gymId,
    queryFn: async (): Promise<{ gym: Gym | null; members: number }> => {
      if (isDemo)
        return { gym: demo.gyms.find((g) => g.id === gymId) ?? null, members: DEMO_GYM_MEMBERS };
      const [gym, members] = await Promise.all([
        supabase.from('gyms').select('id,name,city').eq('id', gymId!).maybeSingle(),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('home_gym_id', gymId!),
      ]);
      return { gym: check(gym) as Gym | null, members: members.count ?? 0 };
    },
  });
}

export function useTrainingNow(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['training-now', gymId],
    enabled: !!gymId,
    refetchInterval: 60000,
    queryFn: async (): Promise<PublicUser[]> => {
      if (isDemo) {
        const list = DEMO_TRAINING_NOW.map(demoUser) as PublicUser[];
        const p = useData.getState().profile;
        if (demo.checkedInAt && p) list.unshift(p);
        return list;
      }
      return check(await supabase.rpc('gym_training_now')) as PublicUser[];
    },
  });
}

export function useMyCheckin() {
  return useQuery({
    queryKey: ['my-checkin', me()],
    queryFn: async (): Promise<string | null> => {
      if (isDemo) return demo.checkedInAt ? new Date(demo.checkedInAt).toISOString() : null;
      const since = new Date(Date.now() - 2 * 3600000).toISOString();
      const rows = check(
        await supabase
          .from('gym_checkins')
          .select('checked_in_at')
          .eq('user_id', me())
          .gte('checked_in_at', since)
          .order('checked_in_at', { ascending: false })
          .limit(1),
      ) as { checked_in_at: string }[];
      return rows[0]?.checked_in_at ?? null;
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gymId: string) => {
      if (isDemo) {
        demo.checkedInAt = Date.now();
        return;
      }
      check(await supabase.from('gym_checkins').insert({ user_id: me(), gym_id: gymId }));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-checkin'] });
      void qc.invalidateQueries({ queryKey: ['training-now'] });
    },
  });
}

export interface Challenge {
  id: string;
  title: string;
  target: number;
  ends_on: string;
  gymTotal: number;
  myTotal: number;
}

export function useChallenge(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['challenge', gymId],
    enabled: !!gymId,
    queryFn: async (): Promise<Challenge | null> => {
      if (isDemo) {
        return {
          id: 'demo-challenge',
          title: DEMO_CHALLENGE.title,
          target: DEMO_CHALLENGE.target,
          ends_on: toLocalDate(addDays(new Date(), DEMO_CHALLENGE.daysLeft)),
          gymTotal: DEMO_CHALLENGE.gymTotal,
          myTotal: DEMO_CHALLENGE.myTotal,
        };
      }
      const today = toLocalDate(new Date());
      const rows = check(
        await supabase
          .from('gym_challenges')
          .select('id,title,target,ends_on')
          .eq('gym_id', gymId!)
          .lte('starts_on', today)
          .gte('ends_on', today)
          .order('ends_on')
          .limit(1),
      ) as { id: string; title: string; target: number; ends_on: string }[];
      const c = rows[0];
      if (!c) return null;
      const prog = check(await supabase.rpc('gym_challenge_progress', { p_challenge: c.id })) as {
        gym_total: number;
        my_total: number;
      }[];
      return {
        ...c,
        target: Number(c.target),
        gymTotal: Number(prog[0]?.gym_total ?? 0),
        myTotal: Number(prog[0]?.my_total ?? 0),
      };
    },
  });
}

export interface NewChallenge {
  title: string;
  metric: 'reps' | 'volume' | 'workouts';
  exercise_id: string | null;
  target: number;
  days: number;
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gymId, c }: { gymId: string; c: NewChallenge }) => {
      if (isDemo) return;
      const start = new Date();
      check(
        await supabase.from('gym_challenges').insert({
          gym_id: gymId,
          title: c.title,
          metric: c.metric,
          exercise_id: c.exercise_id,
          target: c.target,
          starts_on: toLocalDate(start),
          ends_on: toLocalDate(addDays(start, c.days)),
          created_by: me(),
        }),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['challenge'] }),
  });
}

// ───────────── Feed ─────────────

export interface FeedItem {
  id: string;
  user: PublicUser;
  name: string;
  started_at: string;
  finished_at: string;
  volume_kg: number;
  pr_count: number;
  likes: number;
  liked: boolean;
  comments: number;
}

export function useFeed() {
  return useQuery({
    queryKey: ['feed', me()],
    queryFn: async (): Promise<FeedItem[]> => {
      if (isDemo) {
        return DEMO_FEED.map((f, i) => {
          const id = `demo-feed-${i}`;
          const liked = demo.liked.has(id);
          const fin = minutesAgo(f.minutesAgo);
          return {
            id,
            user: demoUser(f.user),
            name: f.workout,
            started_at: new Date(new Date(fin).getTime() - f.duration * 60000).toISOString(),
            finished_at: fin,
            volume_kg: f.volume,
            pr_count: f.prs,
            likes: f.likes + (liked ? 1 : 0),
            liked,
            comments: f.comments + (demo.comments.get(id)?.length ?? 0),
          };
        });
      }
      const uid = me();
      const rows = check(
        await supabase
          .from('workout_sessions')
          .select(
            `id,name,started_at,finished_at,volume_kg,pr_count,user_id,
             profiles(${PUBLIC_COLS}), session_likes(count), session_comments(count)`,
          )
          .not('finished_at', 'is', null)
          .neq('user_id', uid)
          .order('finished_at', { ascending: false })
          .limit(30),
      ) as unknown as {
        id: string;
        name: string;
        started_at: string;
        finished_at: string;
        volume_kg: number;
        pr_count: number;
        profiles: PublicUser;
        session_likes: { count: number }[];
        session_comments: { count: number }[];
      }[];
      const ids = rows.map((r) => r.id);
      const mine = ids.length
        ? (check(
            await supabase
              .from('session_likes')
              .select('session_id')
              .eq('user_id', uid)
              .in('session_id', ids),
          ) as { session_id: string }[])
        : [];
      const liked = new Set(mine.map((m) => m.session_id));
      return rows.map((r) => ({
        id: r.id,
        user: r.profiles,
        name: r.name,
        started_at: r.started_at,
        finished_at: r.finished_at,
        volume_kg: Number(r.volume_kg),
        pr_count: r.pr_count,
        likes: r.session_likes[0]?.count ?? 0,
        liked: liked.has(r.id),
        comments: r.session_comments[0]?.count ?? 0,
      }));
    },
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, like }: { sessionId: string; like: boolean }) => {
      if (isDemo) {
        if (like) demo.liked.add(sessionId);
        else demo.liked.delete(sessionId);
        return;
      }
      if (like)
        check(
          await supabase.from('session_likes').upsert({ session_id: sessionId, user_id: me() }),
        );
      else
        check(
          await supabase
            .from('session_likes')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', me()),
        );
    },
    onMutate: async ({ sessionId, like }) => {
      const key = ['feed', me()];
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<FeedItem[]>(key, (old) =>
        old?.map((f) =>
          f.id === sessionId ? { ...f, liked: like, likes: f.likes + (like ? 1 : -1) } : f,
        ),
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export interface Comment {
  id: string;
  user: PublicUser;
  body: string;
  created_at: string;
}

export function useComments(sessionId: string | null) {
  return useQuery({
    queryKey: ['comments', sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<Comment[]> => {
      if (isDemo) {
        const base = sessionId === 'demo-feed-0' ? DEMO_COMMENTS : [];
        return [
          ...base.map((c, i) => ({
            id: `c${i}`,
            user: demoUser(c.user),
            body: c.body,
            created_at: minutesAgo(c.minutesAgo),
          })),
          ...(demo.comments.get(sessionId!) ?? []),
        ];
      }
      const rows = check(
        await supabase
          .from('session_comments')
          .select(`id,body,created_at, profiles(${PUBLIC_COLS})`)
          .eq('session_id', sessionId!)
          .order('created_at'),
      ) as unknown as { id: string; body: string; created_at: string; profiles: PublicUser }[];
      return rows.map((r) => ({
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        user: r.profiles,
      }));
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: string }) => {
      if (isDemo) {
        const p = useData.getState().profile!;
        const list = demo.comments.get(sessionId) ?? [];
        list.push({ id: `${Date.now()}`, user: p, body, created_at: new Date().toISOString() });
        demo.comments.set(sessionId, list);
        return;
      }
      check(
        await supabase
          .from('session_comments')
          .insert({ session_id: sessionId, user_id: me(), body }),
      );
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['comments', v.sessionId] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// ───────────── Other users ─────────────

export interface UserPage {
  user: PublicUser;
  gymName: string | null;
  relation: 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
  /** Finished sessions with sets (empty when their workouts are not visible to me). */
  sessions: Session[];
}

export function useUserPage(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async (): Promise<UserPage> => {
      if (isDemo) return demoUserPage(userId);
      const uid = me();
      const [profile, rel, sessions, sets] = await Promise.all([
        supabase.from('profiles').select(`${PUBLIC_COLS}, gyms(name)`).eq('id', userId).single(),
        supabase
          .from('friendships')
          .select('requester_id,status')
          .or(
            `and(requester_id.eq.${uid},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${uid})`,
          ),
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', userId)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(200),
        supabase
          .from('set_entries')
          .select('*, workout_sessions!inner(user_id,finished_at)')
          .eq('workout_sessions.user_id', userId)
          .eq('done', true)
          .not('workout_sessions.finished_at', 'is', null)
          .limit(5000),
      ]);
      const p = check(profile) as unknown as PublicUser & { gyms: { name: string } | null };
      const r = (check(rel) as { requester_id: string; status: string }[])[0];
      const relation: UserPage['relation'] =
        userId === uid
          ? 'self'
          : !r
            ? 'none'
            : r.status === 'accepted'
              ? 'friend'
              : r.requester_id === uid
                ? 'outgoing'
                : 'incoming';
      const bySession = new Map<string, SetEntry[]>();
      for (const s of check(sets) as (SetEntry & { workout_sessions?: unknown })[]) {
        const { workout_sessions: _w, ...row } = s;
        const list = bySession.get(row.session_id) ?? [];
        list.push({ ...row, weight_kg: Number(row.weight_kg) });
        bySession.set(row.session_id, list);
      }
      const list = (check(sessions) as Omit<Session, 'sets'>[]).map((s) => ({
        ...s,
        volume_kg: Number(s.volume_kg),
        sets: bySession.get(s.id) ?? [],
      }));
      const { gyms, ...user } = p;
      return { user, gymName: gyms?.name ?? null, relation, sessions: list };
    },
  });
}

function demoUserPage(userId: string): UserPage {
  const u = DEMO_USERS.find((x) => x.id === userId);
  const p = useData.getState().profile;
  if (!u && p && p.id === userId) {
    return {
      user: p,
      gymName: DEMO_GYMS[0].name,
      relation: 'self',
      sessions: finished(Object.values(useData.getState().sessions)),
    };
  }
  const user = u ?? DEMO_USERS[0];
  const relation = demo.friends.has(user.username)
    ? 'friend'
    : demo.incoming.has(user.username)
      ? 'incoming'
      : demo.outgoing.has(user.username)
        ? 'outgoing'
        : 'none';
  // Friends get a copy of my history scaled to their level, which is enough for a preview.
  const factor = (DEMO_STATS[user.username]?.bench ?? 100) / 100;
  const sessions =
    relation === 'friend'
      ? finished(Object.values(useData.getState().sessions))
          .slice(0, 40)
          .map((s) => ({
            ...s,
            id: `${user.username}-${s.id}`,
            user_id: user.id,
            sets: s.sets.map((x) => ({
              ...x,
              weight_kg: Math.round((x.weight_kg * factor) / 2.5) * 2.5,
            })),
          }))
      : [];
  return { user, gymName: DEMO_GYMS[0].name, relation, sessions };
}
