/**
 * Training together: plans ("going to train at 17:30"), invites, and workouts confirmed by QR code.
 * Online only, via react-query. In demo mode everything comes from src/dev/seed.ts plus what you
 * do in this session.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_PLANS, DEMO_TOGETHER, demoUser } from '@/dev/seed';
import { isDemo, supabase } from '@/lib/supabase';
import { planIsLive, sortPlans } from '@/lib/together';
import type { PublicUser } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

const PUBLIC_COLS = 'id,username,display_name,avatar_url';
/** How long a plan stays listed after its time (see planIsLive). */
const LIVE_MS = 2 * 3600000;

const me = () => useData.getState().userId;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export interface TrainingPlan {
  id: string;
  user: PublicUser;
  planned_at: string;
  gymName: string | null;
  note: string;
  invitee: PublicUser | null;
  inviteeId: string | null;
  /** People who said they are in. */
  going: PublicUser[];
  /** My answer: in, can't make it, or not answered yet. */
  myAnswer: boolean | null;
}

export interface NewPlan {
  planned_at: string;
  gym_id: string | null;
  gymName: string | null;
  note: string;
  invitee: PublicUser | null;
}

export interface TogetherEntry {
  id: string;
  owner: PublicUser;
  user: PublicUser;
  confirmed_at: string;
}

export interface TogetherSession {
  owner: PublicUser;
  name: string;
  finished_at: string | null;
  confirmed: boolean;
}

const myself = (): PublicUser => {
  const p = useData.getState().profile;
  return {
    id: me(),
    username: p?.username ?? '',
    display_name: p?.display_name ?? '',
    avatar_url: p?.avatar_url ?? null,
  };
};

// ───────────── Demo state (in memory) ─────────────
/** Stands for the signed-in user, who is not known yet when this file loads. */
const DEMO_ME = 'me';

const demo = {
  plans: DEMO_PLANS.map((p, i): TrainingPlan => {
    const user = demoUser(p.user);
    return {
      id: `demo-plan-${i}`,
      user,
      planned_at: minutesAgo(-p.inMinutes),
      gymName: 'Iron Forum',
      note: p.note,
      invitee: null,
      inviteeId: p.invitesMe ? DEMO_ME : null,
      going: p.going.map(demoUser),
      myAnswer: null,
    };
  }),
  together: DEMO_TOGETHER.map((t, i): TogetherEntry => ({
    id: `demo-together-${i}`,
    owner: demoUser(t.owner),
    user: demoUser(t.user),
    confirmed_at: minutesAgo(t.minutesAgo),
  })),
  // Sessions someone confirmed in this demo.
  confirmed: new Set<string>(),
};

/** How many confirmed workouts I have in demo mode (for the demo leaderboard). */
export const demoTogetherCount = () =>
  demo.together.filter((t) => t.owner.id === me() || t.user.id === me()).length;

// ───────────── Plans ─────────────

interface PlanRow {
  id: string;
  planned_at: string;
  note: string;
  invitee_id: string | null;
  user: PublicUser;
  invitee: PublicUser | null;
  gym: { name: string } | null;
  answers: { going: boolean; user: PublicUser }[];
}

