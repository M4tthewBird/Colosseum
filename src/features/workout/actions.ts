/** Active workout operations. All writes go to the local store (and from there to the queue). */
import { router } from 'expo-router';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { bestsByExercise, markPRs, prCount, prKinds, prLabel, volume } from '@/lib/formulas';
import { phaseFor, phasedSets } from '@/lib/periodization';
import { programWeek } from '@/lib/programs';
import { primaryGoal, recommend } from '@/lib/repRanges';
import { historyBests, lastTimeSets } from '@/lib/stats';
import type { ProgramDay, Session, SetEntry } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { useWorkout, type PlannedExercise } from '@/stores/workout';

export const DEFAULT_REST = 120;

function session(): Session | null {
  const id = useWorkout.getState().sessionId;
  return id ? (useData.getState().sessions[id] ?? null) : null;
}

/** Sets for one exercise, prefilled with last time's values (or the plan). */
function initialSets(sessionId: string, plan: PlannedExercise): SetEntry[] {
  const sessions = Object.values(useData.getState().sessions);
  const last = lastTimeSets(sessions, plan.exercise_id, sessionId);
  return Array.from({ length: Math.max(1, plan.sets) }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    return {
      id: uuid(),
      session_id: sessionId,
      exercise_id: plan.exercise_id,
      exercise_position: plan.position,
      set_number: i + 1,
      weight_kg: prev?.weight_kg ?? 0,
      reps: prev?.reps ?? plan.reps_max,
      done: false,
      is_pr: false,
      updated_at: nowIso(),
    };
  });
}

export function startWorkout(day: ProgramDay | null): string {
  const { userId, programs } = useData.getState();
  const id = uuid();
  // The program's phase for this week scales the sets and sets the target effort.
  const program = day
    ? Object.values(programs).find((p) => p.days.some((d) => d.id === day.id))
    : undefined;
  const phase = program ? phaseFor(program.phases, programWeek(program)) : null;
  const plan: PlannedExercise[] = (day?.exercises ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((e, i) => ({
      exercise_id: e.exercise_id,
      position: i,
      sets: phasedSets(e.sets, phase),
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      rest_seconds: e.rest_seconds,
      rpe: phase?.rpe,
    }));
  const s: Session = {
    id,
    user_id: userId,
    program_day_id: day?.id ?? null,
    name: day?.name ?? 'Workout',
    started_at: nowIso(),
    finished_at: null,
    volume_kg: 0,
    set_count: 0,
    pr_count: 0,
    updated_at: nowIso(),
    sets: plan.flatMap((p) => initialSets(id, p)),
  };
  useData.getState().putSession(s);
  useWorkout.getState().start(id, plan);
  return id;
}

/** Opens the active workout, or starts one. Asks before replacing a running workout. */
export async function openWorkout(day: ProgramDay | null, confirmReplace: () => Promise<boolean>) {
  const active = session();
  if (active && !active.finished_at) {
    const replace = await confirmReplace();
    if (!replace) {
      resumeWorkout();
      return;
    }
    discardWorkout();
  }
  const id = startWorkout(day);
  router.push({ pathname: '/workout/[id]', params: { id } });
}

export function resumeWorkout() {
  const id = useWorkout.getState().sessionId;
  if (!id) return;
  useWorkout.getState().setMinimized(false);
  router.push({ pathname: '/workout/[id]', params: { id } });
}

function put(next: Session) {
  // Recompute PR flags for the whole session in order.
  const all = Object.values(useData.getState().sessions);
  const bests = historyBests(all, next.id);
  const ordered = [...next.sets].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number,
  );
  const flags = markPRs(ordered, bests);
  const prIds = new Set(ordered.filter((_, i) => flags[i]).map((s) => s.id));
  const sets = ordered.map((s) =>
    s.is_pr === prIds.has(s.id) ? s : { ...s, is_pr: prIds.has(s.id) },
  );
  useData.getState().putSession({ ...next, sets });
  return sets;
}

export function updateSet(setId: string, patch: Partial<Pick<SetEntry, 'weight_kg' | 'reps'>>) {
  const s = session();
  if (!s) return;
  put({ ...s, sets: s.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) });
}

export function toggleSet(setId: string) {
  const s = session();
  if (!s) return;
  const target = s.sets.find((x) => x.id === setId);
  if (!target) return;
  const done = !target.done;
  if (done && target.reps <= 0) {
    toast('Enter reps first');
    return;
  }
  const sets = put({ ...s, sets: s.sets.map((x) => (x.id === setId ? { ...x, done } : x)) });
  if (!done) return;
  feedback(false);
  const plan = useWorkout.getState().plan.find((p) => p.position === target.exercise_position);
  useWorkout.getState().startRest(plan?.rest_seconds ?? DEFAULT_REST);
  const after = sets.find((x) => x.id === setId);
  if (after?.is_pr) {
    feedback(true);
    toast(prLabel(after.weight_kg, after.reps, setPrKinds(s.id, sets, after)), true);
  }
}

/** Kind of PR for one set: against history plus the earlier done sets of this workout. */
export function setPrKinds(sessionId: string, sets: SetEntry[], set: SetEntry) {
  const history = historyBests(Object.values(useData.getState().sessions), sessionId);
  const earlier = sets.filter(
    (x) =>
      x.done &&
      x.exercise_id === set.exercise_id &&
      x.id !== set.id &&
      (x.exercise_position < set.exercise_position ||
        (x.exercise_position === set.exercise_position && x.set_number < set.set_number)),
  );
  const before = bestsByExercise(earlier)[set.exercise_id];
  const h = history[set.exercise_id];
  const best =
    h && before
      ? { weight: Math.max(h.weight, before.weight), e1rm: Math.max(h.e1rm, before.e1rm) }
      : (h ?? undefined);
  return prKinds(set.weight_kg, set.reps, best);
}

