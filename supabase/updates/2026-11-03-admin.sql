-- Run in the SQL editor (safe to run again): the admin (Settings → Admin), usage stats, reports
-- for the admin and blocking. Then make yourself the admin, with your own username:
--
--   insert into public.admins (user_id)
--   select id from public.profiles where username = 'your_username'
--   on conflict do nothing;

-- ───────────── Who is an admin ─────────────
-- Its own table, not a profile column: everyone can edit their own profile row.
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.admins enable row level security;  -- no policies: only the SQL editor touches it

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ───────────── Blocking ─────────────
create table if not exists public.blocked_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  blocked_at timestamptz not null default now()
);
alter table public.blocked_users enable row level security;  -- read and written by the admin functions

create or replace function public.is_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocked_users where user_id = p_user);
$$;

-- A blocked user cannot post or comment. Restrictive: on top of the existing rules.
drop policy if exists "not blocked" on public.forum_posts;
create policy "not blocked" on public.forum_posts as restrictive for insert to authenticated
  with check (not public.is_blocked(auth.uid()));
drop policy if exists "not blocked" on public.forum_comments;
create policy "not blocked" on public.forum_comments as restrictive for insert to authenticated
  with check (not public.is_blocked(auth.uid()));
drop policy if exists "not blocked" on public.session_comments;
create policy "not blocked" on public.session_comments as restrictive for insert to authenticated
  with check (not public.is_blocked(auth.uid()));

-- ───────────── Usage events ─────────────
-- One row per user, event and day: enough for active users, installs and the sign-up funnel.
-- Workouts count as activity too, so the numbers make sense from the start.
create table if not exists public.app_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (name in ('open', 'open_installed', 'tour_done')),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, name, day)
);
alter table public.app_events enable row level security;
drop policy if exists "events insert" on public.app_events;
create policy "events insert" on public.app_events for insert to authenticated
  with check (user_id = auth.uid());

-- ───────────── Stats ─────────────
create or replace function public.admin_stats(p_tz text default 'UTC') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone p_tz)::date;
  tracking_since date := (select min(day) from app_events);
  result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;

  with
  users as (select id, (created_at at time zone p_tz)::date as joined from profiles),
  activity as (
    select user_id, day from app_events where name in ('open', 'open_installed')
    union
    select user_id, (started_at at time zone p_tz)::date from workout_sessions
  ),
  weeks as (
    select generate_series(date_trunc('week', today::timestamp) - interval '11 weeks',
                           date_trunc('week', today::timestamp), interval '1 week')::date as week
  ),
  retention as (
    select n, count(*) filter (where u.joined <= today - n) as eligible,
           count(*) filter (where u.joined <= today - n and exists (
             select 1 from activity a where a.user_id = u.id and a.day >= u.joined + n)) as back
    from users u, (values (1), (7), (30)) as v(n)
    group by n
  ),
  cohort as (select * from users where tracking_since is not null and joined >= tracking_since)
  select jsonb_build_object(
    'today', today,
    'users', (select count(*) from users),
    'new_today', (select count(*) from users where joined = today),
    'new_7d', (select count(*) from users where joined > today - 7),
    'new_30d', (select count(*) from users where joined > today - 30),
    'installed_30d', (select count(distinct user_id) from app_events
                      where name = 'open_installed' and day > today - 30),
    'active_1d', (select count(distinct user_id) from activity where day = today),
    'active_7d', (select count(distinct user_id) from activity where day > today - 7),
    'active_30d', (select count(distinct user_id) from activity where day > today - 30),
    'signups_by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'count',
                          (select count(*) from users u where u.joined >= w.week and u.joined < w.week + 7))
                          order by w.week), '[]') from weeks w),
    'retention', (select coalesce(jsonb_agg(jsonb_build_object('days', n, 'eligible', eligible, 'back', back)
                    order by n), '[]') from retention),
    'funnel', jsonb_build_object(
      'since', tracking_since,
      'signed_up', (select count(*) from cohort),
      'tour_done', (select count(*) from cohort c where exists (
                     select 1 from app_events e where e.user_id = c.id and e.name = 'tour_done')),
      'first_workout', (select count(*) from cohort c where exists (
                         select 1 from workout_sessions s where s.user_id = c.id and s.finished_at is not null)),
      'week2_eligible', (select count(*) from cohort where joined <= today - 14),
      'week2', (select count(*) from cohort c where c.joined <= today - 14 and exists (
                 select 1 from activity a where a.user_id = c.id
                   and a.day between c.joined + 7 and c.joined + 13))
    )
  ) into result;
  return result;
end;
$$;

-- ───────────── Reports for the admin ─────────────
-- One row per reported thing: how often, what it says, who wrote it, whether it is still there.
create or replace function public.admin_reports()
returns table (target_type text, target_id uuid, reports bigint, last_at timestamptz,
               author_id uuid, author_username text, author_name text, preview text,
               gone boolean, author_blocked boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  with r as (
    select x.target_type, x.target_id, count(*) as n, max(x.created_at) as last_at
    from reports x group by x.target_type, x.target_id
  ),
  t as (
    select r.*,
      case r.target_type
        when 'forum_post' then fp.user_id when 'forum_comment' then fc.user_id
        when 'session_comment' then sc.user_id else pu.id end as author,
      case r.target_type
        when 'forum_post' then fp.title || coalesce(': ' || nullif(fp.body, ''), '')
        when 'forum_comment' then fc.body when 'session_comment' then sc.body end as preview,
      case r.target_type
        when 'forum_post' then fp.id when 'forum_comment' then fc.id
        when 'session_comment' then sc.id else pu.id end is null as gone
    from r
    left join forum_posts fp on r.target_type = 'forum_post' and fp.id = r.target_id
    left join forum_comments fc on r.target_type = 'forum_comment' and fc.id = r.target_id
    left join session_comments sc on r.target_type = 'session_comment' and sc.id = r.target_id
    left join profiles pu on r.target_type = 'user' and pu.id = r.target_id
  )
  select t.target_type, t.target_id, t.n, t.last_at, t.author, p.username, p.display_name,
         t.preview, t.gone, exists (select 1 from blocked_users b where b.user_id = t.author)
  from t left join profiles p on p.id = t.author
  order by t.gone, t.last_at desc;
end;
$$;

create or replace function public.admin_delete_content(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  case p_type
    when 'forum_post' then delete from forum_posts where id = p_id;
    when 'forum_comment' then delete from forum_comments where id = p_id;
    when 'session_comment' then delete from session_comments where id = p_id;
    else raise exception 'Cannot delete %', p_type;
  end case;
end;
$$;

-- Handled: the reports go, the content stays (or was deleted already).
create or replace function public.admin_dismiss_reports(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  delete from reports where target_type = p_type and target_id = p_id;
end;
$$;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot block yourself'; end if;
  if p_blocked then
    insert into blocked_users (user_id) values (p_user) on conflict do nothing;
  else
    delete from blocked_users where user_id = p_user;
  end if;
end;
$$;
