/**
 * Server data of the game layer: league tables, ludus, treasuries (hours), fortresses, your
 * house, wars, duels, Bellum, gym posters and the user's own visits. Online only (react-query); the user's own XP,
 * laurels and denarii are computed on the device (see hooks.ts). In demo mode every call is
 * answered from src/dev/seed.ts plus the local user's own data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEMO_BELLUM,
  DEMO_GAME,
  DEMO_GYMS,
  DEMO_LUDI,
  DEMO_LUDUS,
  DEMO_STATS,
  DEMO_USERS,
  demoUser,
} from '@/dev/seed';
import { addDays, startOfMonth } from '@/lib/dates';
import {
  bellumScore,
  duelScore,
  warPoints,
  warScore,
  warSpoils,
  type DuelKind,
} from '@/lib/game/battles';
import { LAURELS, LUDUS, WAR } from '@/lib/game/config';
import {
  buildDays,
  buildingDef,
  currentLevel,
  levelMinutes,
  memberLimit,
  repairMinutes,
  type Building,
  type BuildingId,
  type OwnerKind,
} from '@/lib/game/fortress';
import { EMPTY_RECORD, gloriaChange, type WarRecord } from '@/lib/game/gloria';
import {
  formatMinutes,
  houseItemBlock,
  houseUpgradeBlock,
  houseUpgradeMinutes,
  HOUSE,
  type House,
  type HouseItemId,
} from '@/lib/game/hours';
import { seasonOf } from '@/lib/game/levels';
import { sessionVerification, type GymVisit } from '@/lib/game/visits';
import { qualifies } from '@/lib/game/engine';
import { isCardio } from '@/lib/cardio';
import { isDemo, supabase } from '@/lib/supabase';
import type { PublicUser, Session } from '@/lib/types';
import { stableUuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { useGame as useGameStore } from '@/stores/game';
import type { ArenaScope } from '@/stores/prefs';

const PUBLIC_COLS = 'id,username,display_name,avatar_url,home_gym_id';
const RECORD_COLS = 'gloria,best_gloria,wins,losses,defences,upsets,streak,best_streak';

function me(): string {
  return useData.getState().userId;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

// ───────────── Demo state (in memory) ─────────────
const demoBuilding = (
  owner_kind: OwnerKind,
  owner_id: string,
  building: BuildingId,
  level: number,
  extra: Partial<Building> = {},
): Building => ({
  owner_kind,
  owner_id,
  building,
  level,
  target_level: null,
  ready_at: null,
  damaged: false,
  ...extra,
});

const demoGymId = DEMO_GYMS[0].id;
const demo = {
  inLudus: true,
  ludus: { ...DEMO_LUDUS, members: [...DEMO_LUDUS.members] },
  /** Spent on gear (cityApi.ts). */
  spent: 0,
  /** Treasuries hold minutes (hours of verified visits). */
  treasuries: {
    [`ludus:${DEMO_LUDUS.id}`]: DEMO_LUDUS.treasury,
    [`gym:${demoGymId}`]: 2480,
  } as Record<string, number>,
  buildings: [
    demoBuilding('ludus', DEMO_LUDUS.id, 'bench', 1),
    demoBuilding('ludus', DEMO_LUDUS.id, 'palisade', 2),
    demoBuilding('ludus', DEMO_LUDUS.id, 'temple', 0, {
      target_level: 1,
      ready_at: hoursFromNow(19),
    }),
    demoBuilding('gym', demoGymId, 'bench', 2),
    demoBuilding('gym', demoGymId, 'rack', 1),
    demoBuilding('gym', demoGymId, 'palisade', 1),
  ],
  wars: [] as War[],
  duels: [] as Duel[],
  poster: {} as Record<string, { lat: number; lng: number }>,
  house: { level: 2, minutes: 14 * 60 + 25, items: ['hortus'] } as House,
};

function demoWars(): War[] {
  if (demo.wars.length) return demo.wars;
  const lupi = DEMO_LUDI[0];
  const aquila = DEMO_LUDI[1];
  demo.wars = [
    {
      id: stableUuid('war:lupi'),
      attacker: { id: lupi.id, name: lupi.name },
      defender: { id: DEMO_LUDUS.id, name: DEMO_LUDUS.name },
      starts_at: hoursFromNow(-26),
      ends_at: hoursFromNow(46),
      attacker_active: 6,
      defender_active: 5,
      defender_palisade: 2,
      attacker_points: 141,
      defender_points: 0,
      attacker_score: 0,
      defender_score: 0,
      winner_id: null,
      spoils: null,
      damaged_building: null,
      settled_at: null,
      attacker_gloria: null,
      defender_gloria: null,
    },
    {
      id: stableUuid('war:aquila'),
      attacker: { id: DEMO_LUDUS.id, name: DEMO_LUDUS.name },
      defender: { id: aquila.id, name: aquila.name },
      starts_at: hoursFromNow(-24 * 12),
      ends_at: hoursFromNow(-24 * 9),
      attacker_active: 5,
      defender_active: 4,
      defender_palisade: 1,
      attacker_points: 190,
      defender_points: 118,
      attacker_score: 38,
      defender_score: 31,
      winner_id: DEMO_LUDUS.id,
      spoils: null,
      spoils_minutes: 150,
      damaged_building: 'cable',
      settled_at: hoursFromNow(-24 * 9),
      attacker_gloria: 30,
      defender_gloria: -10,
    },
  ];
  return demo.wars;
}

