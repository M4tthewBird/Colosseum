-- Run in the SQL editor after 2026-11-03-admin.sql (safe to run again): feedback and error
-- reports. Users send them (Settings → Send feedback, or the app on a crash or a refused sync);
-- only the admin reads them (Settings → Admin → Feedback).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('message', 'crash', 'sync')),
  message text not null check (length(message) between 1 and 2000),
  -- App version, device, screen, error details. Never workout or body data.
  details jsonb not null default '{}' check (length(details::text) <= 8000),
  screenshot text,                              -- path in the private "feedback" bucket
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists feedback_created on public.feedback(created_at desc);
alter table public.feedback enable row level security;

-- How many the user sent in the last day (the insert rule cannot count rows it cannot read).
create or replace function public.feedback_today(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from feedback where user_id = p_user and created_at > now() - interval '1 day';
$$;

-- Anyone signed in can send, up to 30 a day; nobody reads them through the app but the admin.
drop policy if exists "feedback insert" on public.feedback;
create policy "feedback insert" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and resolved_at is null and public.feedback_today(auth.uid()) < 30);

-- ───────────── Screenshots ─────────────
-- Private bucket "feedback": feedback/<uid>/<id>.jpg. The sender can upload and remove their own
-- (removed with the account); only the admin can open them.
insert into storage.buckets (id, name, public) values ('feedback', 'feedback', false)
on conflict (id) do nothing;

drop policy if exists "feedback files insert" on storage.objects;
create policy "feedback files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "feedback files read" on storage.objects;
create policy "feedback files read" on storage.objects for select to authenticated
  using (bucket_id = 'feedback'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "feedback files delete" on storage.objects;
create policy "feedback files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ───────────── For the admin ─────────────
create or replace function public.admin_feedback(p_resolved boolean default false)
returns table (id uuid, kind text, message text, details jsonb, screenshot text,
               created_at timestamptz, resolved_at timestamptz,
               user_id uuid, username text, display_name text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select f.id, f.kind, f.message, f.details, f.screenshot, f.created_at, f.resolved_at,
         f.user_id, p.username, p.display_name
  from feedback f left join profiles p on p.id = f.user_id
  where (f.resolved_at is not null) = p_resolved
  order by f.created_at desc
  limit 300;
end;
$$;

create or replace function public.admin_resolve_feedback(p_id uuid, p_resolved boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update feedback set resolved_at = case when p_resolved then now() end where id = p_id;
end;
$$;
