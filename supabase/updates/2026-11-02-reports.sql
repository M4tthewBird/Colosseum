-- Reporting posts, comments and people, and a sane limit on the weight of a set.
-- Safe to run more than once.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('forum_post','forum_comment','session_comment','user')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

alter table public.reports enable row level security;

-- Anyone can report, nobody can read reports through the app: they are read in the Supabase dashboard.
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- "not valid": checks new and changed rows only, so existing typos can still be corrected.
alter table public.set_entries drop constraint if exists set_entries_weight_cap;
alter table public.set_entries add constraint set_entries_weight_cap
  check (weight_kg <= 1000) not valid;
