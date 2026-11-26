/**
 * Server data of the city and the map (docs/GAME.md §9–10): the gladiator's style and gear, the
 * tribes of the city, tribe attacks and defence pledges. Online only (react-query). In demo mode
 * every call is answered from src/dev/seed.ts and an in-memory state.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_CITY, DEMO_TRIBE_BEST } from '@/dev/seed';
import { warPoints } from '@/lib/game/battles';
import { TRIBE_WAR } from '@/lib/game/config';
import { GEAR_SLOTS, gearPower, type GearItem, type Loadout } from '@/lib/game/gear';
import { seasonOf } from '@/lib/game/levels';
import { canChangeStyle, isStyle, type StyleId } from '@/lib/game/styles';
import { revengeUntil, tribeScore, tribeWarTimes, type TribeWarTimes } from '@/lib/game/tribes';
import { sessionVerification } from '@/lib/game/visits';
import { qualifies } from '@/lib/game/engine';
import { isRun } from '@/lib/running';
import { isDemo, supabase } from '@/lib/supabase';
import { stableUuid } from '@/lib/uuid';
import { gameWords } from '@/lib/game/words';
import { useData } from '@/stores/data';
import { useGame as useGameStore } from '@/stores/game';
import { demoPay, demoTreasury } from './api';

function me(): string {
  return useData.getState().userId;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(gameWords(res.error.message));
  return res.data as T;
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

// ───────────── The gladiator: style and gear ─────────────

export interface StyleChoice {
  id: StyleId;
  since: string;
}

export interface Gladiator {
  style: StyleId | null;
  /** The season the style was last chosen in ("2026-11"). */
  styleSeason: string | null;
  /** Every style chosen, oldest first. */
  styles: StyleChoice[];
  loadout: Loadout;
  power: number;
  /** Pieces bought with denarii (own gladiator only). */
  bought: Set<string>;
}

const EMPTY: Gladiator = {
  style: null,
  styleSeason: null,
  styles: [],
  loadout: {},
  power: gearPower({}),
  bought: new Set(),
};

const demoGlad: Gladiator = { ...EMPTY, bought: new Set() };

interface GladiatorRow {
  style: string | null;
  style_season: string | null;
  styles: StyleChoice[] | null;
  helmet: string | null;
  weapon: string | null;
  shield: string | null;
  guard: string | null;
  armour: string | null;
  power: number;
}

function fromRow(row: GladiatorRow | null, bought: Set<string>): Gladiator {
  if (!row) return { ...EMPTY, bought };
  const loadout: Loadout = {};
  for (const s of GEAR_SLOTS) loadout[s.id] = row[s.id];
  return {
    style: isStyle(row.style) ? row.style : null,
    styleSeason: row.style_season,
    styles: (row.styles ?? []).filter((x) => isStyle(x.id)),
    loadout,
    power: gearPower(loadout),
    bought,
  };
}

/** A gladiator's style and gear; mine when no id is given. */
export function useGladiator(userId?: string) {
  const id = userId ?? me();
  const mine = id === me();
  return useQuery({
    queryKey: ['gladiator', id],
    enabled: !!id,
    queryFn: async (): Promise<Gladiator> => {
      if (isDemo) return mine ? { ...demoGlad, power: gearPower(demoGlad.loadout) } : EMPTY;
      const [row, bought] = await Promise.all([
        supabase.from('gladiators').select('*').eq('user_id', id).maybeSingle(),
        mine
          ? supabase.from('gear_purchases').select('item').eq('user_id', id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      return fromRow(
        check(row) as GladiatorRow | null,
        new Set((check(bought) as { item: string }[]).map((b) => b.item)),
      );
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['gladiator'] });
    void qc.invalidateQueries({ queryKey: ['wallet'] });
    void qc.invalidateQueries({ queryKey: ['city'] });
    void qc.invalidateQueries({ queryKey: ['tribe-wars'] });
    void qc.invalidateQueries({ queryKey: ['fortress'] });
  };
}

export function useChooseStyle() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async (style: StyleId) => {
      if (isDemo) {
        if (demoGlad.style === style) return;
        const season = seasonOf(new Date());
        if (!canChangeStyle(demoGlad.styleSeason, season))
          throw new Error('You can change your style once a season');
        demoGlad.style = style;
        demoGlad.styleSeason = season;
        demoGlad.styles = [...demoGlad.styles, { id: style, since: new Date().toISOString() }];
        return;
      }
      check(await supabase.rpc('choose_style', { p_style: style }));
    },
    onSuccess: done,
  });
}

