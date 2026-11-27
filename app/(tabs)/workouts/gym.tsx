/** Workouts → Gym: the program's next day, saved workouts and generating one. */
import { router } from 'expo-router';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { Header, Screen } from '@/components/Screen';
import { SavedWorkouts } from '@/features/programs/SavedWorkouts';
import { useActiveProgram } from '@/features/training/hooks';
import { UpNextCard } from '@/features/training/UpNextCard';
import { programWeek } from '@/lib/programs';

export default function Gym() {
  const program = useActiveProgram();
  return (
    <Screen glow="left" glowTop={-120}>
      <BackLink label="Workouts" fallback="/workouts" />
      <Header
        above={
          program
            ? `${program.name} · week ${programWeek(program)} of ${program.weeks}`
            : 'No active program'
        }
        title="Gym"
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
    </Screen>
  );
}
