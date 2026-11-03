/**
 * Admin (only for accounts in public.admins; Settings shows the row to them alone, and the server
 * refuses everyone else): how many people use Colosseum and whether they come back, and what was
 * reported. Feedback, password resets and announcements join here later (docs/BACKLOG.md).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { Glass } from '@/components/Glass';
import { Ban, Check, Trash2 } from '@/components/icons';
import { EmptyState, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import {
  useAdminReports,
  useAdminStats,
  useIsAdmin,
  useReportAction,
  type AdminReport,
  type ReportAction,
} from '@/features/admin/api';
import { biggestDrop, funnelSteps, pct, type AdminStats } from '@/lib/adminStats';
import { fromLocalDate, shortDate, timeAgo } from '@/lib/dates';
import { confirm, toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

type Tab = 'stats' | 'reports';

export default function Admin() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>('stats');
  const reports = useAdminReports();
  const open = reports.data?.filter((r) => !r.gone).length ?? 0;

  if (!isAdmin) {
    return (
      <Screen gap={16}>
        <BackLink label="Settings" fallback="/profile/settings" />
        <Header title="Admin" />
        <EmptyState title="Admins only" text="This account is not an admin." />
      </Screen>
    );
  }

  return (
    <Screen gap={16}>
      <BackLink label="Settings" fallback="/profile/settings" />
      <Header title="Admin" />
      <Segmented
        options={[
          { value: 'stats', label: 'Stats' },
          { value: 'reports', label: open ? `Reports · ${open}` : 'Reports' },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Admin sections"
      />
      {tab === 'stats' ? <Stats /> : <Reports />}
    </Screen>
  );
}

// ───────────── Stats ─────────────

function Stats() {
  const q = useAdminStats();
  if (q.isPending) return <Text style={type.caption}>Loading…</Text>;
  if (q.error)
    return (
      <EmptyState
        title="Could not load the stats"
        text={q.error.message}
        action={<FillButton label="Try again" size="sm" onPress={() => void q.refetch()} />}
      />
    );
  const s = q.data;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SectionHeader title="Users" />
        <Tiles
          items={[
            { label: 'Total', value: s.users },
            { label: 'New today', value: s.new_today },
            { label: 'New in 7 days', value: s.new_7d },
            { label: 'New in 30 days', value: s.new_30d },
          ]}
        />
        <SignupChart weeks={s.signups_by_week} />
        <Hint
          text={`${s.installed_30d} opened it from the Home Screen in the last 30 days (${pct(s.installed_30d, s.active_30d)} of active users).`}
        />
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title="Active" />
        <Tiles
          items={[
            { label: 'Today', value: s.active_1d },
            { label: '7 days', value: s.active_7d },
            { label: '30 days', value: s.active_30d },
          ]}
        />
        <Hint text="Active: opened the app or trained that day." />
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title="Coming back" />
        <Glass radius={22} style={styles.card}>
          {s.retention.map((r) => (
            <View key={r.days} style={styles.row}>
              <Text style={[type.body, { flex: 1 }]}>
                After {r.days} {r.days === 1 ? 'day' : 'days'}
              </Text>
              <Text style={[type.caption, tabular]}>
                {r.back} of {r.eligible}
              </Text>
              <Text style={[styles.big, tabular]}>{pct(r.back, r.eligible)}</Text>
            </View>
          ))}
        </Glass>
        <Hint text="Of everyone who signed up at least that long ago: how many were active again on that day or later." />
      </View>

      <Funnel f={s.funnel} />
    </View>
  );
}

function Tiles({ items }: { items: { label: string; value: number }[] }) {
  return (
    <View style={styles.tiles}>
      {items.map((t) => (
        <Glass key={t.label} radius={18} style={styles.tile}>
          <Text style={[styles.tileValue, tabular]}>{t.value}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {t.label}
          </Text>
        </Glass>
      ))}
    </View>
  );
}

function SignupChart({ weeks }: { weeks: AdminStats['signups_by_week'] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const first = weeks[0];
  return (
    <Glass radius={22} style={[styles.card, { gap: 10 }]}>
      <Text style={type.captionStrong}>Sign-ups per week</Text>
      <View style={styles.bars} accessibilityLabel={weeks.map((w) => w.count).join(', ')}>
        {weeks.map((w, i) => (
          <View key={w.week} style={styles.barCol}>
            <Text style={[styles.barValue, tabular]}>{w.count || ''}</Text>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, (w.count / max) * 72),
                  backgroundColor: i === weeks.length - 1 ? colors.accent : colors.fillStrong,
                },
              ]}
            />
          </View>
        ))}
      </View>
      {first ? (
        <Text style={type.small}>
          From the week of {shortDate(fromLocalDate(first.week))}; the red bar is this week.
        </Text>
      ) : null}
    </Glass>
  );
}

function Funnel({ f }: { f: AdminStats['funnel'] }) {
  const steps = funnelSteps(f);
  const drop = biggestDrop(steps);
  return (
    <View style={{ gap: 8 }}>
      <SectionHeader title="Where people drop off" />
      <Glass radius={22} style={[styles.card, { gap: 14 }]}>
        {steps.map((st, i) => (
          <View key={st.label} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={[type.body, { flex: 1 }, i === drop && { color: colors.accent }]}>
                {st.label}
              </Text>
              <Text style={[type.caption, tabular]}>
                {st.count} of {st.of}
              </Text>
              <Text style={[styles.big, tabular]}>{pct(st.count, st.of)}</Text>
            </View>
            <ProgressBar value={st.share} height={6} />
          </View>
        ))}
      </Glass>
      <Hint
        text={
          f.since
            ? `People who signed up since ${shortDate(fromLocalDate(f.since))}, when counting began. Week 2 only counts those who signed up 2+ weeks ago.${drop != null ? ` The red step loses the most people.` : ''}`
            : 'Counting starts with the first app open after this update.'
        }
      />
    </View>
  );
}

function Hint({ text }: { text: string }) {
  return <Text style={[type.caption, { paddingHorizontal: 4 }]}>{text}</Text>;
}

// ───────────── Reports ─────────────

const KIND: Record<AdminReport['target_type'], string> = {
  forum_post: 'Forum post',
  forum_comment: 'Forum comment',
  session_comment: 'Workout comment',
  user: 'Person',
};

function Reports() {
  const q = useAdminReports();
  if (q.isPending) return <Text style={type.caption}>Loading…</Text>;
  if (q.error)
    return (
      <EmptyState
        title="Could not load the reports"
        text={q.error.message}
        action={<FillButton label="Try again" size="sm" onPress={() => void q.refetch()} />}
      />
    );
  if (!q.data.length)
    return <EmptyState title="Nothing reported" text="Reports from users show up here." />;
  return (
    <View style={{ gap: 12 }}>
      {q.data.map((r) => (
        <ReportCard key={`${r.target_type}:${r.target_id}`} r={r} />
      ))}
      <Hint text="Delete removes the post or comment for everyone. Block stops that person from posting and commenting. Done clears the reports and leaves everything as it is." />
    </View>
  );
}

function ReportCard({ r }: { r: AdminReport }) {
  const action = useReportAction();
  const who = r.author_username ? `@${r.author_username}` : 'someone';
  const run = async (a: ReportAction, ask?: { title: string; message: string; label: string }) => {
    if (ask) {
      const ok = await confirm({
        title: ask.title,
        message: ask.message,
        confirmLabel: ask.label,
        destructive: true,
      });
      if (!ok) return;
    }
    action.mutate(a, {
      onSuccess: () =>
        toast(
          a.kind === 'delete'
            ? 'Deleted'
            : a.kind === 'dismiss'
              ? 'Done'
              : a.blocked
                ? `${who} is blocked`
                : `${who} is unblocked`,
        ),
      onError: (e) => toast(e.message),
    });
  };

  return (
    <Glass radius={22} style={[styles.card, { gap: 10, opacity: r.gone ? 0.6 : 1 }]}>
      <View style={styles.row}>
        <Text style={[type.captionStrong, { flex: 1 }]}>
          {KIND[r.target_type]}
          {r.gone ? ' · deleted' : ''}
        </Text>
        <Text style={type.small}>
          {r.reports} {r.reports === 1 ? 'report' : 'reports'} · {timeAgo(r.last_at)}
        </Text>
      </View>
      {r.preview ? (
        <Text style={type.body} numberOfLines={4}>
          {r.preview}
        </Text>
      ) : null}
      <Text style={type.caption}>
        {r.author_name ? `${r.author_name} · ` : ''}
        {who}
        {r.author_blocked ? ' · blocked' : ''}
      </Text>
      <View style={styles.actions}>
        {!r.gone && r.target_type !== 'user' ? (
          <FillButton
            label="Delete"
            icon={Trash2}
            size="sm"
            disabled={action.isPending}
            onPress={() =>
              void run(
                { kind: 'delete', report: r },
                {
                  title: `Delete this ${KIND[r.target_type].toLowerCase()}?`,
                  message: 'It disappears for everyone. This cannot be undone.',
                  label: 'Delete',
                },
              )
            }
          />
        ) : null}
        {r.author_id ? (
          <FillButton
            label={r.author_blocked ? 'Unblock' : 'Block'}
            icon={Ban}
            size="sm"
            disabled={action.isPending}
            onPress={() =>
              void run(
                { kind: 'block', report: r, blocked: !r.author_blocked },
                r.author_blocked
                  ? undefined
                  : {
                      title: `Block ${who}?`,
                      message: 'They can still train and see others, but cannot post or comment.',
                      label: 'Block',
                    },
              )
            }
          />
        ) : null}
        <FillButton
          label="Done"
          icon={Check}
          size="sm"
          disabled={action.isPending}
          onPress={() => void run({ kind: 'dismiss', report: r })}
        />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  big: { fontSize: 17, fontWeight: '700', color: colors.text, minWidth: 52, textAlign: 'right' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '40%', minWidth: 96, padding: 12, gap: 2 },
  tileValue: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 92 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  bar: { width: '100%', borderRadius: 4 },
  barValue: { fontSize: 10, color: colors.text2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
