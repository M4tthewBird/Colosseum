/**
 * Loads the signed-in user's own data from Supabase into the local store. Rows with writes still
 * waiting in the queue keep their local version (last write wins; only the owner writes).
 */
import { isDemo, supabase } from '@/lib/supabase';
import type {
  BodyMeasurement,
  BodyweightLog,
  Exercise,
  Profile,
  ProfilePrivate,
  Program,
  ProgramDay,
  ProgramExercise,
  Session,
  SetEntry,
} from '@/lib/types';
import { useData } from '@/stores/data';
import { useQueue } from '@/stores/queue';

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

/** Server rows, but pending local rows win and pending deletes stay deleted. */
function merge<T extends { id: string }>(
  server: T[],
  local: Record<string, T>,
  table: string,
  pendingKeys: Set<string>,
  pendingDeletes: Set<string>,
): Record<string, T> {
  const out = byId(server.filter((r) => !pendingDeletes.has(`${table}:${r.id}`)));
  for (const [id, row] of Object.entries(local)) {
    if (pendingKeys.has(`${table}:${id}`)) out[id] = row;
  }
  return out;
}

/** Every row of a query, 1000 at a time (PostgREST caps a response at 1000 rows). */
async function paged<T>(
  make: () => {
    range: (
      a: number,
      b: number,
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  },
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function all<T>(
  q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Built-in and own exercises. Falls back to no tier until the tier column exists. */
async function pullExercises(userId: string): Promise<Exercise[]> {
  const query = (cols: string) => () =>
    supabase
      .from('exercises')
      .select(cols)
      .or(`created_by.is.null,created_by.eq.${userId}`)
      .order('id');
  try {
    return await paged<Exercise>(query('id,name,muscles,image_key,created_by,tier') as never);
  } catch (e) {
    if (!/tier/.test(String(e))) throw e;
    return paged<Exercise>(query('id,name,muscles,image_key,created_by') as never);
  }
}

export async function pullAll(userId: string): Promise<void> {
  if (isDemo) return;
  const [
    profileRows,
    privRows,
    exercises,
    programs,
    days,
    pexs,
    sessions,
    sets,
    bodyweights,
    measurements,
  ] = await Promise.all([
    all<Profile>(supabase.from('profiles').select('*').eq('id', userId)),
    all<ProfilePrivate>(supabase.from('profile_private').select('*').eq('user_id', userId)),
    pullExercises(userId),
    all<Omit<Program, 'days'>>(supabase.from('programs').select('*').eq('owner_id', userId)),
    all<ProgramDay & { program_id: string }>(
      supabase
        .from('program_days')
        .select('*, programs!inner(owner_id)')
        .eq('programs.owner_id', userId),
    ),
    all<ProgramExercise & { program_day_id: string }>(
      supabase
        .from('program_exercises')
        .select('*, program_days!inner(programs!inner(owner_id))')
        .eq('program_days.programs.owner_id', userId),
    ),
    all<Omit<Session, 'sets'>>(supabase.from('workout_sessions').select('*').eq('user_id', userId)),
    all<SetEntry & { workout_sessions?: unknown }>(
      supabase
        .from('set_entries')
        .select('*, workout_sessions!inner(user_id)')
        .eq('workout_sessions.user_id', userId),
    ),
    all<BodyweightLog>(supabase.from('bodyweight_logs').select('*').eq('user_id', userId)),
    all<BodyMeasurement>(supabase.from('body_measurements').select('*').eq('user_id', userId)),
  ]);

  const items = useQueue.getState().items;
  const pendingKeys = new Set(items.map((i) => i.key));
  const pendingDeletes = new Set(items.filter((i) => i.op === 'delete').map((i) => i.key));
  const local = useData.getState();

  // Assemble nested programs.
  const exByDay = new Map<string, ProgramExercise[]>();
  for (const e of pexs) {
    const { program_day_id, ...rest } = e as ProgramExercise & {
      program_day_id: string;
      program_days?: unknown;
    };
    delete (rest as { program_days?: unknown }).program_days;
    const list = exByDay.get(program_day_id) ?? [];
    list.push(rest);
    exByDay.set(program_day_id, list);
  }
  const daysByProgram = new Map<string, ProgramDay[]>();
  for (const d of days) {
    const { program_id, ...rest } = d as ProgramDay & { program_id: string; programs?: unknown };
    delete (rest as { programs?: unknown }).programs;
    const list = daysByProgram.get(program_id) ?? [];
    list.push({
      ...rest,
      exercises: (exByDay.get(d.id) ?? []).sort((a, b) => a.position - b.position),
    });
    daysByProgram.set(program_id, list);
  }
  const serverPrograms: Program[] = programs.map((p) => ({
    ...p,
    training_days: p.training_days ?? [],
    phases: p.phases ?? [],
    days: (daysByProgram.get(p.id) ?? []).sort((a, b) => a.position - b.position),
  }));

  // Assemble sessions with their sets.
  const setsBySession = new Map<string, SetEntry[]>();
  for (const s of sets) {
    const { workout_sessions: _ws, ...row } = s;
    const list = setsBySession.get(row.session_id) ?? [];
    list.push({ ...row, weight_kg: Number(row.weight_kg) });
    setsBySession.set(row.session_id, list);
  }
  const serverSessions: Session[] = sessions.map((s) => ({
    ...s,
    volume_kg: Number(s.volume_kg ?? 0),
    sets: (setsBySession.get(s.id) ?? []).sort(
      (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
    ),
  }));

  const profilePending = pendingKeys.has(`profiles:${userId}`);
  const privPending = pendingKeys.has(`profile_private:${userId}`);

  useData.getState().load({
    userId,
    profile: profilePending ? local.profile : (profileRows[0] ?? null),
    priv: privPending ? local.priv : (privRows[0] ?? null),
    exercises: merge(exercises, local.exercises, 'exercises', pendingKeys, pendingDeletes),
    programs: mergePrograms(serverPrograms, local.programs, pendingKeys, pendingDeletes),
    sessions: mergeSessions(serverSessions, local.sessions, pendingKeys, pendingDeletes),
    bodyweights: merge(
      bodyweights.map((b) => ({ ...b, weight_kg: Number(b.weight_kg) })),
      local.bodyweights,
      'bodyweight_logs',
      pendingKeys,
      pendingDeletes,
    ),
    measurements: merge(
      measurements.map(numericMeasurement),
      local.measurements,
      'body_measurements',
      pendingKeys,
      pendingDeletes,
    ),
  });
}

function numericMeasurement(m: BodyMeasurement): BodyMeasurement {
  const out = { ...m } as Record<string, unknown>;
  for (const [k, v] of Object.entries(m)) if (k.endsWith('_cm') && v != null) out[k] = Number(v);
  return out as BodyMeasurement;
}

function mergePrograms(
  server: Program[],
  local: Record<string, Program>,
  pendingKeys: Set<string>,
  pendingDeletes: Set<string>,
): Record<string, Program> {
  const out = byId(server.filter((p) => !pendingDeletes.has(`programs:${p.id}`)));
  for (const [id, p] of Object.entries(local)) {
    const touched =
      pendingKeys.has(`programs:${id}`) ||
      p.days.some(
        (d) =>
          pendingKeys.has(`program_days:${d.id}`) ||
          d.exercises.some((e) => pendingKeys.has(`program_exercises:${e.id}`)),
      );
    if (touched && !pendingDeletes.has(`programs:${id}`)) out[id] = p;
  }
  return out;
}

function mergeSessions(
  server: Session[],
  local: Record<string, Session>,
  pendingKeys: Set<string>,
  pendingDeletes: Set<string>,
): Record<string, Session> {
  const out = byId(server.filter((s) => !pendingDeletes.has(`workout_sessions:${s.id}`)));
  for (const [id, s] of Object.entries(local)) {
    const touched =
      pendingKeys.has(`workout_sessions:${id}`) ||
      s.sets.some((x) => pendingKeys.has(`set_entries:${x.id}`));
    if (touched && !pendingDeletes.has(`workout_sessions:${id}`)) out[id] = s;
  }
  return out;
}
