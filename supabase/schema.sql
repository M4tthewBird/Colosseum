-- Colosseum — starting schema (Supabase / Postgres)
-- Apply as the first migration. Claude Code: refine as needed, keep the privacy rules.

create extension if not exists "pgcrypto";

-- ───────────────────────── Gyms & profiles ─────────────────────────
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null,
  sex text check (sex in ('male','female')),
  experience text check (experience in ('beginner','intermediate','advanced')),
  goals text[] not null default '{}',
  home_gym_id uuid references public.gyms(id) on delete set null,
  avatar_url text,
  global_ranking boolean not null default false,  -- opted in to the global leaderboard
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- ───────────────────────── Helper functions ─────────────────────────
create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create or replace function public.same_gym(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles pa join profiles pb on pa.home_gym_id = pb.home_gym_id
    where pa.id = a and pb.id = b and pa.home_gym_id is not null
  );
$$;

create or replace function public.can_view_user(target uuid) returns boolean
language sql stable as $$
  select auth.uid() = target or public.is_friend(auth.uid(), target) or public.same_gym(auth.uid(), target);
$$;

-- ───────────────────────── Exercises & programs ─────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscles text[] not null default '{}',
  tier text check (tier in ('S','A','B')),       -- Jeff Nippard tier list rating, built-ins only
  image_key text,                               -- e.g. 'bench-press' → assets/exercises/bench-press.jpg
  created_by uuid references public.profiles(id) on delete cascade,  -- null = built-in
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  weeks int not null default 8 check (weeks between 1 and 52),
  training_days int[] not null default '{}',   -- 1 = Monday … 7 = Sunday
  phases jsonb not null default '[]',           -- periodization: [{name, from, to, sets, rpe}]
  kind text not null default 'program' check (kind in ('program','workout')),  -- 'workout' = saved one-off workout
  is_active boolean not null default false,
  started_on date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index one_active_program on public.programs(owner_id) where is_active;

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  position int not null,
  name text not null,
  weekdays int[] not null default '{}'         -- 1 = Monday … 7 = Sunday
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position int not null,
  sets int not null default 3 check (sets between 1 and 20),
  reps_min int not null default 8,
  reps_max int not null default 8,
  rest_seconds int not null default 120,
  superset_id text                              -- exercises done as one superset share this id
);

-- ───────────────────────── Workouts (client-generated ids for offline) ─────────────────────────
create table public.workout_sessions (
  id uuid primary key,                          -- generated on the device
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_day_id uuid references public.program_days(id) on delete set null,
  name text not null,
  gym_id uuid references public.gyms(id) on delete set null,  -- where it was done (confirmed at start)
  started_at timestamptz not null,
  finished_at timestamptz,
  volume_kg numeric not null default 0,         -- totals written by the client on finish
  set_count int not null default 0,
  pr_count int not null default 0,
  notes jsonb not null default '{}',            -- note per exercise: {"<exercise_position>": "text"}
  updated_at timestamptz not null default now()
);
create index on public.workout_sessions(user_id, started_at desc);

create table public.set_entries (
  id uuid primary key,                          -- generated on the device
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  exercise_position int not null,
  set_number int not null,
  weight_kg numeric(6,2) not null check (weight_kg >= 0),
  reps int not null check (reps >= 0),          -- per-side set: the weaker side (1RM, PRs)
  left_reps int check (left_reps >= 0),         -- per-side set (one leg/arm at a time): each side,
  right_reps int check (right_reps >= 0),       -- both count to volume; null for a normal set
  done boolean not null default false,
  is_pr boolean not null default false,
  superset_id text,                             -- sets of exercises done as one superset share this id
  drop_of uuid,                                 -- drop set: the set it follows (main set or previous drop)
  failure boolean not null default false,       -- taken to muscular failure
  warmup boolean not null default false,        -- warm-up: set_number <= 0, counts to nothing
  updated_at timestamptz not null default now()
);
create index on public.set_entries(session_id);
create index on public.set_entries(exercise_id);