export function useTrainingPlans() {
  return useQuery({
    queryKey: ['training-plans', me()],
    refetchInterval: 60000,
    queryFn: async (): Promise<TrainingPlan[]> => {
      if (isDemo) {
        return sortPlans(
          demo.plans
            .filter((p) => planIsLive(p.planned_at))
            .map((p) =>
              p.inviteeId === DEMO_ME ? { ...p, invitee: myself(), inviteeId: me() } : p,
            ),
          me(),
        );
      }
      const rows = check(
        await supabase
          .from('training_plans')
          .select(
            `id, planned_at, note, invitee_id,
             user:profiles!training_plans_user_id_fkey(${PUBLIC_COLS}),
             invitee:profiles!training_plans_invitee_id_fkey(${PUBLIC_COLS}),
             gym:gyms(name),
             answers:training_plan_answers(going, user:profiles!training_plan_answers_user_id_fkey(${PUBLIC_COLS}))`,
          )
          .gte('planned_at', new Date(Date.now() - LIVE_MS).toISOString())
          .order('planned_at')
          .limit(30),
      ) as unknown as PlanRow[];
      const uid = me();
      return sortPlans(
        rows.map((r) => ({
          id: r.id,
          user: r.user,
          planned_at: r.planned_at,
          gymName: r.gym?.name ?? null,
          note: r.note,
          invitee: r.invitee,
          inviteeId: r.invitee_id,
          going: r.answers.filter((a) => a.going).map((a) => a.user),
          myAnswer: r.answers.find((a) => a.user.id === uid)?.going ?? null,
        })),
        uid,
      );
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: NewPlan) => {
      if (isDemo) {
        demo.plans.push({
          id: uuid(),
          user: myself(),
          planned_at: p.planned_at,
          gymName: p.gymName,
          note: p.note,
          invitee: p.invitee,
          inviteeId: p.invitee?.id ?? null,
          going: [],
          myAnswer: null,
        });
        return;
      }
      check(
        await supabase.from('training_plans').insert({
          user_id: me(),
          planned_at: p.planned_at,
          gym_id: p.gym_id,
          note: p.note,
          invitee_id: p.invitee?.id ?? null,
        }),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });
}

export function useAnswerPlan() {
  const qc = useQueryClient();
  return useMutation({
    /** going: in or can't make it; null takes the answer back. */
    mutationFn: async ({ planId, going }: { planId: string; going: boolean | null }) => {
      if (isDemo) {
        const p = demo.plans.find((x) => x.id === planId);
        if (!p) return;
        p.myAnswer = going;
        p.going = p.going.filter((u) => u.id !== me());
        if (going) p.going.push(myself());
        return;
      }
      if (going === null) {
        check(
          await supabase
            .from('training_plan_answers')
            .delete()
            .eq('plan_id', planId)
            .eq('user_id', me()),
        );
        return;
      }
      check(
        await supabase
          .from('training_plan_answers')
          .upsert(
            { plan_id: planId, user_id: me(), going, updated_at: new Date().toISOString() },
            { onConflict: 'plan_id,user_id' },
          ),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      if (isDemo) {
        demo.plans = demo.plans.filter((p) => p.id !== planId);
        return;
      }
      check(await supabase.from('training_plans').delete().eq('id', planId));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['training-plans'] }),
  });
}

// ───────────── Trained together ─────────────

/** Who and which workout a scanned code is about, or null when the server does not know it yet. */
export function useTogetherSession(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['together-session', sessionId, me()],
    enabled,
    queryFn: async (): Promise<TogetherSession | null> => {
      if (isDemo) {
        return {
          owner: demoUser('tomas'),
          name: 'Push Day',
          finished_at: minutesAgo(10),
          confirmed: demo.confirmed.has(sessionId),
        };
      }
      const rows = check(await supabase.rpc('together_session', { p_session: sessionId })) as {
        owner_id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        name: string;
        finished_at: string | null;
        confirmed: boolean;
      }[];
      const r = rows[0];
      if (!r) return null;
      return {
        owner: {
          id: r.owner_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
        },
        name: r.name,
        finished_at: r.finished_at,
        confirmed: r.confirmed,
      };
    },
  });
}

export function useConfirmTogether() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (isDemo) {
        demo.confirmed.add(sessionId);
        demo.together.unshift({
          id: uuid(),
          owner: demoUser('tomas'),
          user: myself(),
          confirmed_at: new Date().toISOString(),
        });
        return;
      }
      check(await supabase.rpc('confirm_together', { p_session: sessionId }));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['together-session'] });
      void qc.invalidateQueries({ queryKey: ['together'] });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

const TOGETHER_COLS = `session_id, confirmed_at,
  owner:profiles!trained_together_owner_id_fkey(${PUBLIC_COLS}),
  user:profiles!trained_together_user_id_fkey(${PUBLIC_COLS})`;

interface TogetherRow {
  session_id: string;
  confirmed_at: string;
  owner: PublicUser;
  user: PublicUser;
}

const toEntry = (r: TogetherRow): TogetherEntry => ({
  id: `${r.session_id}:${r.user.id}`,
  owner: r.owner,
  user: r.user,
  confirmed_at: r.confirmed_at,
});

/** The newest confirmed workouts I can see, for the Arena. */
export function useTogetherFeed(limit = 5) {
  return useQuery({
    queryKey: ['together', 'feed', me(), limit],
    queryFn: async (): Promise<TogetherEntry[]> => {
      if (isDemo) return demo.together.slice(0, limit);
      const rows = check(
        await supabase
          .from('trained_together')
          .select(TOGETHER_COLS)
          .order('confirmed_at', { ascending: false })
          .limit(limit),
      ) as unknown as TogetherRow[];
      return rows.map(toEntry);
    },
  });
}

/** Who confirmed this workout of mine; checks often while the code is on screen. */
export function useSessionTogether(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['together', 'session', sessionId],
    enabled,
    refetchInterval: 5000,
    queryFn: async (): Promise<PublicUser[]> => {
      if (isDemo) return [];
      const rows = check(
        await supabase.from('trained_together').select(TOGETHER_COLS).eq('session_id', sessionId),
      ) as unknown as TogetherRow[];
      return rows.map((r) => r.user);
    },
  });
}

/** How many confirmed workouts I share with someone. */
export function useTogetherCount(userId: string) {
  return useQuery({
    queryKey: ['together', 'count', me(), userId],
    queryFn: async (): Promise<number> => {
      const uid = me();
      if (isDemo) {
        return demo.together.filter(
          (t) =>
            (t.owner.id === uid && t.user.id === userId) ||
            (t.owner.id === userId && t.user.id === uid),
        ).length;
      }
      const res = await supabase
        .from('trained_together')
        .select('session_id', { count: 'exact', head: true })
        .or(
          `and(owner_id.eq.${uid},user_id.eq.${userId}),and(owner_id.eq.${userId},user_id.eq.${uid})`,
        );
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
  });
}
