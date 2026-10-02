import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from '@/components/icons';
import { Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import { Header, Screen } from '@/components/Screen';
import { formatDuration, shortDate, weekdayName, isoWeekday } from '@/lib/dates';
import { formatKg, formatVolume, volume } from '@/lib/formulas';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

/** Read-only session detail with Delete. */
export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useData((s) => s.sessions[id]);
  const exercises = useData((s) => s.exercises);
  const deleteSession = useData((s) => s.deleteSession);

  if (!session) {
    return (
      <Screen tabs={false}>
        <BackLink label="Back" />
        <Text style={type.body}>This workout no longer exists.</Text>
      </Screen>
    );
  }

  const d = new Date(session.started_at);
  const groups = new Map<number, typeof session.sets>();
  for (const s of [...session.sets].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
  )) {
    const list = groups.get(s.exercise_position) ?? [];
    list.push(s);
    groups.set(s.exercise_position, list);
  }
  const dur = session.finished_at
    ? formatDuration(new Date(session.finished_at).getTime() - d.getTime())
    : 'In progress';

  return (
    <Screen tabs={false} gap={16}>
      <BackLink label="Workouts" fallback="/workouts" />
      <Header
        above={`${weekdayName(isoWeekday(d))}, ${shortDate(d)} ${d.getFullYear()}`}
        title={session.name}
      />
      <GlassCard style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Stat value={dur} label="Duration" />
        <Stat value={formatVolume(volume(session.sets))} label="Volume" />
        <Stat value={String(session.sets.filter((s) => s.done).length)} label="Sets" />
        <Stat value={String(session.pr_count)} label="PRs" accent={session.pr_count > 0} />
      </GlassCard>

      {[...groups.entries()].map(([pos, sets]) => {
        const ex = exercises[sets[0].exercise_id];
        return (
          <Glass key={pos} radius={22} style={{ padding: 16, gap: 8 }}>
            <Text style={[type.bodyStrong, { fontSize: 17 }]}>{ex?.name ?? 'Exercise'}</Text>
            {sets.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={[type.caption, { width: 44 }]}>Set {s.set_number}</Text>
                <Text style={[type.body, tabular, { flex: 1 }]}>
                  {formatKg(s.weight_kg)} kg × {s.reps}
                </Text>
                {s.is_pr ? (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>PR</Text>
                ) : null}
              </View>
            ))}
          </Glass>
        );
      })}

      <FillButton
        label="Delete workout"
        icon={Trash2}
        onPress={async () => {
          const ok = await confirm({
            title: 'Delete this workout?',
            message: 'Its sets and PRs are removed for good.',
            confirmLabel: 'Delete',
            destructive: true,
          });
          if (!ok) return;
          deleteSession(session.id);
          if (router.canGoBack()) router.back();
          else router.replace('/workouts');
        }}
      />
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        style={[
          type.bodyStrong,
          { fontSize: 16, fontWeight: '700' },
          accent && { color: colors.accent },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}