-- How a workout felt, rated after finishing. Private (owner only), unlike the session itself.
create table public.session_ratings (
  session_id uuid primary key references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rpe smallint check (rpe between 1 and 10),    -- effort of the whole workout
  feel jsonb,                                   -- {"energy","sleep","pump","joints"}: 1 (bad) … 5 (great)
  updated_at timestamptz not null default now()
);

-- The user's own settings per exercise.
create table public.exercise_prefs (
  id uuid primary key,                          -- generated on the device
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  machine_kg numeric(6,2) check (machine_kg >= 0),  -- weight of the machine itself, information only
  each_side boolean not null default false,     -- log left and right reps separately
  favorite boolean not null default false,      -- starred: first in the exercise picker
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

-- Badges earned (highest tier per badge), written by the app from the history (src/lib/badges.ts)
-- so friends and gym members can see them.
create table public.user_badges (
  id uuid primary key,                          -- generated on the device (one per user + badge)
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null,
  tier numeric not null,                        -- threshold of the highest tier reached
  earned_at timestamptz not null default now(),
  unique (user_id, badge)
);

-- ───────────────────────── Private body data ─────────────────────────
create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric(5,1)
);

create table public.bodyweight_logs (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5,1) not null,
  unique (user_id, logged_on)
);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null,
  chest_cm numeric(5,1), shoulders_cm numeric(5,1),
  biceps_l_cm numeric(5,1), biceps_r_cm numeric(5,1),
  forearms_cm numeric(5,1), waist_cm numeric(5,1),
  thighs_cm numeric(5,1), calves_cm numeric(5,1),
  unique (user_id, logged_on)
);

-- ───────────────────────── Gym community ─────────────────────────
create table public.gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create table public.gym_challenges (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  exercise_id uuid references public.exercises(id),   -- null = metric below
  metric text not null default 'reps' check (metric in ('reps','volume','workouts')),
  target numeric not null,
  starts_on date not null,
  ends_on date not null,
  created_by uuid references public.profiles(id) on delete set null
);

create table public.session_likes (
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ───────────────────────── Forum ─────────────────────────
-- Workouts shared with friends and the home gym, to comment on and copy.
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete set null,
  title text not null check (length(title) between 1 and 80),
  body text not null default '' check (length(body) <= 2000),
  workout jsonb not null,                       -- snapshot of the exercises and sets (see src/features/forum)
  created_at timestamptz not null default now()
);
create index forum_posts_created on public.forum_posts(created_at desc);

create table public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index forum_comments_post on public.forum_comments(post_id, created_at);

create table public.forum_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ───────────────────────── Bests (PRs) ─────────────────────────
create or replace view public.exercise_bests with (security_invoker = true) as
select s.user_id, e.exercise_id,
       max(e.weight_kg) as best_weight_kg,
       max(case when e.reps <= 1 then e.weight_kg else e.weight_kg * (1 + e.reps / 30.0) end) as best_e1rm_kg
from public.set_entries e
join public.workout_sessions s on s.id = e.session_id
where e.done and not e.warmup and s.finished_at is not null
group by s.user_id, e.exercise_id;

-- ───────────────────────── Leaderboard ─────────────────────────
-- DOTS coefficient: 500 / polynomial(bodyweight), separate for men and women.
-- Multiplied with a lift it gives a bodyweight-adjusted score.
create or replace function public.dots_coefficient(p_bodyweight numeric, p_sex text) returns numeric
language sql immutable as $$
  select case
    when p_bodyweight is null or p_sex is null then null
    when p_sex = 'female' then 500 / (-57.96288 + 13.6175032 * w - 0.1126655495 * w ^ 2
                                      + 0.0005158568 * w ^ 3 - 0.0000010706 * w ^ 4)
    else 500 / (-307.75076 + 24.0900756 * w - 0.1918759221 * w ^ 2
                + 0.0007391293 * w ^ 3 - 0.000001093 * w ^ 4)
  end
  from (select least(greatest(p_bodyweight, 40), case when p_sex = 'female' then 150 else 210 end) as w) x;
$$;