/** Note for one exercise in the active workout; empty text removes it. */
export function setNote(position: number, text: string) {
  const s = session();
  if (!s) return;
  const notes = { ...(s.notes ?? {}) };
  if (text.trim()) notes[String(position)] = text;
  else delete notes[String(position)];
  useData.getState().putSession({ ...s, notes });
}

export function addSet(position: number) {
  const s = session();
  if (!s) return;
  const sets = s.sets.filter((x) => x.exercise_position === position);
  const last = sets[sets.length - 1];
  if (!last) return;
  put({
    ...s,
    sets: [
      ...s.sets,
      {
        ...last,
        id: uuid(),
        set_number: last.set_number + 1,
        done: false,
        is_pr: false,
        updated_at: nowIso(),
      },
    ],
  });
}

export function removeSet(position: number) {
  const s = session();
  if (!s) return;
  const sets = s.sets.filter((x) => x.exercise_position === position);
  if (sets.length <= 1) return;
  const last = sets[sets.length - 1];
  put({ ...s, sets: s.sets.filter((x) => x.id !== last.id) });
}

export function addExercise(exerciseId: string) {
  const s = session();
  if (!s) return;
  const w = useWorkout.getState();
  const position = w.plan.length ? Math.max(...w.plan.map((p) => p.position)) + 1 : 0;
  const { profile, exercises } = useData.getState();
  const plan: PlannedExercise = {
    exercise_id: exerciseId,
    position,
    ...recommend(primaryGoal(profile?.goals ?? []), exercises[exerciseId]?.name ?? ''),
  };
  w.setPlan([...w.plan, plan]);
  put({ ...s, sets: [...s.sets, ...initialSets(s.id, plan)] });
  w.setCurrent(w.plan.length);
}

export function removeExercise(position: number) {
  const s = session();
  if (!s) return;
  const w = useWorkout.getState();
  w.setPlan(w.plan.filter((p) => p.position !== position));
  put({ ...s, sets: s.sets.filter((x) => x.exercise_position !== position) });
  w.setCurrent(Math.max(0, Math.min(w.current, w.plan.length - 2)));
}

export interface Summary {
  sessionId: string;
  durationMs: number;
  volumeKg: number;
  sets: number;
  prs: number;
}

/** Marks the session finished. Sets that were not done are dropped. */
export function finishWorkout(): Summary | null {
  const s = session();
  if (!s) return null;
  const done = s.sets.filter((x) => x.done);
  const finishedAt = nowIso();
  const next: Session = {
    ...s,
    finished_at: finishedAt,
    sets: done,
    volume_kg: volume(done),
    set_count: done.length,
    pr_count: prCount(done),
  };
  put(next);
  const final = useData.getState().sessions[s.id];
  const summary = {
    sessionId: s.id,
    durationMs: new Date(finishedAt).getTime() - new Date(s.started_at).getTime(),
    volumeKg: final.volume_kg,
    sets: final.set_count,
    prs: prCount(final.sets),
  };
  if (summary.prs !== final.pr_count)
    useData.getState().putSession({ ...final, pr_count: summary.prs });
  useWorkout.getState().end();
  return summary;
}

/**
 * Saves a finished workout as a one-off "saved workout": same exercises in the same order,
 * as many sets as were done, and the rep range that was done.
 */
export function saveSessionAsWorkout(sessionId: string, name: string): string | null {
  const { sessions, userId, saveProgram } = useData.getState();
  const s = sessions[sessionId];
  if (!s) return null;
  const byPos = new Map<number, SetEntry[]>();
  for (const x of s.sets.filter((x) => x.done))
    byPos.set(x.exercise_position, [...(byPos.get(x.exercise_position) ?? []), x]);
  const now = nowIso();
  const id = uuid();
  saveProgram({
    id,
    owner_id: userId,
    name: name.trim() || s.name,
    weeks: 1,
    training_days: [],
    phases: [],
    kind: 'workout',
    is_active: false,
    started_on: null,
    created_at: now,
    updated_at: now,
    days: [
      {
        id: uuid(),
        position: 0,
        name: name.trim() || s.name,
        weekdays: [],
        exercises: [...byPos.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, sets], i) => {
            const reps = sets.map((x) => x.reps);
            return {
              id: uuid(),
              exercise_id: sets[0].exercise_id,
              position: i,
              sets: sets.length,
              reps_min: Math.min(...reps),
              reps_max: Math.max(...reps),
              rest_seconds: DEFAULT_REST,
            };
          }),
      },
    ],
  });
  return id;
}

export function discardWorkout() {
  const s = session();
  if (s) useData.getState().deleteSession(s.id);
  useWorkout.getState().end();
}

export function feedback(strong: boolean) {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
      navigator.vibrate?.(strong ? [30, 40, 30] : 20);
    return;
  }
  const p = strong
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void p.catch(() => Vibration.vibrate(strong ? 200 : 60));
}

/** Rest finished: vibrate / buzz. */
export function restAlert() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
      navigator.vibrate?.([200, 100, 200]);
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() =>
    Vibration.vibrate(400),
  );
}