export function useBuyGear() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async ({ item, wallet }: { item: GearItem; wallet: number }) => {
      if (item.unlock.kind !== 'denarii') throw new Error('This piece is earned by training');
      if (wallet < item.unlock.price) throw new Error(`You need ${item.unlock.price} denarii`);
      if (isDemo) {
        demoPay('wallet', item.unlock.price);
        demoGlad.bought = new Set([...demoGlad.bought, item.id]);
        demoGlad.loadout = { ...demoGlad.loadout, [item.slot]: item.id };
        return;
      }
      check(await supabase.rpc('buy_gear', { p_item: item.id }));
      check(await supabase.rpc('equip_gear', { p_item: item.id }));
    },
    onSuccess: done,
  });
}

export function useEquipGear() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async (item: GearItem) => {
      if (isDemo) {
        demoGlad.loadout = { ...demoGlad.loadout, [item.slot]: item.id };
        return;
      }
      check(await supabase.rpc('equip_gear', { p_item: item.id }));
    },
    onSuccess: done,
  });
}

// ───────────── The city's tribes ─────────────

export interface CityTribeRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Fortress level. */
  level: number;
  members: number;
  strength: number;
  /** Territories held (its own included while nobody took it). */
  territories: number;
  /** Who holds this gym's own territory; null = the gym itself. */
  held_by: string | null;
  treasury: number;
  palisade: number;
  at_war: boolean;
}

export function useCityMap(city: string | null | undefined) {
  return useQuery({
    queryKey: ['city', city],
    enabled: !!city,
    queryFn: async (): Promise<CityTribeRow[]> => {
      if (isDemo) {
        const wars = demoTribeWars().filter((w) => !w.settled_at);
        return DEMO_CITY.map((g) => ({
          id: g.id,
          name: g.name,
          lat: g.lat,
          lng: g.lng,
          level: g.level,
          members: g.members,
          strength: g.strength,
          // Spartan Box took Iron Forum's own territory; Iron Forum holds Karlín's.
          territories: g.name === 'Spartan Box' ? 2 : g.name === 'Fit Point Karlín' ? 0 : 1,
          held_by:
            g.name === 'Iron Forum'
              ? DEMO_CITY[2].id
              : g.name === 'Fit Point Karlín'
                ? DEMO_CITY[0].id
                : null,
          treasury: g.name === 'Iron Forum' ? demoTreasury(g.id) : g.treasury,
          palisade: g.palisade,
          at_war: wars.some((w) => w.attacker.id === g.id || w.defender.id === g.id),
        }));
      }
      return (check(await supabase.rpc('city_map', { p_city: city })) as CityTribeRow[]).map(
        (r) => ({ ...r, strength: Number(r.strength), treasury: Number(r.treasury) }),
      );
    },
  });
}

export interface TribeGladiator {
  user_id: string;
  name: string;
  level: number;
  style: StyleId | null;
  loadout: Loadout;
  power: number;
}

export interface TribeInfo {
  best: TribeGladiator[];
  /** Share of verified workouts on Saturday and Sunday in the last 4 weeks. */
  weekendShare: number | null;
}

export function useTribeInfo(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['city', 'tribe', gymId],
    enabled: !!gymId,
    queryFn: async (): Promise<TribeInfo> => {
      if (isDemo) {
        const g = DEMO_CITY.find((x) => x.id === gymId);
        return {
          best: DEMO_TRIBE_BEST.default.map((b, i) => ({
            user_id: stableUuid(`tribe:${gymId}:${i}`),
            name: b.name,
            level: b.level,
            style: isStyle(b.style) ? b.style : null,
            loadout: b.loadout as Loadout,
            power: gearPower(b.loadout as Loadout),
          })),
          weekendShare: g?.weekendShare ?? null,
        };
      }
      const rows = check(await supabase.rpc('tribe_info', { p_gym: gymId })) as {
        user_id: string;
        display_name: string;
        level: number;
        style: string | null;
        power: number;
        weekend_share: number | null;
      }[];
      const ids = rows.map((r) => r.user_id);
      const glads = ids.length
        ? (check(
            await supabase.from('gladiators').select('*,user_id').in('user_id', ids),
          ) as (GladiatorRow & { user_id: string })[])
        : [];
      return {
        best: rows.map((r) => {
          const g = fromRow(glads.find((x) => x.user_id === r.user_id) ?? null, new Set());
          return {
            user_id: r.user_id,
            name: r.display_name,
            level: r.level,
            style: g.style,
            loadout: g.loadout,
            power: g.power,
          };
        }),
        weekendShare: rows[0]?.weekend_share != null ? Number(rows[0].weekend_share) : null,
      };
    },
  });
}

// ───────────── Tribe attacks ─────────────

export interface TribeWar extends TribeWarTimes {
  id: string;
  attacker: { id: string; name: string };
  defender: { id: string; name: string };
  revenge: boolean;
  attacker_active: number;
  defender_active: number;
  attacker_gear: number;
  defender_gear: number;
  defender_palisade: number;
  attacker_score: number;
  defender_score: number;
  winner_gym: string | null;
  spoils: number | null;
  damaged_building: string | null;
  settled_at: string | null;
  pledges: number;
  pledged: boolean;
}

