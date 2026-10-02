-- Run once in the SQL editor: exercise notes in workouts, and saved one-off workouts.
alter table public.workout_sessions add column if not exists notes jsonb not null default '{}';
alter table public.programs add column if not exists kind text not null default 'program'
  check (kind in ('program','workout'));
