-- Run once in the SQL editor: badges (highest tier per badge), visible to friends and gym members.
create table if not exists public.user_badges (
  id uuid primary key,                          -- generated on the device (one per user + badge)
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null,
  tier numeric not null,                        -- threshold of the highest tier reached
  earned_at timestamptz not null default now(),
  unique (user_id, badge)
);
alter table public.user_badges enable row level security;

drop policy if exists "badges read" on public.user_badges;
drop policy if exists "badges write" on public.user_badges;
create policy "badges read"  on public.user_badges for select to authenticated using (public.can_view_user(user_id));
create policy "badges write" on public.user_badges for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
