/** Active workout operations. All writes go to the local store (and from there to the queue). */
import { router } from 'expo-router';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { chainIds, dropChain, dropWeight, isMain } from '@/lib/dropsets';
import {
  bestsByExercise,
  isSideSet,
  markPRs,
  prCount,
  prKinds,
  prLabel,
  sideReps,
  volume,
} from '@/lib/formulas';
import { phaseFor, phasedSets } from '@/lib/periodization';
import { programWeek } from '@/lib/programs';
import { primaryGoal, recommend } from '@/lib/repRanges';
import { historyBests, lastTimeSets } from '@/lib/stats';
import { groupIndexOf, groupPlan, roundComplete } from '@/lib/supersets';
import type { Feel, ProgramDay, Session, SetEntry } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { isWarmup, isWork, WARMUP_REST, warmupPlan } from '@/lib/warmups';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { useWorkout, type PlannedExercise } from '@/stores/workout';

export const DEFAULT_REST = 120;

function session(): Session | null {
  const id = useWorkout.getState().sessionId;
  return id ? (useData.getState().sessions[id] ?? null) : null;
}

/** Reps fields of a new set: per side when the exercise is logged per side. */
function repsFields(prev: SetEntry | undefined, fallback: number, eachSide: boolean) {
  if (!eachSide) return { reps: prev?.reps ?? fallback, left_reps: null, right_reps: null };
  return sideReps(
    prev?.left_reps ?? prev?.reps ?? fallback,
    prev?.right_reps ?? prev?.reps ?? fallback,
  );
}

const eachSideOf = (exerciseId: string) =>
  !!useData.getState().exercisePrefs[exerciseId]?.each_side;