let demoWars: TribeWar[] = [];
const demoPledged = new Set<string>();

function demoTribeWars(): TribeWar[] {
  if (demoWars.length) return demoWars;
  const [mine, olymp, spartan, karlin] = DEMO_CITY;
  const side = (g: (typeof DEMO_CITY)[number]) => ({ id: g.id, name: g.name });
  const base = {
    revenge: false,
    attacker_gear: 0.08,
    defender_gear: 0.07,
    damaged_building: null,
    pledges: 0,
    pledged: false,
  };
  demoWars = [
    {
      ...base,
      id: stableUuid('tribe-war:olymp'),
      ...tribeWarTimes(new Date(Date.now() - (18 * 60 + 18) * 60000)),
      attacker: side(olymp),
      defender: side(mine),
      attacker_active: 22,
      defender_active: 14,
      defender_palisade: mine.palisade,
      attacker_score: 0,
      defender_score: 0,
      winner_gym: null,
      spoils: null,
      settled_at: null,
      pledges: 9,
    },
    {
      ...base,
      id: stableUuid('tribe-war:spartan'),
      declared_at: hoursFromNow(-24 * 9),
      starts_at: hoursFromNow(-24 * 8),
      ends_at: hoursFromNow(-24 * 5),
      attacker: side(spartan),
      defender: side(mine),
      attacker_active: 12,
      defender_active: 14,
      defender_palisade: 2,
      attacker_score: 62.4,
      defender_score: 56.1,
      winner_gym: spartan.id,
      spoils: 380,
      damaged_building: 'palisade',
      settled_at: hoursFromNow(-24 * 5),
      pledges: 11,
    },
    {
      ...base,
      id: stableUuid('tribe-war:karlin'),
      declared_at: hoursFromNow(-24 * 16),
      starts_at: hoursFromNow(-24 * 15),
      ends_at: hoursFromNow(-24 * 12),
      attacker: side(mine),
      defender: side(karlin),
      attacker_active: 13,
      defender_active: 4,
      defender_palisade: 0,
      attacker_score: 48.5,
      defender_score: 31,
      winner_gym: mine.id,
      spoils: 95,
      damaged_building: 'bench',
      settled_at: hoursFromNow(-24 * 12),
      pledges: 8,
    },
  ];
  return demoWars;
}

/** My verified workouts in a window, as war points (demo scoring). */
function myDemoPoints(from: string, to: string): number {
  const visits = Object.values(useGameStore.getState().visits);
  return warPoints(
    Object.values(useData.getState().sessions)
      .filter(
        (s) =>
          s.finished_at &&
          s.started_at >= from &&
          s.started_at < to &&
          (sessionVerification(s.started_at, visits) === 'verified' || (isRun(s) && qualifies(s))),
      )
      .map((s) => ({ user_id: me(), started_at: s.started_at, prs: s.pr_count })),
  );
}

function demoLive(w: TribeWar): TribeWar {
  const pledged = demoPledged.has(w.id);
  const out = { ...w, pledged, pledges: w.pledges + (pledged ? 1 : 0) };
  if (w.settled_at || new Date(w.starts_at) > new Date()) return out;
  const to = new Date(Math.min(Date.now(), new Date(w.ends_at).getTime())).toISOString();
  const mine = myDemoPoints(w.starts_at, to);
  const hours = (Date.now() - new Date(w.starts_at).getTime()) / 3600000;
  // Rivals train at a steady pace; my own verified workouts count on my side.
  const pace = Math.max(0, Math.min(72, hours)) * 6;
  const myGym = DEMO_CITY[0].id;
  const a = pace * 1.1 + (w.attacker.id === myGym ? mine : 0);
  const d = pace + (w.defender.id === myGym ? mine : 0);
  return {
    ...out,
    attacker_score: tribeScore({
      points: a,
      active: w.attacker_active,
      gearBonus: w.attacker_gear,
      revenge: w.revenge,
    }),
    defender_score: tribeScore({
      points: d,
      active: w.defender_active,
      gearBonus: w.defender_gear,
      palisade: w.defender_palisade,
    }),
  };
}

