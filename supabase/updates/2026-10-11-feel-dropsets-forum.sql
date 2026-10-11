-- Run once in the SQL editor: drop sets and failure, how a workout felt, machine weights,
-- the Forum and the opt-in global leaderboard.

-- Drop sets and failure.
alter table public.set_entries add column if not exists drop_of uuid;
alter table public.set_entries add column if not exists failure boolean not null default false;

-- How the workout felt (rated after finishing). Private: only the owner can read it, so it is
-- kept out of workout_sessions (which friends and the gym can read).
alter table public.workout_sessions drop column if exists rpe;
alter table public.workout_sessions drop column if exists feel;
create table if not exists public.session_ratings (
  session_id uuid primary key references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rpe smallint check (rpe between 1 and 10),    -- effort of the whole workout
  feel jsonb,                                   -- {"energy","sleep","pump","joints"}: 1 (bad) … 5 (great)
  updated_at timestamptz not null default now()
);
alter table public.session_ratings enable row level security;
drop policy if exists "session ratings owner" on public.session_ratings;
create policy "session ratings owner" on public.session_ratings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- Opt-in global leaderboard.
alter table public.profiles add column if not exists global_ranking boolean not null default false;

-- The user's own settings per exercise (machine weight).
create table if not exists public.exercise_prefs (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  machine_kg numeric(6,2) check (machine_kg >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);
alter table public.exercise_prefs enable row level security;
drop policy if exists "exercise prefs owner" on public.exercise_prefs;
create policy "exercise prefs owner" on public.exercise_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Forum: workouts shared with friends and the home gym, to comment on and copy.
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete set null,
  title text not null check (length(title) between 1 and 80),
  body text not null default '' check (length(body) <= 2000),
  workout jsonb not null,                       -- snapshot of the exercises and sets (see src/features/forum)
  created_at timestamptz not null default now()
);
create index if not exists forum_posts_created on public.forum_posts(created_at desc);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists forum_comments_post on public.forum_comments(post_id, created_at);

create table if not exists public.forum_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes enable row level security;

drop policy if exists "forum posts read" on public.forum_posts;
drop policy if exists "forum posts write" on public.forum_posts;
drop policy if exists "forum posts delete" on public.forum_posts;
drop policy if exists "forum comments read" on public.forum_comments;
drop policy if exists "forum comments write" on public.forum_comments;
drop policy if exists "forum likes read" on public.forum_likes;
drop policy if exists "forum likes write" on public.forum_likes;
create policy "forum posts read"   on public.forum_posts for select to authenticated using (public.can_view_user(user_id));
create policy "forum posts write"  on public.forum_posts for insert to authenticated
  with check (user_id = auth.uid() and (session_id is null or exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())));
create policy "forum posts delete" on public.forum_posts for delete to authenticated using (user_id = auth.uid());
create policy "forum comments read"  on public.forum_comments for select to authenticated
  using (exists (select 1 from forum_posts p where p.id = post_id and public.can_view_user(p.user_id)));
create policy "forum comments write" on public.forum_comments for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from forum_posts p where p.id = post_id and public.can_view_user(p.user_id)));
create policy "forum likes read"  on public.forum_likes for select to authenticated
  using (exists (select 1 from forum_posts p where p.id = post_id and public.can_view_user(p.user_id)));
create policy "forum likes write" on public.forum_likes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from forum_posts p where p.id = post_id and public.can_view_user(p.user_id)));

-- Leaderboard with the global scope (only users who opted in, and only for a caller who did),
-- and DOTS as ranks only.
create or replace function public.get_leaderboard(p_scope text, p_metric text, p_period text, p_tz text default 'UTC')
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, value numeric)
language sql stable security definer set search_path = public as $$
  with me as (select id, home_gym_id, global_ranking from profiles where id = auth.uid()),
  metric as (
    select p_metric like 'dots:%' as dots,
           case when p_metric like 'dots:%' then substr(p_metric, 6) else p_metric end as key
  ),
  members as (
    select p.id from profiles p, me
    where (p_scope <> 'global' and p.id = me.id)
       or (p_scope = 'friends' and is_friend(me.id, p.id))
       or (p_scope = 'gym' and p.home_gym_id is not null and p.home_gym_id = me.home_gym_id)
       or (p_scope = 'global' and me.global_ranking and p.global_ranking)
  ),
  since as (
    select case p_period
      when 'week'  then date_trunc('week', now() at time zone p_tz) at time zone p_tz
      when 'month' then date_trunc('month', now() at time zone p_tz) at time zone p_tz
      else '-infinity'::timestamptz end as t
  ),
  sets as (
    select s.user_id, s.id as session_id, e.exercise_id, e.weight_kg, e.reps
    from set_entries e join workout_sessions s on s.id = e.session_id, since
    where e.done and s.finished_at is not null and s.started_at >= since.t
      and s.user_id in (select id from members)
  ),
  vals as (
    select user_id,
      case
        when (select key from metric) = 'volume'   then sum(weight_kg * reps)
        when (select key from metric) = 'workouts' then count(distinct session_id)::numeric
        else max(case when exercise_id::text = (select key from metric)
                      then case when reps <= 1 then weight_kg else weight_kg * (1 + reps / 30.0) end end)
      end as value
    from sets group by user_id
  ),
  scored as (
    select v.user_id,
      case when (select dots from metric)
        then v.value * dots_coefficient(
          (select b.weight_kg from bodyweight_logs b where b.user_id = v.user_id
           order by b.logged_on desc limit 1),
          (select p.sex from profiles p where p.id = v.user_id))
        else v.value end as value
    from vals v
  )
  -- DOTS scores of others are ranked but not returned: next to the kg board they would give
  -- away bodyweight. The caller sees their own score.
  select rank() over (order by v.value desc nulls last), p.id, p.username, p.display_name, p.avatar_url,
         case when (select dots from metric) and p.id <> auth.uid() then null else round(v.value, 1) end
  from scored v join profiles p on p.id = v.user_id
  where v.value is not null
  order by 1
  limit 500;
$$;
