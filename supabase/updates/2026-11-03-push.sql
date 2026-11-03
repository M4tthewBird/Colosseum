-- Run in the SQL editor after 2026-11-03-admin.sql (safe to run again): web push. Each device
-- that turned notifications on has a row here; the "push" Edge Function sends to them
-- (supabase/functions/push, see docs/PUSH.md).

create table if not exists public.push_subscriptions (
  endpoint text primary key,                    -- the browser's push address, one per device
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;  -- no policies: functions only

-- A device signed in to another account before moves to this one.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql volatile security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- For the admin's announcement: how many people and devices it would reach.
create or replace function public.admin_push_reach() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'users', (select count(distinct user_id) from push_subscriptions),
    'devices', (select count(*) from push_subscriptions)
  );
end;
$$;
