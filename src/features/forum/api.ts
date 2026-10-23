/**
 * The Forum: workouts shared with friends and the home gym, with likes and comments. Online only, via
 * react-query. In demo mode posts come from src/dev/seed.ts plus what you post in this session.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_FORUM, DEMO_FORUM_COMMENTS, demoUser } from '@/dev/seed';
import type { ForumWorkout } from '@/lib/forum';
import { isDemo, supabase } from '@/lib/supabase';
import { syncRow } from '@/lib/sync';
import type { PublicUser } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

const PUBLIC_COLS = 'id,username,display_name,avatar_url,home_gym_id';

export interface ForumPost {
  id: string;
  user: PublicUser;
  title: string;
  body: string;
  workout: ForumWorkout;
  created_at: string;
  likes: number;
  liked: boolean;
  comments: number;
}

export interface ForumComment {
  id: string;
  user: PublicUser;
  body: string;
  created_at: string;
}

const me = () => useData.getState().userId;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ───────────── Demo state (in memory) ─────────────
const demo = {
  posts: DEMO_FORUM.map((p, i) => ({
    id: `demo-post-${i}`,
    user: demoUser(p.user),
    title: p.title,
    body: p.body,
    workout: p.workout as ForumWorkout,
    created_at: minutesAgo(p.minutesAgo),
    likes: p.likes,
    liked: false,
    comments: 0,
  })) as ForumPost[],
  comments: new Map<string, ForumComment[]>([
    [
      'demo-post-0',
      DEMO_FORUM_COMMENTS.map((c, i) => ({
        id: `dc${i}`,
        user: demoUser(c.user),
        body: c.body,
        created_at: minutesAgo(c.minutesAgo),
      })),
    ],
  ]),
};
const demoPosts = () =>
  demo.posts.map((p) => ({ ...p, comments: demo.comments.get(p.id)?.length ?? 0 }));

type PostRow = {
  id: string;
  title: string;
  body: string;
  workout: ForumWorkout;
  created_at: string;
  profiles: PublicUser;
  forum_likes: { count: number }[];
  forum_comments: { count: number }[];
};

const postSelect = (innerAuthor = false) => `id,title,body,workout,created_at,
  profiles!forum_posts_user_id_fkey${innerAuthor ? '!inner' : ''}(${PUBLIC_COLS}), forum_likes(count), forum_comments(count)`;

async function withLiked(rows: PostRow[]): Promise<ForumPost[]> {
  const ids = rows.map((r) => r.id);
  const mine = ids.length
    ? (check(
        await supabase.from('forum_likes').select('post_id').eq('user_id', me()).in('post_id', ids),
      ) as { post_id: string }[])
    : [];
  const liked = new Set(mine.map((m) => m.post_id));
  return rows.map((r) => ({
    id: r.id,
    user: r.profiles,
    title: r.title,
    body: r.body,
    workout: r.workout,
    created_at: r.created_at,
    likes: r.forum_likes[0]?.count ?? 0,
    liked: liked.has(r.id),
    comments: r.forum_comments[0]?.count ?? 0,
  }));
}

/**
 * 'friends': my friends and me. 'gym': people of my home gym (me included). 'all': both — what
 * RLS lets me read anyway.
 */
export type ForumScope = 'friends' | 'gym' | 'all';

/**
 * Newest posts first. Friend ids come from useFriends (pass them for the 'friends' scope); kind
 * keeps only one kind of workout ("Push", "Legs"…).
 */
export function useForumPosts(
  scope: ForumScope,
  limit = 30,
  friendIds: string[] = [],
  kind: string | null = null,
) {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const ids = [me(), ...friendIds];
  return useQuery({
    queryKey: ['forum', scope, limit, scope === 'friends' ? ids.join() : gymId, kind],
    queryFn: async (): Promise<ForumPost[]> => {
      if (isDemo) {
        return demoPosts()
          .filter((p) => !kind || p.workout.kind === kind)
          .filter((p) =>
            scope === 'friends'
              ? ids.includes(p.user.id)
              : scope === 'gym'
                ? !!gymId && p.user.home_gym_id === gymId
                : true,
          )
          .slice(0, limit);
      }
      if (scope === 'gym' && !gymId) return [];
      let q = supabase
        .from('forum_posts')
        // Filtering on the author's gym needs an inner join on profiles.
        .select(postSelect(scope === 'gym'));
      if (scope === 'friends') q = q.in('user_id', ids);
      if (scope === 'gym') q = q.eq('profiles.home_gym_id', gymId!);
      if (kind) q = q.eq('workout->>kind', kind);
      const rows = check(
        await q.order('created_at', { ascending: false }).limit(limit),
      ) as unknown as PostRow[];
      return withLiked(rows);
    },
  });
}

