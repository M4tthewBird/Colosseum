/**
 * Badges for the signed-in user (computed from the local history) and for others (the tiers
 * they earned, stored in user_badges so friends and gym members can see them).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useFriends } from '@/features/social/api';
import { useActiveProgram, useFinishedSessions } from '@/features/training/hooks';
import { BADGES, computeBadges, type BadgeStatus } from '@/lib/badges';
import { weeklyTarget } from '@/lib/programs';
import { isDemo, supabase } from '@/lib/supabase';
import type { Session } from '@/lib/types';
import { stableUuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { useQueue } from '@/stores/queue';

/** My badges, with progress. */
export function useMyBadges(): BadgeStatus[] {
  const sessions = useFinishedSessions();
  const exercises = useData((s) => s.exercises);
  const target = weeklyTarget(useActiveProgram());
  const friends = useFriends().data?.friends.length ?? 0;
  return useMemo(
    () => computeBadges(sessions, (id) => exercises[id]?.name, { weeklyTarget: target, friends }),
    [sessions, exercises, target, friends],
  );
}

/** Sends newly earned tiers to user_badges (through the offline queue). Mount once. */
export function useBadgeSync(badges: BadgeStatus[]) {
  const userId = useData((s) => s.userId);
  useEffect(() => {
    if (isDemo || !userId) return;
    const synced = usePrefs.getState().badgesSynced;
    const next = { ...synced };
    const rows = [];
    for (const b of badges) {
      const top = b.earned[b.earned.length - 1];
      const key = `${userId}:${b.def.id}`;
      if (!top || synced[key] === top.threshold) continue;
      const id = stableUuid(`badge:${userId}:${b.def.id}`);
      rows.push({
        table: 'user_badges' as const,
        op: 'upsert' as const,
        id,
        row: {
          id,
          user_id: userId,
          badge: b.def.id,
          tier: top.threshold,
          earned_at: top.at ?? new Date().toISOString(),
        },
      });
      next[key] = top.threshold;
    }
    if (!rows.length) return;
    useQueue.getState().enqueue(rows);
    usePrefs.getState().setBadgesSynced(next);
  }, [badges, userId]);
}

/**
 * Someone else's earned badges as statuses (top tier only, no progress). In demo mode they are
 * computed from the sessions their page shows.
 */
export function useUserBadges(userId: string, demoSessions: Session[] | undefined) {
  const exercises = useData((s) => s.exercises);
  const remote = useQuery({
    queryKey: ['user-badges', userId],
    enabled: !isDemo && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge,tier,earned_at')
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return data as { badge: string; tier: number; earned_at: string }[];
    },
  });
  return useMemo((): BadgeStatus[] => {
    if (isDemo)
      return computeBadges(demoSessions ?? [], (id) => exercises[id]?.name).filter(
        (b) => b.earned.length,
      );
    return (remote.data ?? []).flatMap((r) => {
      const def = BADGES.find((b) => b.id === r.badge);
      if (!def) return [];
      const reached = def.tiers.filter((t) => t <= r.tier);
      return [
        {
          def,
          value: r.tier,
          earned: reached.map((t) => ({ threshold: t, at: r.earned_at, sessionId: null })),
          next: def.tiers.find((t) => t > r.tier) ?? null,
        },
      ];
    });
  }, [remote.data, demoSessions, exercises]);
}