function demoDuels(): Duel[] {
  if (demo.duels.length) return demo.duels;
  const bench = Object.values(useData.getState().exercises).find((e) => e.name === 'Bench Press');
  const uid = me();
  demo.duels = [
    {
      id: stableUuid('duel:tomas'),
      challenger: demoUser('tomas'),
      opponent: myPublic(),
      kind: 'workouts',
      exercise_id: null,
      exerciseName: null,
      status: 'active',
      starts_at: hoursFromNow(-24 * 3),
      ends_at: hoursFromNow(24 * 4),
      challenger_score: 2,
      opponent_score: 0,
      winner_id: null,
      mine: false,
    },
    ...(bench
      ? [
          {
            id: stableUuid('duel:adam'),
            challenger: demoUser('adam'),
            opponent: myPublic(),
            kind: 'lift' as const,
            exercise_id: bench.id,
            exerciseName: bench.name,
            status: 'pending' as const,
            starts_at: null,
            ends_at: null,
            challenger_score: null,
            opponent_score: null,
            winner_id: null,
            mine: false,
          },
        ]
      : []),
    {
      id: stableUuid('duel:ondrej'),
      challenger: myPublic(),
      opponent: demoUser('ondrej'),
      kind: 'workouts',
      exercise_id: null,
      exerciseName: null,
      status: 'done',
      starts_at: hoursFromNow(-24 * 16),
      ends_at: hoursFromNow(-24 * 9),
      challenger_score: 4,
      opponent_score: 3,
      winner_id: uid,
      mine: true,
    },
  ];
  return demo.duels;
}

function myPublic(): PublicUser {
  const p = useData.getState().profile;
  return {
    id: me(),
    username: p?.username ?? 'you',
    display_name: p?.display_name ?? 'You',
    avatar_url: p?.avatar_url ?? null,
    home_gym_id: p?.home_gym_id ?? null,
  };
}

function mySessions(): Session[] {
  return Object.values(useData.getState().sessions);
}

function myVisits(): GymVisit[] {
  return Object.values(useGameStore.getState().visits);
}

/** My verified workouts in a window, as war workouts (demo scoring). */
function myWarWorkouts(from: string, to: string) {
  const visits = myVisits();
  return mySessions()
    .filter(
      (s) =>
        s.finished_at &&
        s.started_at >= from &&
        s.started_at < to &&
        (sessionVerification(s.started_at, visits) === 'verified' || (isCardio(s) && qualifies(s))),
    )
    .map((s) => ({ user_id: me(), started_at: s.started_at, prs: s.pr_count }));
}

// ───────────── League ─────────────

export interface LeagueRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  value: number;
}

/** The season table. `mine` is my own score (computed on the device), used in demo mode. */
export function useLeague(scope: ArenaScope, season: string, mine: number) {
  return useQuery({
    queryKey: ['league', me(), scope, season, isDemo ? mine : 0],
    queryFn: async (): Promise<LeagueRow[]> => {
      if (isDemo) {
        const global = scope === 'global';
        if (global && !useData.getState().profile?.global_ranking) return [];
        const friends = new Set(['tomas', 'adam', 'jakub', 'ondrej', 'filip', 'lukas']);
        const rows = DEMO_USERS.filter(
          (u) => global || scope === 'gym' || friends.has(u.username),
        ).map((u) => ({ ...u, value: DEMO_GAME[u.username]?.season ?? 0 }));
        const p = myPublic();
        rows.push({ ...p, home_gym_id: p.home_gym_id ?? demoGymId, value: mine });
        rows.sort((a, b) => b.value - a.value);
        return rows.map((r, i) => ({
          rank: i + 1,
          user_id: r.id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          value: r.value,
        }));
      }
      const rows = check(
        await supabase.rpc('get_league', { p_scope: scope, p_season: season }),
      ) as LeagueRow[];
      return rows.map((r) => ({ ...r, rank: Number(r.rank), value: Number(r.value) }));
    },
  });
}

/** Someone's XP and season score (for their profile). */
export function useGameProfile(userId: string, demoSessions?: Session[]) {
  const season = seasonOf(new Date());
  return useQuery({
    queryKey: ['game-profile', userId, season],
    enabled: !!userId,
    queryFn: async (): Promise<{ xp: number; season: number }> => {
      if (isDemo) {
        const u = DEMO_USERS.find((x) => x.id === userId);
        if (u)
          return { xp: DEMO_GAME[u.username]?.xp ?? 0, season: DEMO_GAME[u.username]?.season ?? 0 };
        return { xp: (demoSessions?.length ?? 0) * 100, season: 0 };
      }
      const rows = check(
        await supabase.rpc('game_profile', { p_user: userId, p_season: season }),
      ) as { xp: number; season_score: number }[];
      return { xp: Number(rows[0]?.xp ?? 0), season: Number(rows[0]?.season_score ?? 0) };
    },
  });
}

