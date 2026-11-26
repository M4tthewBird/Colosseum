/**
 * XP, laurels and denarii from the training history. Everything is earned by real training:
 * one pass over the finished workouts in order, with daily caps. Never anything for volume.
 * Pure — see engine.test.ts. Numbers in config.ts, rules in docs/GAME.md.
 */
import { addDays, startOfWeek, toLocalDate } from '../dates';
import { e1rm } from '../formulas';
import { asRun, isRun, runQualifies, runResults, runStrength, type RunLike } from '../running';
import type { Experience, Session } from '../types';
import {
  BASELINE_DAYS,
  DENARII,
  LAURELS,
  LEVEL_FACTOR,
  QUALIFYING_SETS,
  RUN,
  UNUSUAL_JUMP,
  UNUSUAL_MIN_SESSIONS,
  STYLE,
  XP,
} from './config';
import { carryOver, levelFromXp, nextSeason, seasonOf } from './levels';
import { styleDef, styleMatches, type StyleId } from './styles';
import type { Verification } from './visits';

export interface RewardPart {
  label: string;
  amount: number;
}

export interface SessionReward {
  sessionId: string;
  /** Local date "2026-11-13". */
  day: string;
  qualifies: boolean;
  verification: Verification;
  xp: number;
  /** Before the daily cap; xp is what was granted. */
  xpParts: RewardPart[];
  /** Cut by the daily cap. */
  xpCapped: number;
  laurels: number;
  laurelParts: RewardPart[];
  denarii: number;
  /** PRs that earned a reward. */
  prs: number;
  /** PRs too far above the old best to reward (anti-cheat). */
  unusualPrs: number;
  levelBefore: number;
  levelAfter: number;
  /** A run: counts in wars like a verified workout. */
  run: boolean;
}

export interface DayTotals {
  day: string;
  xp: number;
  laurels: number;
  denarii: number;
  workouts: number;
  prs: number;
}

export interface SeasonTotals {
  season: string;
  carry: number;
  /** From workouts. */
  earned: number;
  /** From duels, wars and Bellum (the server's laurel_awards). */
  awards: number;
  score: number;
}

export interface GameState {
  xp: number;
  level: number;
  denariiEarned: number;
  sessions: Record<string, SessionReward>;
  days: Record<string, DayTotals>;
  /** Oldest first, through the current month. */
  seasons: SeasonTotals[];
}

export interface GameInput {
  sessions: Session[];
  exerciseName: (id: string) => string | undefined;
  experience: Experience | null;
  weeklyTarget: number;
  /** From the user's own latest bodyweight and sex; null = no strength part. */
  dotsCoefficient: number | null;
  verification: (s: Session) => Verification;
  /** Workouts confirmed as done together. */
  together?: Set<string>;
  /** Of those, the ones done with a member of the user's ludus. */
  togetherLudus?: Set<string>;
  /** Extra denarii share for a workout (machines in the user's fortresses). */
  denariiBonus?: (s: Session, exerciseNames: string[]) => number;
  /** Laurels from duels, wars and Bellum, by season. */
  awards?: Record<string, number>;
  /**
   * Fighting styles chosen, oldest first: a workout trained the way of the style in force when it
   * started (`since` is an ISO time) earns a bonus. Kept as a history so a change never takes
   * back XP already earned.
   */
  styles?: { id: StyleId; since: string }[];
  /** Muscles of an exercise, for the style rules. */
  exerciseMuscles?: (id: string) => string[];
  now?: Date;
}

const DAY = 86400000;

/** The style in force at a time: the last one chosen before it. */
export function styleAt(
  styles: { id: StyleId; since: string }[] | undefined,
  at: string,
): { id: StyleId; since: string } | null {
  let out = null;
  for (const st of styles ?? []) if (st.since <= at) out = st;
  return out;
}

/** Done working sets: no warm-ups. */
export function workingSets(s: Session) {
  return s.sets.filter((x) => x.done && !x.warmup);
}

/** A finished workout with 3+ working sets, or a run that counts (running.ts). */
export function qualifies(s: Session): boolean {
  if (!s.finished_at) return false;
  if (isRun(s)) {
    const r = asRun(s);
    return !!r && runQualifies(r);
  }
  return workingSets(s).length >= QUALIFYING_SETS;
}

