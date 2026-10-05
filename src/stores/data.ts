/**
 * The signed-in user's own data, persisted on the device. Screens read from here, so everything
 * works offline. Every write also goes to the sync queue.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { toLocalDate } from '@/lib/dates';
import { scheduleFlush } from '@/lib/sync';
import { safeStorage } from '@/lib/storage';
import type {
  BodyMeasurement,
  BodyweightLog,
  Exercise,
  MeasurementKey,
  Profile,
  ProfilePrivate,
  Program,
  Session,
  SetEntry,
} from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { useQueue, type QueueItem } from './queue';

type Enq = Omit<QueueItem, 'key'>;

export interface Snapshot {
  userId: string;
  profile: Profile | null;
  priv: ProfilePrivate | null;
  exercises: Record<string, Exercise>;
  programs: Record<string, Program>;
  sessions: Record<string, Session>;
  bodyweights: Record<string, BodyweightLog>;
  measurements: Record<string, BodyMeasurement>;
}

interface DataState extends Snapshot {
  hydrated: boolean;
  reset: () => void;
  load: (s: Snapshot) => void;
  saveProfile: (p: Profile) => void;
  savePrivate: (p: ProfilePrivate) => void;
  saveExercise: (e: Exercise) => void;
  saveProgram: (p: Program) => void;
  deleteProgram: (id: string) => void;
  setActiveProgram: (id: string) => void;
  putSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  logBodyweight: (kg: number, date?: Date) => void;
  logMeasurements: (values: Partial<Record<MeasurementKey, number>>, date?: Date) => void;
}

const empty: Snapshot = {
  userId: '',
  profile: null,
  priv: null,
  exercises: {},
  programs: {},
  sessions: {},
  bodyweights: {},
  measurements: {},
};

function enqueue(items: Enq[]) {
  if (items.length === 0) return;
  useQueue.getState().enqueue(items);
  scheduleFlush();
}

export function programRows(p: Program): Enq[] {
  const { days, ...program } = p;
  const out: Enq[] = [{ table: 'programs', op: 'upsert', id: p.id, row: program }];
  for (const d of days) {
    const { exercises, ...day } = d;
    out.push({ table: 'program_days', op: 'upsert', id: d.id, row: { ...day, program_id: p.id } });
    for (const e of exercises) {
      out.push({
        table: 'program_exercises',
        op: 'upsert',
        id: e.id,
        row: { ...e, program_day_id: d.id },
      });
    }
  }
  return out;
}

function sessionRow(s: Session): Record<string, unknown> {
  const { sets: _sets, ...row } = s;
  return row;
}

function setChanged(a: SetEntry | undefined, b: SetEntry): boolean {
  return (
    !a ||
    a.weight_kg !== b.weight_kg ||
    a.reps !== b.reps ||
    a.done !== b.done ||
    a.is_pr !== b.is_pr ||
    a.set_number !== b.set_number ||
    a.exercise_position !== b.exercise_position ||
    a.exercise_id !== b.exercise_id ||
    (a.superset_id ?? null) !== (b.superset_id ?? null)
  );
}

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...empty,
      hydrated: false,

      reset: () => set({ ...empty }),
      load: (s) => set({ ...s }),

      saveProfile: (p) => {
        set({ profile: p });
        enqueue([{ table: 'profiles', op: 'upsert', id: p.id, row: { ...p } }]);
      },

      savePrivate: (p) => {
        set({ priv: p });
        enqueue([{ table: 'profile_private', op: 'upsert', id: p.user_id, row: { ...p } }]);
      },

      saveExercise: (e) => {
        set((s) => ({ exercises: { ...s.exercises, [e.id]: e } }));
        enqueue([{ table: 'exercises', op: 'upsert', id: e.id, row: { ...e } }]);
      },

      saveProgram: (p) => {
        const prev = get().programs[p.id];
        const next = { ...p, updated_at: nowIso() };
        const ops: Enq[] = [];
        if (prev) {
          const keepDays = new Set(next.days.map((d) => d.id));
          const keepEx = new Set(next.days.flatMap((d) => d.exercises.map((e) => e.id)));
          for (const d of prev.days) {
            if (!keepDays.has(d.id)) ops.push({ table: 'program_days', op: 'delete', id: d.id });
            else
              for (const e of d.exercises)
                if (!keepEx.has(e.id))
                  ops.push({ table: 'program_exercises', op: 'delete', id: e.id });
          }
        }
        set((s) => ({ programs: { ...s.programs, [p.id]: next } }));
        enqueue([...programRows(next), ...ops]);
      },

      deleteProgram: (id) => {
        set((s) => {
          const programs = { ...s.programs };
          delete programs[id];
          return { programs };
        });
        enqueue([{ table: 'programs', op: 'delete', id }]);
      },

      setActiveProgram: (id) => {
        const programs = { ...get().programs };
        const ops: Enq[] = [];
        const now = nowIso();
        // Deactivate first so the "one active program" index never conflicts.
        for (const p of Object.values(programs)) {
          if (p.is_active && p.id !== id) {
            programs[p.id] = { ...p, is_active: false, updated_at: now };
            const { days: _d, ...row } = programs[p.id];
            ops.push({ table: 'programs', op: 'upsert', id: p.id, row });
          }
        }
        const target = programs[id];
        if (target) {
          programs[id] = {
            ...target,
            is_active: true,
            started_on: toLocalDate(new Date()),
            updated_at: now,
          };
          const { days: _d, ...row } = programs[id];
          ops.push({ table: 'programs', op: 'upsert', id, row });
        }
        set({ programs });
        enqueue(ops);
      },

      putSession: (next) => {
        const prev = get().sessions[next.id];
        const now = nowIso();
        const prevSets = new Map((prev?.sets ?? []).map((x) => [x.id, x]));
        const ops: Enq[] = [];
        const sets = next.sets.map((x) => {
          if (!setChanged(prevSets.get(x.id), x)) return x;
          const changed = { ...x, updated_at: now };
          ops.push({ table: 'set_entries', op: 'upsert', id: x.id, row: { ...changed } });
          return changed;
        });
        const nextIds = new Set(sets.map((x) => x.id));
        for (const id of prevSets.keys())
          if (!nextIds.has(id)) ops.push({ table: 'set_entries', op: 'delete', id });
        const s: Session = { ...next, sets, updated_at: now };
        // The session row goes first so its sets never reference a missing session.
        ops.unshift({ table: 'workout_sessions', op: 'upsert', id: s.id, row: sessionRow(s) });
        set((st) => ({ sessions: { ...st.sessions, [s.id]: s } }));
        enqueue(ops);
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = { ...s.sessions };
          delete sessions[id];
          return { sessions };
        });
        enqueue([{ table: 'workout_sessions', op: 'delete', id }]);
      },

      logBodyweight: (kg, date = new Date()) => {
        const { userId, bodyweights } = get();
        const day = toLocalDate(date);
        const existing = Object.values(bodyweights).find((b) => b.logged_on === day);
        const row: BodyweightLog = {
          id: existing?.id ?? uuid(),
          user_id: userId,
          logged_on: day,
          weight_kg: kg,
        };
        set((s) => ({ bodyweights: { ...s.bodyweights, [row.id]: row } }));
        enqueue([{ table: 'bodyweight_logs', op: 'upsert', id: row.id, row: { ...row } }]);
      },

      logMeasurements: (values, date = new Date()) => {
        const { userId, measurements } = get();
        const day = toLocalDate(date);
        const existing = Object.values(measurements).find((m) => m.logged_on === day);
        const row: BodyMeasurement = {
          id: existing?.id ?? uuid(),
          user_id: userId,
          logged_on: day,
          chest_cm: null,
          shoulders_cm: null,
          biceps_l_cm: null,
          biceps_r_cm: null,
          forearms_cm: null,
          waist_cm: null,
          thighs_cm: null,
          calves_cm: null,
          ...existing,
          ...values,
        };
        set((s) => ({ measurements: { ...s.measurements, [row.id]: row } }));
        enqueue([{ table: 'body_measurements', op: 'upsert', id: row.id, row: { ...row } }]);
      },
    }),
    {
      name: 'colosseum-data',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): Snapshot => ({
        userId: s.userId,
        profile: s.profile,
        priv: s.priv,
        exercises: s.exercises,
        programs: s.programs,
        sessions: s.sessions,
        bodyweights: s.bodyweights,
        measurements: s.measurements,
      }),
      onRehydrateStorage: () => () => {
        useData.setState({ hydrated: true });
      },
    },
  ),
);
