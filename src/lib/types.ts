import type { Phase } from './periodization';

/** Row shapes shared by the local store, the sync queue and Supabase. Dates are ISO strings. */

export type Sex = 'male' | 'female';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'strength' | 'muscle' | 'endurance' | 'lean' | 'health';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  sex: Sex | null;
  experience: Experience | null;
  goals: Goal[];
  home_gym_id: string | null;
  avatar_url: string | null;
  /** Opted in to the global leaderboard (everyone who opted in sees everyone who did). */
  global_ranking?: boolean;
}

export interface ProfilePrivate {
  user_id: string;
  height_cm: number | null;
}

export interface Gym {
  id: string;
  name: string;
  city: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  muscles: string[];
  image_key: string | null;
  created_by: string | null;
  /** Jeff Nippard tier list rating for built-ins. */
  tier?: 'S' | 'A' | 'B' | null;
}

export interface ProgramExercise {
  id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  /** Exercises done as one superset share this id. */
  superset_id?: string | null;
}

export interface ProgramDay {
  id: string;
  position: number;
  name: string;
  /** 1 = Monday … 7 = Sunday */
  weekdays: number[];
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  owner_id: string;
  name: string;
  weeks: number;
  /** 1 = Monday … 7 = Sunday */
  training_days: number[];
  /** Weekly periodization; empty = every week the same. */
  phases: Phase[];
  /** 'workout' = a saved one-off workout (one day, never active), started on demand. */
  kind?: 'program' | 'workout';
  is_active: boolean;
  started_on: string | null;
  updated_at: string;
  created_at: string;
  days: ProgramDay[];
}

export interface SetEntry {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_position: number;
  set_number: number;
  weight_kg: number;
  /** For a set logged per side: the weaker side, so 1RM and PRs hold for both. */
  reps: number;
  /** Set logged per side (one leg or arm at a time): reps of each side. Both null otherwise. */
  left_reps?: number | null;
  right_reps?: number | null;
  done: boolean;
  is_pr: boolean;
  /** Sets of exercises done as one superset share this id. */
  superset_id?: string | null;
  /** A drop set: the set it follows right away (the main set or the previous drop). */
  drop_of?: string | null;
  /** Taken to muscular failure. */
  failure?: boolean;
  /**
   * A warm-up before the working sets: shown as "W", never counted to volume, set counts, PRs
   * or suggestions. Warm-ups have set numbers below 1 (… -2, -1, 0) so they sort first.
   */
  warmup?: boolean;
  updated_at: string;
}

/** How a workout felt, each 1 (bad) … 5 (great). */
export interface Feel {
  energy: number;
  sleep: number;
  pump: number;
  joints: number;
}

export interface Session {
  id: string;
  user_id: string;
  program_day_id: string | null;
  name: string;
  /** Where it was done, confirmed when starting; null = not at a gym (or not asked yet). */
  gym_id?: string | null;
  started_at: string;
  finished_at: string | null;
  volume_kg: number;
  set_count: number;
  pr_count: number;
  /** Note per exercise in this workout, keyed by exercise_position. */
  notes?: Record<string, string>;
  /** Effort of the whole workout, 1–10, rated after finishing. */
  rpe?: number | null;
  feel?: Feel | null;
  updated_at: string;
  sets: SetEntry[];
}

/** The user's own settings for one exercise. */
export interface ExercisePref {
  id: string;
  user_id: string;
  exercise_id: string;
  /** Weight of the machine itself (sled, carriage, Smith bar). Shown as information only. */
  machine_kg: number | null;
  /** Log left and right reps separately (one leg or arm at a time). */
  each_side?: boolean;
  /** Starred: listed first in the exercise picker and under its Favorites chip. */
  favorite?: boolean;
  updated_at: string;
}

export interface BodyweightLog {
  id: string;
  user_id: string;
  logged_on: string;
  weight_kg: number;
}

export const MEASUREMENT_KEYS = [
  'chest_cm',
  'shoulders_cm',
  'biceps_l_cm',
  'biceps_r_cm',
  'forearms_cm',
  'waist_cm',
  'thighs_cm',
  'calves_cm',
] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest_cm: 'Chest',
  shoulders_cm: 'Shoulders',
  biceps_l_cm: 'Biceps L',
  biceps_r_cm: 'Biceps R',
  forearms_cm: 'Forearms',
  waist_cm: 'Waist',
  thighs_cm: 'Thighs',
  calves_cm: 'Calves',
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  logged_on: string;
} & { [K in MeasurementKey]: number | null };

/** Public view of another user (never contains body data). */
export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id?: string | null;
}