/** My laurels from duels, wars and Bellum, by season. */
export function useAwards() {
  return useQuery({
    queryKey: ['awards', me()],
    staleTime: 5 * 60000,
    queryFn: async (): Promise<Record<string, number>> => {
      if (isDemo) {
        const season = seasonOf(new Date());
        return { [season]: LAURELS.duelWin };
      }
      const rows = check(
        await supabase.from('laurel_awards').select('season,amount').eq('user_id', me()),
      ) as { season: string; amount: number }[];
      const out: Record<string, number> = {};
      for (const r of rows) out[r.season] = (out[r.season] ?? 0) + r.amount;
      return out;
    },
  });
}

/** My workouts confirmed as done together, with who it was. */
export function useMyTogether() {
  return useQuery({
    queryKey: ['together', 'mine', me()],
    staleTime: 5 * 60000,
    queryFn: async (): Promise<{ sessionId: string; partnerId: string }[]> => {
      if (isDemo) return [];
      const uid = me();
      const rows = check(
        await supabase
          .from('trained_together')
          .select('session_id,owner_id,user_id,confirmed_at')
          .or(`owner_id.eq.${uid},user_id.eq.${uid}`),
      ) as { session_id: string; owner_id: string; user_id: string; confirmed_at: string }[];
      const sessions = mySessions().filter((s) => s.finished_at);
      return rows.flatMap((r) => {
        if (r.owner_id === uid) return [{ sessionId: r.session_id, partnerId: r.user_id }];
        // I scanned their code: my own workout is the one I finished last before confirming.
        const t = new Date(r.confirmed_at).getTime();
        const mine = sessions
          .filter((s) => {
            const done = new Date(s.finished_at!).getTime();
            return done <= t + 3600000 && done >= t - 12 * 3600000;
          })
          .sort((a, b) => b.finished_at!.localeCompare(a.finished_at!))[0];
        return mine ? [{ sessionId: mine.id, partnerId: r.owner_id }] : [];
      });
    },
  });
}

// ───────────── Visits ─────────────

/** Pulls my visits with the server's checks into the local store. */
export function useVisitPull(fast: boolean) {
  return useQuery({
    queryKey: ['visits', me()],
    enabled: !isDemo && !!me(),
    refetchInterval: fast ? 15000 : 5 * 60000,
    queryFn: async () => {
      const rows = check(
        await supabase
          .from('gym_visits')
          .select('*')
          .eq('user_id', me())
          .order('in_at', { ascending: false })
          .limit(400),
      ) as GymVisit[];
      useGameStore.getState().mergeVisits(rows);
      return rows.length;
    },
  });
}

export interface PosterData {
  signature: string;
  lat: number | null;
  lng: number | null;
}

/** The gym poster's code; with a position it is saved as the gym's place first. */
export async function fetchPoster(
  gymId: string,
  position?: { lat: number; lng: number },
): Promise<PosterData> {
  if (isDemo) {
    if (position) demo.poster[gymId] = position;
    const p = demo.poster[gymId];
    return { signature: 'demo-signature', lat: p?.lat ?? null, lng: p?.lng ?? null };
  }
  const rows = check(
    await supabase.rpc('gym_poster', {
      p_gym: gymId,
      p_lat: position?.lat ?? null,
      p_lng: position?.lng ?? null,
    }),
  ) as PosterData[];
  if (!rows[0]) throw new Error('Gym not found');
  return rows[0];
}

/** In demo mode a scan is checked right here, like the server would. */
export function demoCheckVisit(v: GymVisit): GymVisit {
  if (!isDemo) return v;
  const ok = (sig: string | null) => !!sig;
  return {
    ...v,
    in_ok: ok(v.in_code),
    out_ok: v.out_at ? ok(v.out_code) : null,
  };
}

export function useGymManager(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym-manager', gymId, me()],
    enabled: !!gymId,
    queryFn: async (): Promise<boolean> => {
      if (isDemo) return true;
      const [gym, admin] = await Promise.all([
        supabase.from('gyms').select('created_by').eq('id', gymId!).maybeSingle(),
        supabase.rpc('is_admin'),
      ]);
      return (
        (check(gym) as { created_by: string | null } | null)?.created_by === me() || !!admin.data
      );
    },
  });
}

// ───────────── Ludus ─────────────

export interface LudusMember extends PublicUser {
  role: 'leader' | 'member';
  joined_at: string;
}

export interface Ludus {
  id: string;
  name: string;
  motto: string;
  code: string;
  members: LudusMember[];
  /** Hours in the treasury, in minutes. */
  treasury: number;
  buildings: Building[];
  myRole: 'leader' | 'member';
  limit: number;
  /** Gloria and the war record. */
  record: WarRecord;
}

function demoLudus(): Ludus | null {
  if (!demo.inLudus) return null;
  const uid = me();
  const members: LudusMember[] = [
    { ...myPublic(), role: 'leader', joined_at: hoursFromNow(-24 * 60) },
    ...demo.ludus.members.map((u, i) => ({
      ...demoUser(u),
      role: 'member' as const,
      joined_at: hoursFromNow(-24 * (50 - i * 7)),
    })),
  ];
  const buildings = demo.buildings.filter(
    (b) => b.owner_kind === 'ludus' && b.owner_id === demo.ludus.id,
  );
  return {
    id: demo.ludus.id,
    name: demo.ludus.name,
    motto: demo.ludus.motto,
    code: demo.ludus.code,
    members,
    treasury: demo.treasuries[`ludus:${demo.ludus.id}`] ?? 0,
    buildings,
    myRole: members.find((m) => m.id === uid)?.role ?? 'member',
    limit: memberLimit(buildings),
    record: demo.ludus.record,
  };
}

