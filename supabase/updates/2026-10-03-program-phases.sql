-- Run once in the SQL editor: adds periodization (weekly phases) to programs.
alter table public.programs add column if not exists phases jsonb not null default '[]';
