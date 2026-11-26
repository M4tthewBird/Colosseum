/**
 * The user's own game state, computed on the device from the training history (works offline),
 * and GameSync, which sends the capped per-day totals to the server for the league tables.
 */
import { useEffect, useMemo } from 'react';

import { myDotsCoefficient } from '@/features/social/api';
import { useActiveProgram, useFinishedSessions } from '@/features/training/hooks';
import { attributes, type Attributes } from '@/lib/game/attributes';
import { computeGame, currentSeason, type GameState, type SeasonTotals } from '@/lib/game/engine';
import { machineBonus, type Building } from '@/lib/game/fortress';
import { levelProgress, rankFor, type LevelProgress, type Rank } from '@/lib/game/levels';
import { openVisit, sessionVerification, visitStatus, type GymVisit } from '@/lib/game/visits';
import { weeklyTarget } from '@/lib/programs';
import { isDemo } from '@/lib/supabase';
import { scheduleFlush } from '@/lib/sync';
import { stableUuid } from '@/lib/uuid';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { useGame } from '@/stores/game';
import { useQueue } from '@/stores/queue';
import { bestLeague, type GearProgress } from '@/lib/game/gear';
import { leagueFor } from '@/lib/game/levels';
import { useAwards, useFortress, useMyLudus, useMyTogether, useVisitPull } from './api';
import { useGladiator } from './cityApi';

export function useVisits(): GymVisit[] {
  const visits = useGame((s) => s.visits);
  return useMemo(
    () => Object.values(visits).sort((a, b) => b.in_at.localeCompare(a.in_at)),
    [visits],
  );
}

/** The fortresses I belong to: my ludus and my home gym. */
function useMyBuildings(): Building[] {
  const ludus = useMyLudus().data;
  const gymId = useData((s) => s.profile?.home_gym_id);
  const gym = useFortress('gym', gymId).data;
  return useMemo(() => [...(ludus?.buildings ?? []), ...(gym?.buildings ?? [])], [ludus, gym]);
}

export interface MyGame extends GameState {
  progress: LevelProgress;
  rank: Rank;
  season: SeasonTotals;
}

export function useMyGame(): MyGame {
  const sessions = useFinishedSessions();
  const exercises = useData((s) => s.exercises);
  const experience = useData((s) => s.profile?.experience ?? null);
  // Bodyweight changes the DOTS part; read it as a value so the memo follows it.
  const bodyweights = useData((s) => s.bodyweights);
  const sex = useData((s) => s.profile?.sex);
  const target = weeklyTarget(useActiveProgram());
  const visits = useVisits();
  const together = useMyTogether().data;
  const ludus = useMyLudus().data;
  const buildings = useMyBuildings();
  const awards = useAwards().data;
  const styles = useGladiator().data?.styles;

  return useMemo(() => {
    const dotsK = myDotsCoefficient();
    void bodyweights;
    void sex;
    const ludusIds = new Set((ludus?.members ?? []).map((m) => m.id));
    const state = computeGame({
      sessions,
      exerciseName: (id) => exercises[id]?.name,
      experience,
      weeklyTarget: target,
      dotsCoefficient: dotsK,
      verification: (s) => sessionVerification(s.started_at, visits),
      together: new Set((together ?? []).map((t) => t.sessionId)),
      togetherLudus: new Set(
        (together ?? []).filter((t) => ludusIds.has(t.partnerId)).map((t) => t.sessionId),
      ),
      denariiBonus: (_s, names) => machineBonus(buildings, names),
      awards: awards ?? {},
      styles,
      exerciseMuscles: (id) => exercises[id]?.muscles ?? [],
    });
    return {
      ...state,
      progress: levelProgress(state.xp),
      rank: rankFor(state.level),
      season: currentSeason(state),
    };
  }, [
    sessions,
    exercises,
    experience,
    target,
    visits,
    together,
    ludus,
    buildings,
    awards,
    styles,
    bodyweights,
    sex,
  ]);
}

