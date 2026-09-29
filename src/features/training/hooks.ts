import { useMemo } from 'react';

import { upNextDay } from '@/lib/programs';
import { finished } from '@/lib/stats';
import type { Program, ProgramDay, Session } from '@/lib/types';
import { useData } from '@/stores/data';

export function useSessions(): Session[] {
  const map = useData((s) => s.sessions);
  return useMemo(() => Object.values(map), [map]);
}

export function useFinishedSessions(): Session[] {
  const all = useSessions();
  return useMemo(() => finished(all), [all]);
}

export function useActiveProgram(): Program | null {
  const programs = useData((s) => s.programs);
  return useMemo(() => Object.values(programs).find((p) => p.is_active) ?? null, [programs]);
}

export function useUpNext(): { program: Program | null; day: ProgramDay | null } {
  const program = useActiveProgram();
  const sessions = useFinishedSessions();
  return useMemo(() => {
    if (!program) return { program: null, day: null };
    return { program, day: upNextDay(program, sessions) };
  }, [program, sessions]);
}

export function exerciseName(id: string): string {
  return useData.getState().exercises[id]?.name ?? 'Exercise';
}
