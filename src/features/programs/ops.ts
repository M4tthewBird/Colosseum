import type { Program, ProgramDay } from '@/lib/types';
import { defaultPhases } from '@/lib/periodization';
import { nowIso, uuid } from '@/lib/uuid';

export function blankDay(position: number): ProgramDay {
  return {
    id: uuid(),
    position,
    name: `Day ${String.fromCharCode(65 + (position % 26))}`,
    weekdays: [],
    exercises: [],
  };
}

export function blankProgram(ownerId: string): Program {
  return {
    id: uuid(),
    owner_id: ownerId,
    name: '',
    weeks: 8,
    training_days: [],
    phases: defaultPhases(8),
    is_active: false,
    started_on: null,
    updated_at: nowIso(),
    created_at: nowIso(),
    days: [blankDay(0)],
  };
}

export function duplicateProgram(p: Program): Program {
  return {
    ...p,
    id: uuid(),
    name: `${p.name} (copy)`,
    is_active: false,
    started_on: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    days: p.days.map((d) => ({
      ...d,
      id: uuid(),
      exercises: d.exercises.map((e) => ({ ...e, id: uuid() })),
    })),
  };
}

/** Renumbers positions and trims names before saving. */
export function normalizeProgram(p: Program): Program {
  return {
    ...p,
    name: p.name.trim(),
    training_days: [...new Set(p.training_days)].sort((a, b) => a - b),
    days: p.days.map((d, i) => ({
      ...d,
      position: i,
      name: d.name.trim() || blankDay(i).name,
      weekdays: [...new Set(d.weekdays)].sort((a, b) => a - b),
      exercises: d.exercises.map((e, j) => ({ ...e, position: j })),
    })),
  };
}
