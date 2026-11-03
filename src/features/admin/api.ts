/**
 * Admin (Settings → Admin): only for accounts in public.admins (see
 * supabase/updates/2026-11-03-admin.sql). The server checks every call; the app only hides the
 * screen from everyone else. In demo mode the demo user is the admin, with sample numbers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_REPORTS, demoAdminStats, demoUser } from '@/dev/seed';
import type { AdminStats } from '@/lib/adminStats';
import { toLocalDate } from '@/lib/dates';
import { isDemo, supabase } from '@/lib/supabase';
import { stableUuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import type { ReportTarget } from '@/features/social/report';

export function useIsAdmin(): boolean {
  const userId = useData((s) => s.userId);
  const q = useQuery({
    queryKey: ['is-admin', userId],
    enabled: !!userId,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      if (isDemo) return true;
      const { data, error } = await supabase.rpc('is_admin');
      // Before the admin SQL has run, nobody is an admin.
      if (error) return false;
      return !!data;
    },
  });
  return q.data === true;
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      if (isDemo) return demoAdminStats(toLocalDate(new Date()));
      const { data, error } = await supabase.rpc('admin_stats', { p_tz: timeZone() });
      if (error) throw new Error(error.message);
      return data as AdminStats;
    },
  });
}

export interface AdminReport {
  target_type: ReportTarget;
  target_id: string;
  reports: number;
  last_at: string;
  author_id: string | null;
  author_username: string | null;
  author_name: string | null;
  /** The post's title and text or the comment; null for a reported person. */
  preview: string | null;
  /** Deleted already (by the author or the admin). */
  gone: boolean;
  author_blocked: boolean;
}

let demoReports: AdminReport[] | null = null;
function demoReportList(): AdminReport[] {
  demoReports ??= DEMO_REPORTS.map((r) => {
    const u = demoUser(r.author);
    return {
      target_type: r.target_type,
      target_id: stableUuid(`report:${r.preview}`),
      reports: r.reports,
      last_at: new Date(Date.now() - r.hoursAgo * 3600_000).toISOString(),
      author_id: u.id,
      author_username: u.username,
      author_name: u.display_name,
      preview: r.preview,
      gone: false,
      author_blocked: false,
    };
  });
  return demoReports;
}

export function useAdminReports() {
  return useQuery({
    queryKey: ['admin-reports'],
    queryFn: async (): Promise<AdminReport[]> => {
      if (isDemo) return demoReportList().map((r) => ({ ...r }));
      const { data, error } = await supabase.rpc('admin_reports');
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminReport[];
    },
  });
}

export type ReportAction =
  | { kind: 'delete'; report: AdminReport }
  | { kind: 'dismiss'; report: AdminReport }
  | { kind: 'block'; report: AdminReport; blocked: boolean };

async function runDemo(a: ReportAction) {
  const list = demoReportList();
  const r = list.find((x) => x.target_id === a.report.target_id);
  if (!r) return;
  if (a.kind === 'delete') r.gone = true;
  if (a.kind === 'dismiss') list.splice(list.indexOf(r), 1);
  if (a.kind === 'block')
    for (const x of list) if (x.author_id === r.author_id) x.author_blocked = a.blocked;
}

export function useReportAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ReportAction) => {
      if (isDemo) return runDemo(a);
      const { target_type: p_type, target_id: p_id, author_id } = a.report;
      const { error } =
        a.kind === 'delete'
          ? await supabase.rpc('admin_delete_content', { p_type, p_id })
          : a.kind === 'dismiss'
            ? await supabase.rpc('admin_dismiss_reports', { p_type, p_id })
            : await supabase.rpc('admin_set_blocked', { p_user: author_id, p_blocked: a.blocked });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-reports'] });
      void qc.invalidateQueries({ queryKey: ['forum'] });
    },
  });
}
