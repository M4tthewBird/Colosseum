-- Run once in the SQL editor: supersets (two or more exercises done back to back).
alter table public.set_entries add column if not exists superset_id text;
alter table public.program_exercises add column if not exists superset_id text;