/** Sets for one exercise, prefilled with last time's values (or the plan). */
function initialSets(sessionId: string, plan: PlannedExercise): SetEntry[] {
  const sessions = Object.values(useData.getState().sessions);
  const last = lastTimeSets(sessions, plan.exercise_id, sessionId);
  const eachSide = eachSideOf(plan.exercise_id);
  return Array.from({ length: Math.max(1, plan.sets) }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    return {
      id: uuid(),
      session_id: sessionId,
      exercise_id: plan.exercise_id,
      exercise_position: plan.position,
      set_number: i + 1,
      weight_kg: prev?.weight_kg ?? 0,
      ...repsFields(prev, plan.reps_max, eachSide),
      done: false,
      is_pr: false,
      superset_id: plan.superset ?? null,
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
      superset: e.superset_id ?? undefined,
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

/** Reps of one side of a per-side set; the set's reps follow the weaker side. */
export function updateSide(setId: string, side: 'left' | 'right', reps: number) {
  const s = session();
  if (!s) return;
  put({
    ...s,
    sets: s.sets.map((x) =>
      x.id === setId
        ? {
            ...x,
            ...sideReps(
              side === 'left' ? reps : (x.left_reps ?? x.reps),
              side === 'right' ? reps : (x.right_reps ?? x.reps),
            ),
          }
        : x,
    ),
  });
}

/**
 * Turns logging per side on or off for an exercise (saved for next time too). Sets of it in the
 * active workout that are not done yet switch over; done sets keep what was logged.
 */
export function setEachSide(exerciseId: string, on: boolean) {
  useData.getState().setEachSide(exerciseId, on);
  const s = session();
  if (!s) return;
  put({
    ...s,
    sets: s.sets.map((x) => {
      if (x.exercise_id !== exerciseId || x.done || isSideSet(x) === on) return x;
      return on
        ? { ...x, ...sideReps(x.reps, x.reps) }
        : {
            ...x,
            reps: Math.max(x.left_reps ?? 0, x.right_reps ?? 0),
            left_reps: null,
            right_reps: null,
          };
    }),
  });
}

export function toggleSet(setId: string) {
  const s = session();
  if (!s) return;
  const target = s.sets.find((x) => x.id === setId);
  if (!target) return;
  const done = !target.done;
  if (done && target.reps <= 0) {
    toast(isSideSet(target) ? 'Enter reps for both sides first' : 'Enter reps first');
    return;
  }
  const sets = put({ ...s, sets: s.sets.map((x) => (x.id === setId ? { ...x, done } : x)) });
  if (!done) return;
  feedback(false);
  const w = useWorkout.getState();
  if (target.warmup) {
    w.startRest(WARMUP_REST);
    return;
  }
  // A drop set follows right away: the rest starts after the last drop.
  const main = mainOf(sets, target);
  if (dropChain(sets, main.id).some((x) => !x.done) || (!isMain(target) && !main.done)) {
    w.stopRest();
    return;
  }
  // In a superset the rest starts only once every exercise of the round is done.
  const group =
    groupPlan(w.plan).find((g) => g.some((p) => p.position === target.exercise_position)) ?? [];
  const positions = group.map((p) => p.position);
  if (group.length <= 1 || roundComplete(sets, positions, target.set_number)) {
    w.startRest(Math.max(0, ...group.map((p) => p.rest_seconds)) || DEFAULT_REST);
  } else {
    w.stopRest();
  }
  const after = sets.find((x) => x.id === setId);
  if (after?.is_pr) {
    feedback(true);
    toast(prLabel(after.weight_kg, after.reps, setPrKinds(s.id, sets, after)), true);
  }
}

/** The main set of a set's drop chain (the set itself when it is a main set). */
function mainOf(sets: SetEntry[], set: SetEntry): SetEntry {
  let cur = set;
  for (let i = 0; cur.drop_of && i < 20; i++) {
    const parent = sets.find((x) => x.id === cur.drop_of);
    if (!parent) break;
    cur = parent;
  }
  return cur;
}

/** Adds a drop set after a set's chain: about 20 % lighter, same reps to aim for. */
export function addDropSet(setId: string) {
  const s = session();
  if (!s) return;
  const target = s.sets.find((x) => x.id === setId);
  if (!target) return;
  const main = mainOf(s.sets, target);
  const chain = dropChain(s.sets, main.id);
  const after = chain[chain.length - 1] ?? main;
  put({
    ...s,
    sets: [
      ...s.sets,
      {
        ...after,
        id: uuid(),
        set_number: main.set_number,
        weight_kg: dropWeight(after.weight_kg),
        done: false,
        is_pr: false,
        failure: false,
        drop_of: after.id,
        updated_at: nowIso(),
      },
    ],
  });
}

/** Removes a drop set and the drops after it. */
export function removeDropSet(setId: string) {
  const s = session();
  if (!s) return;
  const remove = new Set(chainIds(s.sets, setId));
  put({ ...s, sets: s.sets.filter((x) => !remove.has(x.id)) });
}

export function toggleFailure(setId: string) {
  const s = session();
  if (!s) return;
  put({ ...s, sets: s.sets.map((x) => (x.id === setId ? { ...x, failure: !x.failure } : x)) });
}

/** Sets the weight of every working set of an exercise that is not done yet. */
export function applyWeight(position: number, weightKg: number) {
  const s = session();
  if (!s) return;
  put({
    ...s,
    sets: s.sets.map((x) =>
      x.exercise_position === position && isMain(x) && isWork(x) && !x.done
        ? { ...x, weight_kg: weightKg }
        : x,
    ),
  });
}

/**
 * The set the buttons under the set table act on: the last done working set, or (before any
 * is done) the first one still to do. `sets` is in table order.
 */
export function currentSet(sets: SetEntry[]): SetEntry | null {
  const work = sets.filter((x) => isMain(x) && isWork(x));
  return [...work].reverse().find((x) => x.done) ?? work.find((x) => !x.done) ?? null;
}

/**
 * Adds warm-up sets before the working sets of an exercise: the suggested ramp to the first
 * working weight, or one more light set in front when there are warm-ups already.
 */
export function addWarmups(position: number) {
  const s = session();
  if (!s) return;
  const mine = s.sets.filter((x) => x.exercise_position === position && isMain(x));
  const work = mine.filter(isWork).sort((a, b) => a.set_number - b.set_number);
  const warm = mine.filter(isWarmup).sort((a, b) => a.set_number - b.set_number);
  const first = work[0];
  if (!first) return;
  const eachSide = isSideSet(first);
  const make = (weight_kg: number, reps: number, set_number: number): SetEntry => ({
    ...first,
    id: uuid(),
    set_number,
    weight_kg,
    ...(eachSide ? sideReps(reps, reps) : { reps, left_reps: null, right_reps: null }),
    done: false,
    is_pr: false,
    failure: false,
    drop_of: null,
    warmup: true,
    updated_at: nowIso(),
  });
  let added: SetEntry[];
  if (warm.length) {
    // One more, lighter, in front of the others.
    const lightest = warm[0];
    added = [
      make(
        Math.max(0, Math.floor((lightest.weight_kg * 0.7) / 2.5) * 2.5),
        10,
        lightest.set_number - 1,
      ),
    ];
  } else {
    const plan = warmupPlan(first.weight_kg);
    if (!plan.length) {
      toast(first.weight_kg > 0 ? 'Too light to need a warm-up' : 'Enter the working weight first');
      return;
    }
    // Numbered … -1, 0 so they sort before set 1.
    added = plan.map((p, i) => make(p.weight_kg, p.reps, i - plan.length + 1));
  }
  put({ ...s, sets: [...s.sets, ...added] });
}

/** Removes one warm-up set. */
export function removeWarmup(setId: string) {
  const s = session();
  if (!s) return;
  put({ ...s, sets: s.sets.filter((x) => x.id !== setId || !x.warmup) });
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

/** Working sets of one exercise in order (no drop sets, no warm-ups). */
function mainSets(s: Session, position: number): SetEntry[] {
  return s.sets
    .filter((x) => x.exercise_position === position && isMain(x) && isWork(x))
    .sort((a, b) => a.set_number - b.set_number);
}

export function addSet(position: number) {
  const s = session();
  if (!s) return;
  const sets = mainSets(s, position);
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
        failure: false,
        updated_at: nowIso(),
      },
    ],
  });
}