-- p_scope: 'friends' | 'gym' | 'global' (only users who opted in, and only for a caller who did).
-- p_metric: 'volume' | 'workouts' | <exercise uuid> (best e1RM, kg) | 'dots:<exercise uuid>' (best e1RM × DOTS).
-- p_tz: the caller's IANA time zone, so "this week" starts on the local Monday.
-- Bodyweight is read only for DOTS (latest log) and is never returned. Other users' DOTS scores are
-- not returned either (only their rank), since next to the kg board they would give bodyweight away.
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
    select s.user_id, s.id as session_id, e.exercise_id, e.weight_kg, e.reps,
           coalesce(e.left_reps + e.right_reps, e.reps) as work_reps  -- both sides of a per-side set
    from set_entries e join workout_sessions s on s.id = e.session_id, since
    where e.done and not e.warmup and s.finished_at is not null and s.started_at >= since.t
      and s.user_id in (select id from members)
  ),
  vals as (
    select user_id,
      case
        when (select key from metric) = 'volume'   then sum(weight_kg * work_reps)
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

-- ───────────────────────── Row level security ─────────────────────────
alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_entries enable row level security;
alter table public.profile_private enable row level security;
alter table public.bodyweight_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.gym_checkins enable row level security;
alter table public.gym_challenges enable row level security;
alter table public.session_likes enable row level security;
alter table public.session_comments enable row level security;
alter table public.exercise_prefs enable row level security;
alter table public.session_ratings enable row level security;
alter table public.user_badges enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes enable row level security;

create policy "gyms read"   on public.gyms for select to anon, authenticated using (true);  -- onboarding picks a gym before sign-up
create policy "gyms insert" on public.gyms for insert to authenticated with check (created_by = auth.uid());
create policy "gyms update" on public.gyms for update to authenticated using (created_by = auth.uid());
create policy "gyms delete" on public.gyms for delete to authenticated using (created_by = auth.uid());

create policy "profiles read"  on public.profiles for select to authenticated using (true);  -- select explicit public columns in the app
create policy "profiles write" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "friendships read"   on public.friendships for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "friendships request" on public.friendships for insert to authenticated with check (requester_id = auth.uid() and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy "friendships delete" on public.friendships for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

create policy "exercises read"  on public.exercises for select to authenticated using (created_by is null or public.can_view_user(created_by));
create policy "exercises write" on public.exercises for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "programs owner" on public.programs for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "program_days owner" on public.program_days for all to authenticated
  using (exists (select 1 from programs p where p.id = program_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from programs p where p.id = program_id and p.owner_id = auth.uid()));
create policy "program_exercises owner" on public.program_exercises for all to authenticated
  using (exists (select 1 from program_days d join programs p on p.id = d.program_id where d.id = program_day_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from program_days d join programs p on p.id = d.program_id where d.id = program_day_id and p.owner_id = auth.uid()));

create policy "sessions read"  on public.workout_sessions for select to authenticated using (public.can_view_user(user_id));
create policy "sessions write" on public.workout_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "sets read" on public.set_entries for select to authenticated
  using (exists (select 1 from workout_sessions s where s.id = session_id and public.can_view_user(s.user_id)));
create policy "sets write" on public.set_entries for all to authenticated
  using (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- PRIVATE: owner only, no exceptions
create policy "private profile owner" on public.profile_private for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bodyweight owner"  on public.bodyweight_logs   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "measurements owner" on public.body_measurements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "checkins read" on public.gym_checkins for select to authenticated
  using (gym_id = (select home_gym_id from profiles where id = auth.uid()));
create policy "checkins write" on public.gym_checkins for insert to authenticated
  with check (user_id = auth.uid() and gym_id = (select home_gym_id from profiles where id = auth.uid()));

create policy "challenges read" on public.gym_challenges for select to authenticated
  using (gym_id = (select home_gym_id from profiles where id = auth.uid()));
create policy "challenges write" on public.gym_challenges for insert to authenticated
  with check (created_by = auth.uid() and gym_id = (select home_gym_id from profiles where id = auth.uid()));

create policy "likes read"  on public.session_likes for select to authenticated
  using (exists (select 1 from workout_sessions s where s.id = session_id and public.can_view_user(s.user_id)));
create policy "likes write" on public.session_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "comments read"  on public.session_comments for select to authenticated
  using (exists (select 1 from workout_sessions s where s.id = session_id and public.can_view_user(s.user_id)));
create policy "comments write" on public.session_comments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "session ratings owner" on public.session_ratings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "exercise prefs owner" on public.exercise_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "badges read"  on public.user_badges for select to authenticated using (public.can_view_user(user_id));
create policy "badges write" on public.user_badges for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

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


-- ───────────────────────── App functions ─────────────────────────
-- Username check during sign-up (the caller is not signed in yet).
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(p_username));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Deletes the caller's account; everything else cascades.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Latest PRs set by the caller's friends (runs with the caller's RLS).
create or replace function public.friends_prs(p_limit int default 10)
returns table (user_id uuid, username text, display_name text, avatar_url text,
               exercise_name text, weight_kg numeric, reps int, finished_at timestamptz)
language sql stable set search_path = public as $$
  select * from (
    select distinct on (s.id, e.exercise_id)
           s.user_id, p.username, p.display_name, p.avatar_url, x.name, e.weight_kg, e.reps, s.finished_at
    from set_entries e
    join workout_sessions s on s.id = e.session_id
    join profiles p on p.id = s.user_id
    join exercises x on x.id = e.exercise_id
    where e.is_pr and s.finished_at is not null and is_friend(auth.uid(), s.user_id)
    order by s.id, e.exercise_id, e.weight_kg desc
  ) t
  order by t.finished_at desc
  limit p_limit;
$$;

-- Members of the caller's home gym who checked in or started a session in the last 2 hours.
create or replace function public.gym_training_now()
returns table (user_id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  with me as (select home_gym_id from profiles where id = auth.uid()),
  active as (
    select c.user_id from gym_checkins c, me
    where c.gym_id = me.home_gym_id and c.checked_in_at > now() - interval '2 hours'
    union
    select s.user_id from workout_sessions s join profiles p on p.id = s.user_id, me
    where p.home_gym_id = me.home_gym_id and s.finished_at is null
      and s.started_at > now() - interval '2 hours'
      and (s.gym_id is null or s.gym_id = me.home_gym_id)  -- not someone training at another gym
  )
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p where p.id in (select user_id from active);
$$;

-- Progress of a challenge in the caller's home gym: the gym total and the caller's part.
create or replace function public.gym_challenge_progress(p_challenge uuid)
returns table (gym_total numeric, my_total numeric)
language sql stable security definer set search_path = public as $$
  with c as (
    select g.* from gym_challenges g
    where g.id = p_challenge
      and g.gym_id = (select home_gym_id from profiles where id = auth.uid())
  ),
  sess as (
    select s.id, s.user_id from workout_sessions s join profiles p on p.id = s.user_id, c
    where p.home_gym_id = c.gym_id and s.finished_at is not null
      and s.started_at >= c.starts_on and s.started_at < c.ends_on + 1
  ),
  per_session as (
    select s.user_id,
      case (select metric from c)
        when 'workouts' then 1::numeric
        when 'volume' then coalesce((select sum(e.weight_kg * coalesce(e.left_reps + e.right_reps, e.reps))
                                     from set_entries e where e.session_id = s.id and e.done and not e.warmup), 0)
        else coalesce((select sum(coalesce(e.left_reps + e.right_reps, e.reps)) from set_entries e, c
                       where e.session_id = s.id and e.done and not e.warmup
                         and (c.exercise_id is null or e.exercise_id = c.exercise_id)), 0)
      end as v
    from sess s
  )
  select coalesce(sum(v), 0), coalesce(sum(v) filter (where user_id = auth.uid()), 0) from per_session;
$$;

-- ───────────────────────── Storage ─────────────────────────
-- Public bucket "avatars"; users may write only to avatars/<their uid>/…
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