export function useMyLudus() {
  return useQuery({
    queryKey: ['ludus', 'mine', me()],
    queryFn: async (): Promise<Ludus | null> => {
      if (isDemo) return demoLudus();
      const mine = check(
        await supabase.from('ludus_members').select('ludus_id').eq('user_id', me()).maybeSingle(),
      ) as { ludus_id: string } | null;
      if (!mine) return null;
      const id = mine.ludus_id;
      const [ludus, members, treasury, buildings] = await Promise.all([
        supabase.from('ludi').select(`id,name,motto,code,${RECORD_COLS}`).eq('id', id).single(),
        supabase
          .from('ludus_members')
          .select(`role,joined_at,profiles(${PUBLIC_COLS})`)
          .eq('ludus_id', id)
          .order('joined_at'),
        supabase
          .from('treasuries')
          .select('*')
          .eq('owner_kind', 'ludus')
          .eq('owner_id', id)
          .maybeSingle(),
        supabase.from('buildings').select('*').eq('owner_kind', 'ludus').eq('owner_id', id),
      ]);
      const {
        id: _id,
        name,
        motto,
        code,
        ...record
      } = check(ludus) as {
        id: string;
        name: string;
        motto: string;
        code: string;
      } & WarRecord;
      const list = (
        check(members) as unknown as {
          role: 'leader' | 'member';
          joined_at: string;
          profiles: PublicUser;
        }[]
      ).map((m) => ({ ...m.profiles, role: m.role, joined_at: m.joined_at }));
      const b = check(buildings) as Building[];
      return {
        id,
        name,
        motto,
        code,
        members: list,
        treasury: (check(treasury) as { minutes?: number } | null)?.minutes ?? 0,
        buildings: b,
        myRole: list.find((m) => m.id === me())?.role ?? 'member',
        limit: memberLimit(b),
        record,
      };
    },
  });
}

export interface LudusListing {
  id: string;
  name: string;
  motto: string;
  members: number;
}

export function useLudusDirectory(query: string, enabled = true) {
  return useQuery({
    queryKey: ['ludus', 'directory', query],
    enabled,
    queryFn: async (): Promise<LudusListing[]> => {
      if (isDemo) {
        const q = query.trim().toLowerCase();
        return DEMO_LUDI.filter((l) => !q || l.name.toLowerCase().includes(q));
      }
      const rows = check(
        await supabase.rpc('ludus_directory', { p_query: query.trim() }),
      ) as LudusListing[];
      return rows.map((r) => ({ ...r, members: Number(r.members) }));
    },
  });
}

export interface LudusRank extends LudusListing {
  place: number;
  record: WarRecord;
}

/** The ludus ranking by gloria: the top 50, plus `mine` wherever it stands. */
export function useLudusRanking(mine: string | null | undefined) {
  return useQuery({
    queryKey: ['ludus', 'ranking', mine ?? null],
    queryFn: async (): Promise<LudusRank[]> => {
      if (isDemo) {
        const all = [
          ...DEMO_LUDI,
          ...(demo.inLudus ? [{ ...demo.ludus, members: demo.ludus.members.length + 1 }] : []),
        ].map((l) => ({
          id: l.id,
          name: l.name,
          motto: l.motto,
          members: l.members,
          record: l.record,
        }));
        return all
          .sort((a, b) => b.record.gloria - a.record.gloria || b.record.wins - a.record.wins)
          .map((l, i) => ({ ...l, place: i + 1 }));
      }
      const rows = check(
        await supabase.rpc('ludus_ranking', { p_ludus: mine ?? null }),
      ) as (WarRecord & {
        place: number;
        id: string;
        name: string;
        motto: string;
        members: number;
      })[];
      return rows.map(({ place, id, name, motto, members, ...record }) => ({
        place: Number(place),
        id,
        name,
        motto,
        members: Number(members),
        record,
      }));
    },
  });
}

function useInvalidateGame() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['ludus'] });
    void qc.invalidateQueries({ queryKey: ['wallet'] });
    void qc.invalidateQueries({ queryKey: ['fortress'] });
    void qc.invalidateQueries({ queryKey: ['wars'] });
    void qc.invalidateQueries({ queryKey: ['duels'] });
    void qc.invalidateQueries({ queryKey: ['house'] });
  };
}

export function useCreateLudus() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({ name, motto }: { name: string; motto: string }) => {
      const clean = name.trim();
      if (clean.length < 3 || clean.length > LUDUS.nameMax)
        throw new Error(`A name has 3–${LUDUS.nameMax} characters`);
      if (isDemo) {
        demo.inLudus = true;
        demo.ludus = {
          ...DEMO_LUDUS,
          id: stableUuid(`ludus:${clean}`),
          name: clean,
          motto,
          members: [],
          record: EMPTY_RECORD,
        };
        demo.treasuries[`ludus:${demo.ludus.id}`] = 0;
        return;
      }
      check(await supabase.rpc('create_ludus', { p_name: clean, p_motto: motto.trim() }));
    },
    onSuccess: done,
  });
}