/** Removes the last set of an exercise with its drop sets. */
export function removeSet(position: number) {
  const s = session();
  if (!s) return;
  const sets = mainSets(s, position);
  if (sets.length <= 1) return;
  const remove = new Set(chainIds(s.sets, sets[sets.length - 1].id));
  put({ ...s, sets: s.sets.filter((x) => !remove.has(x.id)) });
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
  const page = groupPlan(w.plan).length; // the new exercise gets its own page at the end
  w.setPlan([...w.plan, plan]);
  put({ ...s, sets: [...s.sets, ...initialSets(s.id, plan)] });
  w.setCurrent(page);
}

/** Renumbers positions >= from by +1 in the plan, the sets and the notes. */
function shiftFrom(s: Session, plan: PlannedExercise[], from: number) {
  const bump = (n: number) => (n >= from ? n + 1 : n);
  const notes = Object.fromEntries(
    Object.entries(s.notes ?? {}).map(([k, v]) => [String(bump(Number(k))), v]),
  );
  return {
    plan: plan.map((p) => ({ ...p, position: bump(p.position) })),
    session: {
      ...s,
      notes,
      sets: s.sets.map((x) => ({ ...x, exercise_position: bump(x.exercise_position) })),
    },
  };
}

/**
 * Adds an exercise as a superset with the one at basePosition: it goes right after the
 * superset's last exercise, with as many sets as the first one, and shares its superset id.
 */