/** Wars of my tribe, newest first, with live scores. Ended ones get settled. */
export function useTribeWars(gymId: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['tribe-wars', gymId],
    enabled: !!gymId,
    refetchInterval: 60000,
    queryFn: async (): Promise<TribeWar[]> => {
      if (isDemo) return gymId === DEMO_CITY[0].id ? demoTribeWars().map(demoLive) : [];
      const cols =
        '*, attacker:gyms!tribe_wars_attacker_gym_fkey(id,name), defender:gyms!tribe_wars_defender_gym_fkey(id,name), tribe_pledges(user_id)';
      const load = async () =>
        check(
          await supabase
            .from('tribe_wars')
            .select(cols)
            .or(`attacker_gym.eq.${gymId},defender_gym.eq.${gymId}`)
            .order('declared_at', { ascending: false })
            .limit(20),
        ) as unknown as (TribeWar & { tribe_pledges: { user_id: string }[] })[];
      let rows = await load();
      const ended = rows.filter((w) => !w.settled_at && new Date(w.ends_at) <= new Date());
      if (ended.length) {
        await Promise.all(ended.map((w) => supabase.rpc('settle_tribe_war', { p_war: w.id })));
        rows = await load();
        void qc.invalidateQueries({ queryKey: ['city'] });
        void qc.invalidateQueries({ queryKey: ['fortress'] });
      }
      const uid = me();
      return Promise.all(
        rows.map(async ({ tribe_pledges, ...w }) => {
          const base = {
            ...w,
            attacker_gear: Number(w.attacker_gear),
            defender_gear: Number(w.defender_gear),
            pledges: tribe_pledges.length,
            pledged: tribe_pledges.some((p) => p.user_id === uid),
          };
          if (w.settled_at || new Date(w.starts_at) > new Date())
            return {
              ...base,
              attacker_score: Number(w.attacker_score ?? 0),
              defender_score: Number(w.defender_score ?? 0),
            };
          const s = (
            check(await supabase.rpc('tribe_war_scores', { p_war: w.id })) as {
              attacker_score: number;
              defender_score: number;
            }[]
          )[0];
          return {
            ...base,
            attacker_score: Number(s?.attacker_score ?? 0),
            defender_score: Number(s?.defender_score ?? 0),
          };
        }),
      );
    },
  });
}

/** My points and place on my side of a war. */
export function useTribeWarMe(war: TribeWar | undefined) {
  return useQuery({
    queryKey: ['tribe-wars', 'me', war?.id],
    enabled: !!war,
    queryFn: async (): Promise<{ points: number; place: number | null; members: number }> => {
      if (isDemo) {
        const to = new Date(Math.min(Date.now(), new Date(war!.ends_at).getTime())).toISOString();
        const points = myDemoPoints(war!.starts_at, to);
        const mineAttacks = war!.attacker.id === DEMO_CITY[0].id;
        const members = mineAttacks ? war!.attacker_active : war!.defender_active;
        return { points, place: points ? Math.max(1, Math.round(members / 3)) : null, members };
      }
      const r = (
        check(await supabase.rpc('tribe_war_me', { p_war: war!.id })) as {
          points: number;
          place: number | null;
          members: number;
        }[]
      )[0];
      return { points: Number(r?.points ?? 0), place: r?.place ?? null, members: r?.members ?? 0 };
    },
  });
}

export function useDeclareTribeWar() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async ({ target, level }: { target: CityTribeRow; level: number }) => {
      if (isDemo) {
        const myGym = DEMO_CITY[0];
        if (level < TRIBE_WAR.minLevel)
          throw new Error(`Attacks open at level ${TRIBE_WAR.minLevel} (Gladiator)`);
        const wars = demoTribeWars();
        if (
          wars.some(
            (w) =>
              !w.settled_at &&
              [w.attacker.id, w.defender.id].some((id) => id === myGym.id || id === target.id),
          )
        )
          throw new Error('One of the tribes is at war already');
        const revenge = wars.some(
          (w) =>
            w.attacker.id === target.id &&
            w.defender.id === myGym.id &&
            w.winner_gym === target.id &&
            revengeUntil(w.ends_at) > new Date(),
        );
        if (!revenge) demoPay(`gym:${myGym.id}`, TRIBE_WAR.cost);
        wars.unshift({
          id: stableUuid(`tribe-war:${target.id}:${Date.now()}`),
          ...tribeWarTimes(new Date()),
          attacker: { id: myGym.id, name: myGym.name },
          defender: { id: target.id, name: target.name },
          revenge,
          attacker_active: 14,
          defender_active: Math.max(TRIBE_WAR.minActive, Math.round(target.members / 2)),
          attacker_gear: 0.07,
          defender_gear: 0.07,
          defender_palisade: target.palisade,
          attacker_score: 0,
          defender_score: 0,
          winner_gym: null,
          spoils: null,
          damaged_building: null,
          settled_at: null,
          pledges: 0,
          pledged: false,
        });
        return;
      }
      check(await supabase.rpc('declare_tribe_war', { p_target: target.id }));
    },
    onSuccess: done,
  });
}

export function usePledgeDefence() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: async (war: TribeWar) => {
      if (isDemo) {
        demoPledged.add(war.id);
        return;
      }
      check(await supabase.rpc('pledge_defence', { p_war: war.id }));
    },
    onSuccess: done,
  });
}