export function useJoinLudus() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async (code: string) => {
      if (isDemo) {
        if (code.trim().toUpperCase() !== DEMO_LUDUS.code)
          throw new Error('No ludus has that code');
        demo.inLudus = true;
        demo.ludus = { ...DEMO_LUDUS, members: [...DEMO_LUDUS.members] };
        return;
      }
      check(await supabase.rpc('join_ludus', { p_code: code }));
    },
    onSuccess: done,
  });
}

export function useLeaveLudus() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async () => {
      if (isDemo) {
        demo.inLudus = false;
        return;
      }
      check(await supabase.rpc('leave_ludus'));
    },
    onSuccess: done,
  });
}

export function useRemoveMember() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (isDemo) {
        demo.ludus.members = demo.ludus.members.filter((u) => demoUser(u).id !== userId);
        return;
      }
      check(await supabase.rpc('remove_ludus_member', { p_user: userId }));
    },
    onSuccess: done,
  });
}

// ───────────── Wallet, treasuries and buildings ─────────────

/** Demo mode: pay from the wallet (gear) or a gym treasury (an attack). */
export function demoPay(from: 'wallet' | `gym:${string}`, amount: number) {
  if (from === 'wallet') demo.spent += amount;
  else demoSpend('gym', from.slice(4), amount);
}

/** Demo mode: a gym treasury's hours, in minutes. */
export function demoTreasury(gymId: string): number {
  return demo.treasuries[`gym:${gymId}`] ?? 0;
}

/** Denarii I can spend on gear. `earned` is computed on the device (used in demo mode). */
export function useWallet(earned: number) {
  return useQuery({
    queryKey: ['wallet', me(), isDemo ? earned : 0],
    queryFn: async (): Promise<number> => {
      if (isDemo) return Math.max(0, earned - demo.spent);
      return Number(check(await supabase.rpc('my_wallet')) ?? 0);
    },
  });
}

export interface Fortress {
  /** Hours in the treasury, in minutes: every member's verified visits fill it. */
  treasury: number;
  buildings: Building[];
}

export function useFortress(kind: OwnerKind, id: string | null | undefined) {
  return useQuery({
    queryKey: ['fortress', kind, id],
    enabled: !!id,
    queryFn: async (): Promise<Fortress> => {
      if (isDemo)
        return {
          treasury: demo.treasuries[`${kind}:${id}`] ?? 0,
          buildings: demo.buildings.filter((b) => b.owner_kind === kind && b.owner_id === id),
        };
      const [treasury, buildings] = await Promise.all([
        supabase
          .from('treasuries')
          .select('*')
          .eq('owner_kind', kind)
          .eq('owner_id', id!)
          .maybeSingle(),
        supabase.from('buildings').select('*').eq('owner_kind', kind).eq('owner_id', id!),
      ]);
      return {
        treasury: (check(treasury) as { minutes?: number } | null)?.minutes ?? 0,
        buildings: check(buildings) as Building[],
      };
    },
  });
}

function demoSpend(kind: OwnerKind, id: string, cost: number) {
  const key = `${kind}:${id}`;
  if ((demo.treasuries[key] ?? 0) < cost)
    throw new Error(`The treasury needs ${formatMinutes(cost)}`);
  demo.treasuries[key] -= cost;
}

export function useStartBuilding() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({
      kind,
      id,
      building,
    }: {
      kind: OwnerKind;
      id: string;
      building: BuildingId;
    }) => {
      if (isDemo) {
        const list = demo.buildings.filter((b) => b.owner_kind === kind && b.owner_id === id);
        for (const b of list)
          if (b.target_level && b.ready_at && new Date(b.ready_at) <= new Date()) {
            b.level = b.target_level;
            b.target_level = null;
            b.ready_at = null;
          }
        if (list.some((b) => b.target_level)) throw new Error('Something is being built already');
        let b = list.find((x) => x.building === building);
        if (b?.damaged) throw new Error('Repair it first');
        const next = (b?.level ?? 0) + 1;
        if (next > buildingDef(building).maxLevel) throw new Error('It is at the top level');
        demoSpend(kind, id, levelMinutes(building, next, kind));
        if (!b) {
          b = demoBuilding(kind, id, building, 0);
          demo.buildings.push(b);
        }
        b.target_level = next;
        b.ready_at = addDays(new Date(), buildDays(next)).toISOString();
        return;
      }
      check(await supabase.rpc('start_building', { p_kind: kind, p_id: id, p_building: building }));
    },
    onSuccess: done,
  });
}

export function useRepairBuilding() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({
      kind,
      id,
      building,
    }: {
      kind: OwnerKind;
      id: string;
      building: BuildingId;
    }) => {
      if (isDemo) {
        const b = demo.buildings.find(
          (x) => x.owner_kind === kind && x.owner_id === id && x.building === building,
        );
        if (!b?.damaged) throw new Error('Nothing to repair');
        demoSpend(kind, id, repairMinutes(building, Math.max(1, currentLevel(b)), kind));
        b.damaged = false;
        return;
      }
      check(
        await supabase.rpc('repair_building', { p_kind: kind, p_id: id, p_building: building }),
      );
    },
    onSuccess: done,
  });
}

// ───────────── Your house (docs/GAME.md §5a) ─────────────

