import { router } from 'expo-router';
import { Copy, Plus, Star, Trash2 } from '@/components/icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { ProgressBar } from '@/components/Charts';
import { GlassCard } from '@/components/Glass';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { duplicateProgram } from '@/features/programs/ops';
import { useFinishedSessions } from '@/features/training/hooks';
import { weekdayLetter } from '@/lib/dates';
import {
  completedWorkouts,
  plannedWorkouts,
  programWeek,
  weekStrip,
  weeklyTarget,
} from '@/lib/programs';
import type { Program } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

function editProgram(id: string) {
  router.push({ pathname: '/program/[id]', params: { id } });
}

export default function Programs() {
  const programs = useData((s) => s.programs);
  const sessions = useFinishedSessions();
  const [menu, setMenu] = useState<Program | null>(null);
  const list = useMemo(
    () => Object.values(programs).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [programs],
  );
  const active = list.find((p) => p.is_active);
  const others = list.filter((p) => !p.is_active);

  return (
    <Screen glow="right" glowTop={-120}>
      <View style={styles.nav}>
        <BackLink label="Workouts" fallback="/workouts" />
        <IconButton
          icon={Plus}
          accessibilityLabel="New program"
          onPress={() => editProgram('new')}
        />
      </View>
      <View style={{ marginTop: -8 }}>
        <Header title="Programs" />
      </View>

      {active ? (
        <ActiveCard program={active} sessions={sessions} onMenu={() => setMenu(active)} />
      ) : (
        <GlassCard style={{ gap: 6 }}>
          <Text style={[type.captionStrong, { color: colors.accent }]}>Active</Text>
          <Text style={type.title}>No active program</Text>
          <Text style={type.caption}>Long-press a program below and choose “Set as active”.</Text>
        </GlassCard>
      )}

      <View style={{ gap: 8 }}>
        <SectionHeader title="My programs" />
        {others.length > 0 ? (
          <ListGroup>
            {others.map((p) => (
              <ListRow
                key={p.id}
                title={<Text style={[type.bodyStrong, { fontSize: 16 }]}>{p.name}</Text>}
                subtitle={`${weeklyTarget(p)} days · ${p.weeks} weeks`}
                onPress={() => editProgram(p.id)}
                onLongPress={() => setMenu(p)}
                accessibilityLabel={`${p.name}. Long-press for options`}
              />
            ))}
          </ListGroup>
        ) : (
          <Text style={[type.caption, { paddingHorizontal: 4 }]}>
            {active ? 'No other programs yet.' : 'No programs yet.'}
          </Text>
        )}
        <FillButton
          label="Create program"
          icon={Plus}
          style={{ marginTop: 6 }}
          onPress={() => editProgram('new')}
        />
        {others.length > 0 ? (
          <Text style={[type.small, { textAlign: 'center' }]}>
            Long-press a program for more options.
          </Text>
        ) : null}
      </View>

      <ProgramMenu program={menu} onClose={() => setMenu(null)} />
    </Screen>
  );
}

function ActiveCard({
  program,
  sessions,
  onMenu,
}: {
  program: Program;
  sessions: ReturnType<typeof useFinishedSessions>;
  onMenu: () => void;
}) {
  const week = programWeek(program);
  const done = completedWorkouts(program, sessions);
  const planned = plannedWorkouts(program);
  const strip = weekStrip(program, sessions);
  return (
    <GlassCard style={{ gap: 14 }}>
      <View style={styles.row}>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={[type.captionStrong, { color: colors.accent }]}>Active</Text>
          <Text style={type.title} onLongPress={onMenu}>
            {program.name}
          </Text>
          <Text style={type.caption}>
            {weeklyTarget(program)} days a week · {program.weeks} weeks
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TextButton label="More" onPress={onMenu} />
          <TextButton label="Edit" onPress={() => editProgram(program.id)} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View style={styles.row}>
          <Text style={type.small}>
            Week {week} of {program.weeks}
          </Text>
          <Text style={type.small}>
            {done} of {planned} workouts
          </Text>
        </View>
        <ProgressBar value={planned ? done / planned : 0} />
      </View>
      <View style={styles.strip} accessibilityLabel="This week">
        {strip.map((d) => (
          <View key={d.weekday} style={styles.stripDay}>
            <Text style={styles.stripLetter}>{weekdayLetter(d.weekday)}</Text>
            <View
              style={[
                styles.stripDot,
                d.state === 'done' && { backgroundColor: colors.fillStrong },
                d.state === 'today' && { backgroundColor: colors.accent },
                (d.state === 'next' || d.state === 'missed') && styles.dashed,
              ]}
            >
              <Text
                style={[
                  styles.stripLabel,
                  {
                    color:
                      d.state === 'today'
                        ? '#fff'
                        : d.state === 'done'
                          ? colors.text
                          : colors.text2,
                  },
                ]}
              >
                {d.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function ProgramMenu({ program, onClose }: { program: Program | null; onClose: () => void }) {
  const setActive = useData((s) => s.setActiveProgram);
  const save = useData((s) => s.saveProgram);
  const remove = useData((s) => s.deleteProgram);
  return (
    <Sheet visible={!!program} onClose={onClose} title={program?.name}>
      {program ? (
        <View style={{ gap: 10, paddingBottom: 8 }}>
          {!program.is_active ? (
            <FillButton
              label="Set as active"
              icon={Star}
              onPress={() => {
                setActive(program.id);
                toast(`${program.name} is now active`);
                onClose();
              }}
            />
          ) : null}
          <FillButton
            label="Duplicate"
            icon={Copy}
            onPress={() => {
              save(duplicateProgram(program));
              onClose();
            }}
          />
          <FillButton
            label="Delete"
            icon={Trash2}
            onPress={async () => {
              onClose();
              const ok = await confirm({
                title: `Delete ${program.name}?`,
                message: 'Past workouts stay in your history.',
                confirmLabel: 'Delete',
                destructive: true,
              });
              if (ok) remove(program.id);
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  strip: { flexDirection: 'row', gap: 6 },
  stripDay: { flex: 1, alignItems: 'center', gap: 5 },
  stripLetter: { fontSize: 11, fontWeight: '600', color: colors.text2 },
  stripDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(60,60,67,0.3)' },
  stripLabel: { fontSize: 12, fontWeight: '600' },
});