/** What opens gear: level, verified workouts, the best league and pieces bought. */
export function useGearProgress(): GearProgress {
  const game = useMyGame();
  const bought = useGladiator().data?.bought;
  return useMemo(
    () => ({
      level: game.level,
      // Runs count like verified workouts (docs/GAME.md → 11), as on the server.
      verified: Object.values(game.sessions).filter(
        (s) => s.qualifies && (s.verification === 'verified' || s.run),
      ).length,
      league: bestLeague(game.seasons.map((s) => leagueFor(s.score).id)),
      bought: bought ?? new Set(),
    }),
    [game, bought],
  );
}

export function useMyAttributes(): Attributes {
  const sessions = useFinishedSessions();
  const exercises = useData((s) => s.exercises);
  const bodyweights = useData((s) => s.bodyweights);
  const sex = useData((s) => s.profile?.sex);
  const target = weeklyTarget(useActiveProgram());
  return useMemo(() => {
    void bodyweights;
    void sex;
    return attributes(sessions, (id) => exercises[id]?.name, myDotsCoefficient(), target);
  }, [sessions, exercises, target, bodyweights, sex]);
}

/** The visit going on now (updates every minute, so it closes by itself after 3 hours). */
export function useOpenVisit(): GymVisit | null {
  const visits = useVisits();
  const now = useNow(true, 60000);
  return useMemo(() => openVisit(visits, new Date(now)), [visits, now]);
}

/** Days this month with a verified visit (for the demo Bellum table). */
export function useMyVisitDaysThisMonth(): number {
  const visits = useVisits();
  return useMemo(() => {
    const now = new Date();
    const days = new Set<string>();
    for (const v of visits) {
      const d = new Date(v.in_at);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
        if (visitStatus(v) === 'verified') days.add(d.toDateString());
    }
    return days.size;
  }, [visits]);
}

/**
 * Sends changed game days and this season's carry-over through the offline queue, and pulls the
 * server's checks of my visits. Mount once (on Today).
 */
export function GameSync() {
  const game = useMyGame();
  const userId = useData((s) => s.userId);
  const visits = useVisits();
  const checking = visits.some((v) => {
    const st = visitStatus(v);
    return st === 'checking' || (st === 'open' && v.in_ok == null);
  });
  useVisitPull(checking);

  useEffect(() => {
    if (isDemo || !userId) return;
    const { synced, setSynced } = useGame.getState();
    const rows = [];
    const patch: Record<string, string> = {};
    for (const d of Object.values(game.days)) {
      const sig = `${d.xp}/${d.laurels}/${d.denarii}/${d.workouts}/${d.prs}`;
      if (synced[d.day] === sig) continue;
      const id = stableUuid(`game-day:${userId}:${d.day}`);
      rows.push({
        table: 'game_days' as const,
        op: 'upsert' as const,
        id,
        row: {
          id,
          user_id: userId,
          day: d.day,
          xp: d.xp,
          laurels: d.laurels,
          denarii: d.denarii,
          workouts: Math.min(10, d.workouts),
          prs: Math.min(100, d.prs),
          updated_at: new Date().toISOString(),
        },
      });
      patch[d.day] = sig;
    }
    // Days that lost their workouts (deleted) go back to zero.
    for (const day of Object.keys(synced)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || game.days[day] || synced[day] === '0/0/0/0/0')
        continue;
      const id = stableUuid(`game-day:${userId}:${day}`);
      rows.push({
        table: 'game_days' as const,
        op: 'upsert' as const,
        id,
        row: { id, user_id: userId, day, xp: 0, laurels: 0, denarii: 0, workouts: 0, prs: 0 },
      });
      patch[day] = '0/0/0/0/0';
    }
    const s = game.season;
    const carryKey = `carry:${s.season}`;
    if (synced[carryKey] !== String(s.carry)) {
      const id = stableUuid(`game-carry:${userId}:${s.season}`);
      rows.push({
        table: 'game_carry' as const,
        op: 'upsert' as const,
        id,
        row: {
          id,
          user_id: userId,
          season: s.season,
          carry: s.carry,
          updated_at: new Date().toISOString(),
        },
      });
      patch[carryKey] = String(s.carry);
    }
    if (!rows.length) return;
    useQueue.getState().enqueue(rows);
    setSynced(patch);
    scheduleFlush();
  }, [game.days, game.season, userId]);

  return null;
}