/** Your house: its level, your own hours not spent yet and the things built by it. */
export function useHouse() {
  return useQuery({
    queryKey: ['house', me()],
    queryFn: async (): Promise<House> => {
      if (isDemo) return { ...demo.house, items: [...demo.house.items] };
      const [home, items] = await Promise.all([
        supabase.from('homes').select('level,minutes').eq('user_id', me()).maybeSingle(),
        supabase.from('home_items').select('item').eq('user_id', me()),
      ]);
      const h = check(home) as { level: number; minutes: number } | null;
      return {
        level: h?.level ?? 1,
        minutes: h?.minutes ?? 0,
        items: (check(items) as { item: HouseItemId }[]).map((r) => r.item),
      };
    },
  });
}

export function useUpgradeHouse() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async (house: House) => {
      const block = houseUpgradeBlock(house);
      if (block) throw new Error(block);
      if (isDemo) {
        demo.house.minutes -= houseUpgradeMinutes(demo.house.level) ?? 0;
        demo.house.level += 1;
        return;
      }
      check(await supabase.rpc('upgrade_home'));
    },
    onSuccess: done,
  });
}

export function useBuildHouseItem() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({ house, item }: { house: House; item: HouseItemId }) => {
      const block = houseItemBlock(house, item);
      if (block) throw new Error(block);
      if (isDemo) {
        demo.house.minutes -= HOUSE.itemHours * 60;
        demo.house.items.push(item);
        return;
      }
      check(await supabase.rpc('build_home_item', { p_item: item }));
    },
    onSuccess: done,
  });
}

// ───────────── Wars ─────────────

export interface War {
  id: string;
  attacker: { id: string; name: string };
  defender: { id: string; name: string };
  starts_at: string;
  ends_at: string;
  attacker_active: number;
  defender_active: number;
  defender_palisade: number;
  attacker_points: number;
  defender_points: number;
  attacker_score: number;
  defender_score: number;
  winner_id: string | null;
  /** Denarii, for wars settled before 2026-11-27. */
  spoils: number | null;
  /** Hours won, in minutes (wars settled since 2026-11-27). */
  spoils_minutes?: number | null;
  damaged_building: string | null;
  settled_at: string | null;
  /** Gloria each side won or lost (null until settled). */
  attacker_gloria: number | null;
  defender_gloria: number | null;
}

function demoScoreWar(w: War): War {
  if (w.settled_at) return w;
  const to = new Date(Math.min(Date.now(), new Date(w.ends_at).getTime())).toISOString();
  const minePoints = warPoints(myWarWorkouts(w.starts_at, to));
  // Friends in the demo ludus trained a bit already.
  const friends = 96;
  const mineSide = w.attacker.id === demo.ludus.id ? 'attacker' : 'defender';
  const pointsA = mineSide === 'attacker' ? friends + minePoints : w.attacker_points;
  const pointsD = mineSide === 'defender' ? friends + minePoints : w.defender_points;
  const scored = {
    ...w,
    attacker_points: pointsA,
    defender_points: pointsD,
    attacker_score: warScore(pointsA, w.attacker_active),
    defender_score: warScore(pointsD, w.defender_active, w.defender_palisade),
  };
  if (new Date(w.ends_at) > new Date()) return scored;
  const attackerWins = scored.attacker_score > scored.defender_score;
  const gloriaOf = (id: string) =>
    (id === demo.ludus.id ? demo.ludus.record : DEMO_LUDI.find((l) => l.id === id)?.record)
      ?.gloria ?? 0;
  const [winner, loser] = attackerWins ? [w.attacker, w.defender] : [w.defender, w.attacker];
  const [ws, ls] = attackerWins
    ? [scored.attacker_score, scored.defender_score]
    : [scored.defender_score, scored.attacker_score];
  const g = gloriaChange(gloriaOf(winner.id), gloriaOf(loser.id), ws, ls);
  return {
    ...scored,
    winner_id: winner.id,
    spoils: null,
    spoils_minutes: warSpoils(demo.treasuries[`ludus:${loser.id}`] ?? 900),
    settled_at: w.ends_at,
    attacker_gloria: attackerWins ? g.winner : g.loser,
    defender_gloria: attackerWins ? g.loser : g.winner,
  };
}

/** Wars of a ludus, newest first, with live scores for the running one. Ended ones get settled. */
export function useWars(ludusId: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['wars', ludusId],
    enabled: !!ludusId,
    refetchInterval: 60000,
    queryFn: async (): Promise<War[]> => {
      if (isDemo) return ludusId === demo.ludus.id ? demoWars().map(demoScoreWar) : [];
      const cols =
        '*, attacker:ludi!ludus_wars_attacker_id_fkey(id,name), defender:ludi!ludus_wars_defender_id_fkey(id,name)';
      const load = async () =>
        check(
          await supabase
            .from('ludus_wars')
            .select(cols)
            .or(`attacker_id.eq.${ludusId},defender_id.eq.${ludusId}`)
            .order('starts_at', { ascending: false })
            .limit(20),
        ) as unknown as War[];
      let rows = await load();
      const ended = rows.filter((w) => !w.settled_at && new Date(w.ends_at) <= new Date());
      if (ended.length) {
        await Promise.all(ended.map((w) => supabase.rpc('settle_war', { p_war: w.id })));
        rows = await load();
        // Settling changed gloria, the record and the ranking.
        void qc.invalidateQueries({ queryKey: ['ludus'] });
      }
      return Promise.all(
        rows.map(async (w) => {
          if (w.settled_at)
            return {
              ...w,
              attacker_score: Number(w.attacker_score),
              defender_score: Number(w.defender_score),
              attacker_points: 0,
              defender_points: 0,
            };
          const s = (
            check(await supabase.rpc('war_scores', { p_war: w.id })) as {
              attacker_points: number;
              defender_points: number;
              attacker_score: number;
              defender_score: number;
            }[]
          )[0];
          return {
            ...w,
            attacker_points: Number(s?.attacker_points ?? 0),
            defender_points: Number(s?.defender_points ?? 0),
            attacker_score: Number(s?.attacker_score ?? 0),
            defender_score: Number(s?.defender_score ?? 0),
          };
        }),
      );
    },
  });
}