export function useForumPost(id: string) {
  return useQuery({
    queryKey: ['forum-post', id],
    queryFn: async (): Promise<ForumPost | null> => {
      if (isDemo) return demoPosts().find((p) => p.id === id) ?? null;
      const rows = check(
        await supabase.from('forum_posts').select(postSelect()).eq('id', id).limit(1),
      ) as unknown as PostRow[];
      return (await withLiked(rows))[0] ?? null;
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, postId?: string) {
  void qc.invalidateQueries({ queryKey: ['forum'] });
  if (postId) void qc.invalidateQueries({ queryKey: ['forum-post', postId] });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      title: string;
      body: string;
      workout: ForumWorkout;
      sessionId: string | null;
    }): Promise<string> => {
      if (isDemo) {
        const id = uuid();
        demo.posts.unshift({
          id,
          user: useData.getState().profile!,
          title: p.title,
          body: p.body,
          workout: p.workout,
          created_at: new Date().toISOString(),
          likes: 0,
          liked: false,
          comments: 0,
        });
        return id;
      }
      // The database only links a post to a workout it already has. Right after finishing, the
      // workout may still be in the offline queue: send it first, and if it does not get there
      // in time, share without the link (the post carries its own copy of the workout).
      const linked = p.sessionId ? await syncRow('workout_sessions', p.sessionId) : false;
      const row = check(
        await supabase
          .from('forum_posts')
          .insert({
            user_id: me(),
            session_id: linked ? p.sessionId : null,
            title: p.title,
            body: p.body,
            workout: p.workout,
          })
          .select('id')
          .single(),
      ) as { id: string };
      return row.id;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        demo.posts = demo.posts.filter((p) => p.id !== id);
        return;
      }
      check(await supabase.from('forum_posts').delete().eq('id', id));
    },
    onSuccess: (_d, id) => invalidate(qc, id),
  });
}

export function useToggleForumLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, like }: { postId: string; like: boolean }) => {
      if (isDemo) {
        demo.posts = demo.posts.map((p) =>
          p.id === postId ? { ...p, liked: like, likes: p.likes + (like ? 1 : -1) } : p,
        );
        return;
      }
      if (like)
        check(await supabase.from('forum_likes').upsert({ post_id: postId, user_id: me() }));
      else
        check(
          await supabase.from('forum_likes').delete().eq('post_id', postId).eq('user_id', me()),
        );
    },
    onMutate: async ({ postId, like }) => {
      const flip = (p: ForumPost) =>
        p.id === postId ? { ...p, liked: like, likes: p.likes + (like ? 1 : -1) } : p;
      qc.setQueriesData<ForumPost[]>({ queryKey: ['forum'] }, (old) => old?.map(flip));
      qc.setQueryData<ForumPost | null>(['forum-post', postId], (old) => (old ? flip(old) : old));
    },
    onSettled: (_d, _e, v) => invalidate(qc, v.postId),
  });
}

export function useForumComments(postId: string | null) {
  return useQuery({
    queryKey: ['forum-comments', postId],
    enabled: !!postId,
    queryFn: async (): Promise<ForumComment[]> => {
      if (isDemo) return demo.comments.get(postId!) ?? [];
      const rows = check(
        await supabase
          .from('forum_comments')
          .select(`id,body,created_at, profiles(${PUBLIC_COLS})`)
          .eq('post_id', postId!)
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

export function useAddForumComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      if (isDemo) {
        const list = demo.comments.get(postId) ?? [];
        list.push({
          id: uuid(),
          user: useData.getState().profile!,
          body,
          created_at: new Date().toISOString(),
        });
        demo.comments.set(postId, list);
        return;
      }
      check(await supabase.from('forum_comments').insert({ post_id: postId, user_id: me(), body }));
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['forum-comments', v.postId] });
      invalidate(qc, v.postId);
    },
  });
}
