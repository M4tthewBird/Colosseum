-- Run once in the SQL editor: favorite exercises (starred, listed first in the exercise picker).
alter table public.exercise_prefs add column if not exists favorite boolean not null default false;