/** Consecutive weeks before `weekStart` that reached the target. */
function streakBefore(weekCounts: Map<number, number>, weekStart: Date, target: number): number {
  let n = 0;
  let w = addDays(weekStart, -7);
  while ((weekCounts.get(w.getTime()) ?? 0) >= target) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

const BIG3: [string, RegExp][] = [
  ['squat', /^(low bar |back |barbell (back )?)?squat$/i],
  ['bench', /^(barbell )?bench press$/i],
  ['deadlift', /^(sumo |conventional |barbell )?deadlift$/i],
];

/** Which of squat, bench and deadlift an exercise name is, if any. */
export function big3Of(name: string | undefined): string | null {
  if (!name) return null;
  for (const [id, re] of BIG3) if (re.test(name.trim())) return id;
  return null;
}

interface ExerciseHistory {
  best: number;
  firstAt: number;
  sessions: number;
}

export function computeGame(input: GameInput): GameState {
  const now = input.now ?? new Date();
  const target = Math.max(1, input.weeklyTarget);
  const factor = LEVEL_FACTOR[input.experience ?? 'beginner'];
  const list = input.sessions
    .filter((s) => s.finished_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  const runs = runResults(list.map(asRun).filter((r): r is RunLike => !!r));
  const history = new Map<string, ExerciseHistory>();
  const big3 = new Map<string, number>();
  const weekCounts = new Map<number, number>();
  const days: Record<string, DayTotals> = {};
  const dayFlags = new Map<string, { attended: boolean; verified: boolean; strength: boolean }>();
  const sessions: Record<string, SessionReward> = {};
  let xp = 0;
  let denariiEarned = 0;

  for (const s of list) {
    const start = new Date(s.started_at);
    const day = toLocalDate(start);
    const ok = qualifies(s);
    const verification = ok ? input.verification(s) : null;
    const names = [...new Set(s.sets.map((x) => input.exerciseName(x.exercise_id) ?? ''))];
    const run = isRun(s) ? (runs.get(s.id) ?? null) : null;

    // PRs: the session's best e1RM per exercise against the history before it.
    let prs = 0;
    let unusual = 0;
    let progress = 0;
    const sessionBest = new Map<string, number>();
    const prExercises = new Set<string>();
    for (const x of workingSets(s)) {
      if (x.drop_of || x.reps <= 0) continue;
      const est = e1rm(x.weight_kg, x.reps);
      sessionBest.set(x.exercise_id, Math.max(sessionBest.get(x.exercise_id) ?? 0, est));
      if (x.is_pr) prExercises.add(x.exercise_id);
    }
    for (const [id, best] of sessionBest) {
      const h = history.get(id);
      const isPr = prExercises.has(id) || (!!h && best > h.best + 1e-9);
      if (ok && isPr && h) {
        const gain = h.best > 0 ? best / h.best - 1 : 0;
        if (gain > UNUSUAL_JUMP && h.sessions >= UNUSUAL_MIN_SESSIONS) unusual++;
        else {
          prs++;
          const baseline = start.getTime() - h.firstAt < BASELINE_DAYS * DAY;
          if (!baseline) progress += Math.max(1, Math.round(Math.max(0, gain) * 100 * factor));
        }
      }
      // An unusual jump does not raise the bar it is measured against.
      const unusualJump =
        !!h && h.best > 0 && best / h.best - 1 > UNUSUAL_JUMP && h.sessions >= UNUSUAL_MIN_SESSIONS;
      history.set(id, {
        best: unusualJump ? h!.best : Math.max(h?.best ?? 0, best),
        firstAt: h?.firstAt ?? start.getTime(),
        sessions: (h?.sessions ?? 0) + 1,
      });
      const lift = big3Of(input.exerciseName(id));
      if (lift && !unusualJump) big3.set(lift, Math.max(big3.get(lift) ?? 0, best));
    }

    // A run: one PR at most, on its standard distance (running.ts).
    if (ok && run) {
      if (run.unusual) unusual++;
      if (run.pr) {
        prs = RUN.maxPrs;
        if (!run.baseline) progress += Math.max(1, Math.round(run.gain * 100 * factor));
      }
    }

    const week = startOfWeek(start);
    const streak = streakBefore(weekCounts, week, target);
    const levelBefore = levelFromXp(xp);

    const xpParts: RewardPart[] = [];
    const laurelParts: RewardPart[] = [];
    let denarii = 0;
    const totals = (days[day] ??= { day, xp: 0, laurels: 0, denarii: 0, workouts: 0, prs: 0 });
    const flags = dayFlags.get(day) ?? { attended: false, verified: false, strength: false };
    let xpGranted = 0;
    let xpRaw = 0;
    let laurels = 0;

    if (ok) {
      const rewardedPrs = Math.min(prs, XP.maxPrs);
      xpParts.push({ label: run ? 'Run' : 'Workout', amount: XP.workout });
      if (verification === 'verified')
        xpParts.push({ label: 'Verified at the gym', amount: XP.verified });
      if (verification === 'incomplete')
        xpParts.push({ label: 'Gym visit', amount: XP.incomplete });
      if (rewardedPrs)
        xpParts.push({
          label: rewardedPrs === 1 ? 'New PR' : `${rewardedPrs} PRs`,
          amount: XP.pr * rewardedPrs,
        });
      if (streak)
        xpParts.push({
          label: `${streak}-week streak`,
          amount: XP.streakWeek * Math.min(streak, XP.maxStreakWeeks),
        });
      if (input.together?.has(s.id))
        xpParts.push({ label: 'Trained together', amount: XP.together });
      const style = styleAt(input.styles, s.started_at);
      if (
        style &&
        styleMatches(style.id, {
          sets: workingSets(s),
          muscles: (id) => input.exerciseMuscles?.(id) ?? [],
          streak,
          run: !!run,
        })
      )
        xpParts.push({ label: `${styleDef(style.id).name} style`, amount: STYLE.xp });
      xpRaw = xpParts.reduce((sum, p) => sum + p.amount, 0);
      xpGranted = Math.min(xpRaw, Math.max(0, XP.dailyCap - totals.xp));

      // Laurels: attendance and verification once a day; progress and the weekly target per workout.
      if (!flags.attended) {
        laurelParts.push({ label: 'Attendance', amount: LAURELS.attendance });
        flags.attended = true;
      }
      if (verification && !flags.verified) {
        laurelParts.push({
          label: verification === 'verified' ? 'Verified at the gym' : 'Gym visit',
          amount: verification === 'verified' ? LAURELS.verified : LAURELS.incomplete,
        });
        if (verification === 'verified') flags.verified = true;
      }
      if (progress)
        laurelParts.push({ label: 'Progress', amount: Math.min(progress, LAURELS.maxProgress) });
      if (run && !flags.strength) {
        const strength = runStrength(run.vdot);
        if (strength > 0) {
          laurelParts.push({ label: 'Strength', amount: strength });
          flags.strength = true;
        }
      } else if (!run && input.dotsCoefficient && !flags.strength) {
        const total = [...big3.values()].reduce((a, b) => a + b, 0) * input.dotsCoefficient;
        const strength = Math.min(LAURELS.maxStrength, Math.floor(total / LAURELS.strengthDivisor));
        if (strength > 0) {
          laurelParts.push({ label: 'Strength', amount: strength });
          flags.strength = true;
        }
      }
      const inWeek = (weekCounts.get(week.getTime()) ?? 0) + 1;
      if (inWeek === target)
        laurelParts.push({ label: 'Weekly target', amount: LAURELS.weeklyTarget });
      const raw = laurelParts.reduce((sum, p) => sum + p.amount, 0);
      laurels = Math.min(raw, Math.max(0, LAURELS.dailyCap - totals.laurels));

      // Denarii
      const base =
        verification === 'verified'
          ? DENARII.verified
          : verification === 'incomplete'
            ? DENARII.incomplete
            : DENARII.unverified;
      let d =
        base +
        DENARII.pr * Math.min(prs, DENARII.maxPrs) +
        DENARII.streakWeek * Math.min(streak, DENARII.maxStreakWeeks) +
        (input.togetherLudus?.has(s.id) ? DENARII.togetherLudus : 0);
      d = Math.round(d * (1 + (input.denariiBonus?.(s, names) ?? 0)));
      denarii = Math.min(d, Math.max(0, DENARII.dailyCap - totals.denarii));

      weekCounts.set(week.getTime(), inWeek);
      totals.workouts++;
      totals.prs += prs;
    }

    totals.xp += xpGranted;
    totals.laurels += laurels;
    totals.denarii += denarii;
    dayFlags.set(day, flags);
    xp += xpGranted;
    denariiEarned += denarii;

    sessions[s.id] = {
      sessionId: s.id,
      day,
      qualifies: ok,
      verification,
      xp: xpGranted,
      xpParts,
      xpCapped: xpRaw - xpGranted,
      laurels,
      laurelParts,
      denarii,
      prs,
      unusualPrs: unusual,
      levelBefore,
      levelAfter: levelFromXp(xp),
      run: !!run,
    };
  }

  return {
    xp,
    level: levelFromXp(xp),
    denariiEarned,
    sessions,
    days,
    seasons: seasonsFrom(days, input.awards ?? {}, now),
  };
}

/** Season scores with the carry-over, from the first active month through the current one. */
export function seasonsFrom(
  days: Record<string, DayTotals>,
  awards: Record<string, number>,
  now: Date = new Date(),
): SeasonTotals[] {
  const earned = new Map<string, number>();
  for (const d of Object.values(days))
    earned.set(seasonOf(d.day), (earned.get(seasonOf(d.day)) ?? 0) + d.laurels);
  const current = seasonOf(now);
  const starts = [...earned.keys(), ...Object.keys(awards), current].sort();
  const out: SeasonTotals[] = [];
  let carry = 0;
  for (let s = starts[0]; s <= current; s = nextSeason(s)) {
    const e = earned.get(s) ?? 0;
    const a = awards[s] ?? 0;
    const score = carry + e + a;
    out.push({ season: s, carry, earned: e, awards: a, score });
    carry = carryOver(score);
  }
  return out;
}

export function currentSeason(state: GameState, now: Date = new Date()): SeasonTotals {
  const s = seasonOf(now);
  return (
    state.seasons.find((x) => x.season === s) ?? {
      season: s,
      carry: 0,
      earned: 0,
      awards: 0,
      score: 0,
    }
  );
}
