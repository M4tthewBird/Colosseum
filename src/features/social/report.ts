/** Reporting a post, comment or person. Reports are read in Supabase; users cannot read them. */
import { isDemo, supabase } from '@/lib/supabase';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';

export type ReportTarget = 'forum_post' | 'forum_comment' | 'session_comment' | 'user';

const WHAT: Record<ReportTarget, string> = {
  forum_post: 'this post',
  forum_comment: 'this comment',
  session_comment: 'this comment',
  user: 'this person',
};

async function sendReport(target: ReportTarget, id: string): Promise<void> {
  if (isDemo) return;
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: useData.getState().userId, target_type: target, target_id: id });
  // Reported before: that one still stands.
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function askToReport(target: ReportTarget, id: string): Promise<void> {
  const ok = await confirm({
    title: `Report ${WHAT[target]}?`,
    message:
      'For spam, abuse or anything that does not belong here. They will not know it was you.',
    confirmLabel: 'Report',
    destructive: true,
  });
  if (!ok) return;
  try {
    await sendReport(target, id);
    toast('Reported. Thanks for telling us.');
  } catch {
    toast('Could not send the report. Are you online?');
  }
}