export function useDeclareWar() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async (target: LudusListing) => {
      if (isDemo) {
        const wars = demoWars();
        if (wars.some((w) => !w.settled_at)) throw new Error('One of you is at war already');
        const l = demoLudus();
        if (!l || l.members.length < LUDUS.minMembers)
          throw new Error(`Your ludus needs ${LUDUS.minMembers} members to fight`);
        if (target.members < LUDUS.minMembers)
          throw new Error(`They need ${LUDUS.minMembers} members to fight`);
        wars.unshift({
          id: stableUuid(`war:${target.id}:${Date.now()}`),
          attacker: { id: l.id, name: l.name },
          defender: { id: target.id, name: target.name },
          starts_at: new Date().toISOString(),
          ends_at: addDays(new Date(), WAR.days).toISOString(),
          attacker_active: l.members.length,
          defender_active: target.members,
          defender_palisade: 0,
          attacker_points: 0,
          defender_points: 0,
          attacker_score: 0,
          defender_score: 0,
          winner_id: null,
          spoils: null,
          damaged_building: null,
          settled_at: null,
          attacker_gloria: null,
          defender_gloria: null,
        });
        return;
      }
      check(await supabase.rpc('declare_war', { p_defender: target.id }));
    },
    onSuccess: done,
  });
}

// ───────────── Duels ─────────────

export interface Duel {
  id: string;
  challenger: PublicUser;
  opponent: PublicUser;
  kind: DuelKind;
  exercise_id: string | null;
  exerciseName: string | null;
  status: 'pending' | 'active' | 'declined' | 'done';
  starts_at: string | null;
  ends_at: string | null;
  challenger_score: number | null;
  opponent_score: number | null;
  winner_id: string | null;
  /** I started it. */
  mine: boolean;
}

function demoDuelScores(d: Duel): Duel {
  if (d.status !== 'active' || !d.starts_at || !d.ends_at) return d;
  const myScore = duelScore(
    mySessions(),
    d.kind,
    d.exercise_id,
    new Date(d.starts_at),
    new Date(d.ends_at),
  );
  return d.mine ? { ...d, challenger_score: myScore } : { ...d, opponent_score: myScore };
}

export function useDuels() {
  return useQuery({
    queryKey: ['duels', me()],
    refetchInterval: 60000,
    queryFn: async (): Promise<Duel[]> => {
      if (isDemo)
        return demoDuels()
          .filter((d) => d.status !== 'declined')
          .map(demoDuelScores);
      const uid = me();
      const cols = `*, challenger:profiles!duels_challenger_id_fkey(${PUBLIC_COLS}), opponent:profiles!duels_opponent_id_fkey(${PUBLIC_COLS}), exercises(name)`;
      const load = async () =>
        check(
          await supabase
            .from('duels')
            .select(cols)
            .neq('status', 'declined')
            .order('created_at', { ascending: false })
            .limit(30),
        ) as unknown as (Omit<Duel, 'mine' | 'exerciseName'> & {
          challenger_id: string;
          exercises: { name: string } | null;
        })[];
      let rows = await load();
      const ended = rows.filter(
        (d) => d.status === 'active' && d.ends_at && new Date(d.ends_at) <= new Date(),
      );
      if (ended.length) {
        await Promise.all(ended.map((d) => supabase.rpc('settle_duel', { p_duel: d.id })));
        rows = await load();
      }
      return Promise.all(
        rows.map(async (d) => {
          let a = d.challenger_score == null ? null : Number(d.challenger_score);
          let b = d.opponent_score == null ? null : Number(d.opponent_score);
          if (d.status === 'active') {
            const s = (
              check(await supabase.rpc('duel_scores', { p_duel: d.id })) as {
                challenger: number;
                opponent: number;
              }[]
            )[0];
            a = Number(s?.challenger ?? 0);
            b = Number(s?.opponent ?? 0);
          }
          return {
            ...d,
            challenger_score: a,
            opponent_score: b,
            exerciseName: d.exercises?.name ?? null,
            mine: d.challenger_id === uid,
          };
        }),
      );
    },
  });
}