export function addSuperset(basePosition: number, exerciseId: string) {
  const current = session();
  if (!current) return;
  const w = useWorkout.getState();
  const base = w.plan.find((p) => p.position === basePosition);
  if (!base) return;
  const id = base.superset ?? uuid();
  const members = w.plan.filter(
    (p) => p.position === basePosition || (base.superset && p.superset === base.superset),
  );
  const at = Math.max(...members.map((p) => p.position)) + 1;
  const shifted = shiftFrom(current, w.plan, at);
  const { profile, exercises } = useData.getState();
  const rec = recommend(primaryGoal(profile?.goals ?? []), exercises[exerciseId]?.name ?? '');
  const added: PlannedExercise = {
    exercise_id: exerciseId,
    position: at,
    sets: base.sets,
    reps_min: rec.reps_min,
    reps_max: rec.reps_max,
    rest_seconds: base.rest_seconds,
    rpe: base.rpe,
    superset: id,
  };
  const plan = [
    ...shifted.plan.map((p) => (p.position === basePosition ? { ...p, superset: id } : p)),
    added,
  ];
  const sets = [
    ...shifted.session.sets.map((x) =>
      x.exercise_position === basePosition ? { ...x, superset_id: id } : x,
    ),
    ...initialSets(current.id, added),
  ];
  w.setPlan(plan);
  put({ ...shifted.session, sets });
  w.setCurrent(groupIndexOf(groupPlan(plan), at));
}

/** Splits a superset back into separate exercises. */
export function unlinkSuperset(id: string) {
  const s = session();
  if (!s) return;
  const w = useWorkout.getState();
  w.setPlan(w.plan.map((p) => (p.superset === id ? { ...p, superset: undefined } : p)));
  put({ ...s, sets: s.sets.map((x) => (x.superset_id === id ? { ...x, superset_id: null } : x)) });
}

/** Adds one set to every exercise of a superset (a new round). */
export function addRound(positions: number[]) {
  for (const p of positions) addSet(p);
}

/** Removes the last set of every exercise of a superset. */
export function removeRound(positions: number[]) {
  for (const p of positions) removeSet(p);
}

export function removeExercise(position: number) {
  const s = session();
  if (!s) return;
  const w = useWorkout.getState();
  const removed = w.plan.find((p) => p.position === position);
  let plan = w.plan.filter((p) => p.position !== position);
  let sets = s.sets.filter((x) => x.exercise_position !== position);
  // A superset left with one exercise is just an exercise again.
  const id = removed?.superset;
  if (id && plan.filter((p) => p.superset === id).length === 1) {
    plan = plan.map((p) => (p.superset === id ? { ...p, superset: undefined } : p));
    sets = sets.map((x) => (x.superset_id === id ? { ...x, superset_id: null } : x));
  }
  w.setPlan(plan);
  put({ ...s, sets });
  w.setCurrent(Math.max(0, Math.min(w.current, groupPlan(plan).length - 1)));
}

export interface Summary {
  sessionId: string;
  durationMs: number;
  volumeKg: number;
  sets: number;
  prs: number;
}

/** Marks the session finished. Sets that were not done are dropped (with their drop sets). */
export function finishWorkout(): Summary | null {
  const s = session();
  if (!s) return null;
  const done = s.sets.filter((x) => x.done && isMain(x));
  for (const m of [...done]) {
    for (const d of dropChain(s.sets, m.id)) {
      if (!d.done) break;
      done.push(d);
    }
  }
  const finishedAt = nowIso();
  const next: Session = {
    ...s,
    finished_at: finishedAt,
    sets: done,
    volume_kg: volume(done),
    set_count: done.filter(isWork).length,
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
  for (const x of s.sets.filter((x) => x.done && isMain(x) && isWork(x)))
    byPos.set(x.exercise_position, [...(byPos.get(x.exercise_position) ?? []), x]);
  const now = nowIso();
  const id = uuid();
  const groupIds = new Map<string, string>();
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
            const group = sets[0].superset_id;
            return {
              id: uuid(),
              exercise_id: sets[0].exercise_id,
              position: i,
              sets: sets.length,
              reps_min: Math.min(...reps),
              reps_max: Math.max(...reps),
              rest_seconds: DEFAULT_REST,
              // New ids, same grouping.
              superset_id: group
                ? (groupIds.get(group) ?? groupIds.set(group, uuid()).get(group))
                : null,
            };
          }),
      },
    ],
  });
  return id;
}

/** How a finished workout felt: effort 1–10 and feel ratings. */
export function rateWorkout(sessionId: string, patch: { rpe?: number | null; feel?: Feel | null }) {
  const s = useData.getState().sessions[sessionId];
  if (!s) return;
  useData.getState().putSession({ ...s, ...patch });
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
