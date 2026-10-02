import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { ListGroup, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { SavedWorkouts } from '@/features/programs/SavedWorkouts';
import { useActiveProgram, useFinishedSessions } from '@/features/training/hooks';
import { MonthCalendar } from '@/features/training/MonthCalendar';
import { SessionRow } from '@/features/training/SessionRow';
import { UpNextCard } from '@/features/training/UpNextCard';
import { programWeek } from '@/lib/programs';
import { useData } from '@/stores/data';
import { usePendingIds, useQueue } from '@/stores/queue';
import { type } from '@/theme/tokens';

const PAGE = 20;

export default function Workouts() {
  const program = useActiveProgram();
  const sessions = useFinishedSessions();
  const exercises = useData((s) => s.exercises);
  const pending = usePendingIds();
  const syncError = useQueue((s) => s.lastError);
  const [shown, setShown] = useState(PAGE);

  const above = program
    ? `${program.name} · week ${programWeek(program)} of ${program.weeks}`
    : 'No active program';

  return (
    <Screen glow="left" glowTop={-120}>
      <Header
        above={above}
        title="Workouts"
        right={
          <FillButton
            label="Programs"
            size="sm"
            onPress={() => router.push('/workouts/programs')}
          />
        }
      />
      <UpNextCard variant="workouts" />
      <SavedWorkouts />
      <MonthCalendar sessions={sessions} />

      <View style={{ gap: 8 }}>
        <SectionHeader title="Previous workouts" />
        {pending.size > 0 ? (
          <Text style={[type.small, { paddingHorizontal: 4 }]}>
            Not synced yet · {syncError ? 'will retry' : 'waiting for connection'}
          </Text>
        ) : null}
        {sessions.length > 0 ? (
          <>
            <ListGroup>
              {sessions.slice(0, shown).map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  exercises={exercises}
                  pending={pending.has(s.id) || s.sets.some((x) => pending.has(x.id))}
                />
              ))}
            </ListGroup>
            {sessions.length > shown ? (
              <TextButton
                label="Show more"
                accent
                style={{ alignSelf: 'center', paddingVertical: 8 }}
                onPress={() => setShown((n) => n + PAGE)}
              />
            ) : null}
          </>
        ) : (
          <GlassCard radius={22} style={{ padding: 16 }}>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              Finished workouts show up here.
            </Text>
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}