export function useCreateDuel() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({
      opponent,
      kind,
      exerciseId,
      exerciseName,
    }: {
      opponent: PublicUser;
      kind: DuelKind;
      exerciseId: string | null;
      exerciseName: string | null;
    }) => {
      if (kind === 'lift' && !exerciseId) throw new Error('Pick the lift');
      if (isDemo) {
        const list = demoDuels();
        if (
          list.some(
            (d) =>
              (d.status === 'pending' || d.status === 'active') &&
              (d.challenger.id === opponent.id || d.opponent.id === opponent.id),
          )
        )
          throw new Error('You have a duel with them already');
        list.unshift({
          id: stableUuid(`duel:${opponent.id}:${Date.now()}`),
          challenger: myPublic(),
          opponent,
          kind,
          exercise_id: exerciseId,
          exerciseName,
          status: 'pending',
          starts_at: null,
          ends_at: null,
          challenger_score: null,
          opponent_score: null,
          winner_id: null,
          mine: true,
        });
        return;
      }
      check(
        await supabase.rpc('create_duel', {
          p_opponent: opponent.id,
          p_kind: kind,
          p_exercise: exerciseId,
        }),
      );
    },
    onSuccess: done,
  });
}

export function useAnswerDuel() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (isDemo) {
        const d = demoDuels().find((x) => x.id === id);
        if (!d) return;
        d.status = accept ? 'active' : 'declined';
        if (accept) {
          d.starts_at = new Date().toISOString();
          d.ends_at = addDays(new Date(), 7).toISOString();
          d.challenger_score = 0;
          d.opponent_score = 0;
        }
        return;
      }
      check(await supabase.rpc('answer_duel', { p_duel: id, p_accept: accept }));
    },
    onSuccess: done,
  });
}

export function useWithdrawDuel() {
  const done = useInvalidateGame();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        demo.duels = demoDuels().filter((d) => d.id !== id);
        return;
      }
      check(await supabase.from('duels').delete().eq('id', id));
    },
    onSuccess: done,
  });
}

// ───────────── Bellum ─────────────

export interface BellumRow {
  gym_id: string;
  name: string;
  active: number;
  visit_days: number;
  palisade: number;
  score: number | null;
  place: number;
}

function monthKey(d: Date) {
  return seasonOf(d);
}

/** This month's table of the gyms in my city, and last month's winner. */
export function useBellum(enabled: boolean, myVisitDays: number) {
  return useQuery({
    queryKey: ['bellum', me(), monthKey(new Date()), isDemo ? myVisitDays : 0],
    enabled,
    refetchInterval: 5 * 60000,
    queryFn: async (): Promise<{ rows: BellumRow[]; lastWinner: string | null }> => {
      const now = new Date();
      const last = monthKey(addDays(startOfMonth(now), -1));
      if (isDemo) {
        const rows = DEMO_BELLUM.map((g, i) => {
          const mine = g.gym === DEMO_GYMS[0].name;
          const days = g.visitDays + (mine ? myVisitDays : 0);
          const active = g.active + (mine && myVisitDays ? 1 : 0);
          return {
            gym_id: mine ? demoGymId : stableUuid(`gym:bellum:${i}`),
            name: g.gym,
            active,
            visit_days: days,
            palisade: g.palisade,
            score: bellumScore(days, active, g.palisade),
            place: 0,
          };
        }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        rows.forEach((r, i) => (r.place = r.score == null ? rows.length : i + 1));
        return { rows, lastWinner: 'Olymp Fitness' };
      }
      await supabase.rpc('settle_bellum', { p_month: last });
      const rows = (
        check(await supabase.rpc('bellum_standings', { p_month: monthKey(now) })) as BellumRow[]
      ).map((r) => ({
        ...r,
        active: Number(r.active),
        visit_days: Number(r.visit_days),
        score: r.score == null ? null : Number(r.score),
        place: Number(r.place),
      }));
      const gymId = useData.getState().profile?.home_gym_id;
      let lastWinner: string | null = null;
      if (gymId) {
        const city = check(
          await supabase.from('gyms').select('city').eq('id', gymId).maybeSingle(),
        ) as {
          city: string | null;
        } | null;
        if (city?.city) {
          const win = check(
            await supabase
              .from('bellum_results')
              .select('gyms(name)')
              .eq('city', city.city.trim().toLowerCase())
              .eq('month', last)
              .eq('place', 1)
              .limit(1),
          ) as unknown as { gyms: { name: string } | null }[];
          lastWinner = win[0]?.gyms?.name ?? null;
        }
      }
      return { rows, lastWinner };
    },
  });
}

// ───────────── Temple: the ludus records ─────────────

export interface LudusRecord {
  lift: string;
  user_id: string;
  display_name: string;
  e1rm: number;
}

export function useLudusRecords(ludusId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ludus', 'records', ludusId],
    enabled: !!ludusId && enabled,
    queryFn: async (): Promise<LudusRecord[]> => {
      if (isDemo) {
        const best = (key: 'squat' | 'bench' | 'deadlift', lift: string) => {
          const u = [...DEMO_LUDUS.members].sort(
            (a, b) => DEMO_STATS[b][key] - DEMO_STATS[a][key],
          )[0];
          const user = demoUser(u);
          return {
            lift,
            user_id: user.id,
            display_name: user.display_name,
            e1rm: DEMO_STATS[u][key],
          };
        };
        return [best('bench', 'Bench Press'), best('deadlift', 'Deadlift'), best('squat', 'Squat')];
      }
      const rows = check(
        await supabase.rpc('ludus_records', { p_ludus: ludusId }),
      ) as LudusRecord[];
      return rows.map((r) => ({ ...r, e1rm: Number(r.e1rm) }));
    },
  });
}
