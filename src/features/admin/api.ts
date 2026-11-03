/**
 * Admin (Settings → Admin): only for accounts in public.admins (see
 * supabase/updates/2026-11-03-admin.sql). The server checks every call; the app only hides the
 * screen from everyone else. In demo mode the demo user is the admin, with sample numbers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_FEEDBACK, DEMO_REPORTS, DEMO_USERS, demoAdminStats, demoUser } from '@/dev/seed';
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

// ───────────── Feedback and error reports ─────────────

export interface AdminFeedback {
  id: string;
  kind: 'message' | 'crash' | 'sync';
  message: string;
  details: Record<string, unknown>;
  /** Path in the private "feedback" bucket. */
  screenshot: string | null;
  created_at: string;
  resolved_at: string | null;
  user_id: string;
  username: string | null;
  display_name: string | null;
}

let demoFeedback: AdminFeedback[] | null = null;
function demoFeedbackList(): AdminFeedback[] {
  demoFeedback ??= DEMO_FEEDBACK.map((f) => {
    const u = demoUser(f.author);
    return {
      id: stableUuid(`feedback:${f.message}`),
      kind: f.kind,
      message: f.message,
      details: f.details,
      screenshot: null,
      created_at: new Date(Date.now() - f.hoursAgo * 3600_000).toISOString(),
      resolved_at: null,
      user_id: u.id,
      username: u.username,
      display_name: u.display_name,
    };
  });
  return demoFeedback;
}

/** Open ones (resolved = false) or the ones marked done. */
export function useAdminFeedback(resolved: boolean) {
  return useQuery({
    queryKey: ['admin-feedback', resolved],
    queryFn: async (): Promise<AdminFeedback[]> => {
      if (isDemo)
        return demoFeedbackList()
          .filter((f) => !!f.resolved_at === resolved)
          .map((f) => ({ ...f }));
      const { data, error } = await supabase.rpc('admin_feedback', { p_resolved: resolved });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminFeedback[];
    },
  });
}

export function useResolveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      if (isDemo) {
        const f = demoFeedbackList().find((x) => x.id === id);
        if (f) f.resolved_at = resolved ? new Date().toISOString() : null;
        return;
      }
      const { error } = await supabase.rpc('admin_resolve_feedback', {
        p_id: id,
        p_resolved: resolved,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-feedback'] }),
  });
}

/** A short-lived link to a screenshot in the private bucket. */
export function useScreenshotUrl(path: string | null) {
  return useQuery({
    queryKey: ['feedback-shot', path],
    enabled: !!path && !isDemo,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('feedback')
        .createSignedUrl(path!, 60 * 60);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}

// ───────────── Users: password help ─────────────

export interface PasswordHelpRequest {
  id: string;
  username: string;
  /** Null: no account has that username (maybe misremembered). */
  user_id: string | null;
  display_name: string | null;
  contact: string;
  created_at: string;
}

export interface FoundUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

let demoHelp: PasswordHelpRequest[] | null = null;
function demoHelpList(): PasswordHelpRequest[] {
  demoHelp ??= [
    {
      id: stableUuid('help:lukas'),
      username: 'lukas',
      user_id: demoUser('lukas').id,
      display_name: demoUser('lukas').display_name,
      contact: 'Instagram @lukas.lifts',
      created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
  ];
  return demoHelp;
}

export function usePasswordHelp() {
  return useQuery({
    queryKey: ['admin-password-help'],
    queryFn: async (): Promise<PasswordHelpRequest[]> => {
      if (isDemo) return demoHelpList().map((h) => ({ ...h }));
      const { data, error } = await supabase.rpc('admin_password_help');
      if (error) throw new Error(error.message);
      return (data ?? []) as PasswordHelpRequest[];
    },
  });
}

export function useFindUsers(query: string) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ['admin-find-users', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<FoundUser[]> => {
      if (isDemo)
        return DEMO_USERS.filter(
          (u) => u.username.includes(q) || u.display_name.toLowerCase().includes(q),
        ).map((u) => ({ ...u, created_at: new Date().toISOString() }));
      const { data, error } = await supabase.rpc('admin_find_users', { p_query: q });
      if (error) throw new Error(error.message);
      return (data ?? []) as FoundUser[];
    },
  });
}

/** Sets a temporary password and returns it; the user must replace it after signing in. */
export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      if (isDemo) {
        demoHelp = demoHelpList().filter((h) => h.user_id !== userId);
        return 'q398sarazy';
      }
      const { data, error } = await supabase.rpc('admin_reset_password', { p_user: userId });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-password-help'] }),
  });
}

export function usePasswordHelpDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        demoHelp = demoHelpList().filter((h) => h.id !== id);
        return;
      }
      const { error } = await supabase.rpc('admin_password_help_done', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-password-help'] }),
  });
}
