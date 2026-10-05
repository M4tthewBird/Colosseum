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
  reps: number;
  done: boolean;
  is_pr: boolean;
  /** Sets of exercises done as one superset share this id. */
  superset_id?: string | null;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  program_day_id: string | null;
  name: string;
  started_at: string;
  finished_at: string | null;
  volume_kg: number;
  set_count: number;
  pr_count: number;
  /** Note per exercise in this workout, keyed by exercise_position. */
  notes?: Record<string, string>;
  updated_at: string;
  sets: SetEntry[];
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
