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
  constraint set_entries_weight_cap check (weight_kg <= 1000),
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

-- A plan to train: open to friends and the gym, or an invite to one friend (invitee_id).
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  planned_at timestamptz not null,
  gym_id uuid references public.gyms(id) on delete set null,
  note text not null default '' check (length(note) <= 140),
  invitee_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id is null or invitee_id <> user_id)
);
create index training_plans_when on public.training_plans(planned_at);

-- Who is in (going = true) or can't make it (going = false).
create table public.training_plan_answers (
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  going boolean not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

-- Confirmed by scanning a QR code of owner_id's workout. Written only by confirm_together().
create table public.trained_together (
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (session_id, user_id),
  check (owner_id <> user_id)
);
create index trained_together_when on public.trained_together(confirmed_at desc);

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
  exercise_id uuid references public.exercises(id),   -- older challenges; exercise_ids is what counts
  exercise_ids uuid[] not null default '{}',           -- metric 'reps': which exercises count; empty = all
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

-- Reports of posts, comments and people. Read in the Supabase dashboard, never through the app.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('forum_post','forum_comment','session_comment','user')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

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
-- p_metric: 'volume' | 'workouts' | 'together' (confirmed workouts with someone) | <exercise uuid> (best e1RM, kg) | 'dots:<exercise uuid>' (best e1RM × DOTS).
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
  together as (
    select u.user_id, count(*)::numeric as value
    from (select t.owner_id as user_id, t.confirmed_at from trained_together t
          union all select t.user_id, t.confirmed_at from trained_together t) u, since
    where u.confirmed_at >= since.t and u.user_id in (select id from members)
    group by u.user_id
  ),
  vals as (
    select user_id,
      case
        when (select key from metric) = 'volume'   then sum(weight_kg * work_reps)
        when (select key from metric) = 'workouts' then count(distinct session_id)::numeric
        else max(case when exercise_id::text = (select key from metric)
                      then case when reps <= 1 then weight_kg else weight_kg * (1 + reps / 30.0) end end)
      end as value
    from sets where (select key from metric) <> 'together' group by user_id
    union all
    select t.user_id, t.value from together t where (select key from metric) = 'together'
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
alter table public.reports enable row level security;
alter table public.forum_likes enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_plan_answers enable row level security;
alter table public.trained_together enable row level security;

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

create policy "challenges update" on public.gym_challenges for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and gym_id = (select home_gym_id from profiles where id = auth.uid()));
create policy "challenges delete" on public.gym_challenges for delete to authenticated
  using (created_by = auth.uid());

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
create policy "reports insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
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

create policy "plans read" on public.training_plans for select to authenticated
  using (auth.uid() in (user_id, invitee_id) or (invitee_id is null and public.can_view_user(user_id)));
create policy "plans insert" on public.training_plans for insert to authenticated
  with check (user_id = auth.uid() and (invitee_id is null or public.is_friend(auth.uid(), invitee_id)));
create policy "plans delete" on public.training_plans for delete to authenticated using (user_id = auth.uid());
create policy "plan answers read" on public.training_plan_answers for select to authenticated
  using (exists (select 1 from public.training_plans p where p.id = plan_id));
create policy "plan answers write" on public.training_plan_answers for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.training_plans p where p.id = plan_id));
create policy "together read" on public.trained_together for select to authenticated
  using (auth.uid() in (owner_id, user_id) or public.can_view_user(owner_id) or public.can_view_user(user_id));
create policy "together delete" on public.trained_together for delete to authenticated
  using (auth.uid() in (owner_id, user_id));


-- ───────────────────────── App functions ─────────────────────────
-- What the confirm screen shows for a scanned code: who and which workout, never the numbers.
create or replace function public.together_session(p_session uuid)
returns table (owner_id uuid, username text, display_name text, avatar_url text, name text, finished_at timestamptz, confirmed boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, s.name, s.finished_at,
         exists (select 1 from trained_together t where t.session_id = s.id and t.user_id = auth.uid())
  from workout_sessions s join profiles p on p.id = s.user_id
  where s.id = p_session and auth.uid() is not null;
$$;
revoke execute on function public.together_session(uuid) from public, anon;
grant execute on function public.together_session(uuid) to authenticated;

-- Confirms the caller trained with the owner of a workout finished in the last 12 hours. The two
-- of them count once per workout day, even when each scans the other's code.
create or replace function public.confirm_together(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  done timestamptz;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select s.user_id, s.finished_at into owner, done from workout_sessions s where s.id = p_session;
  if owner is null or done is null then raise exception 'This workout is not finished or synced yet'; end if;
  if owner = me then raise exception 'This is your own code'; end if;
  if done < now() - interval '12 hours' then raise exception 'This code has expired'; end if;
  if exists (
    select 1 from trained_together t
    where t.confirmed_at > now() - interval '12 hours'
      and ((t.owner_id = owner and t.user_id = me) or (t.owner_id = me and t.user_id = owner))
  ) then return; end if;
  insert into trained_together (session_id, owner_id, user_id) values (p_session, owner, me)
    on conflict do nothing;
end;
$$;
revoke execute on function public.confirm_together(uuid) from public, anon;
grant execute on function public.confirm_together(uuid) to authenticated;

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
                         and (cardinality(c.exercise_ids) = 0 or e.exercise_id = any(c.exercise_ids))), 0)
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

-- ───────────────────────── Admin, usage stats, blocking ─────────────────────────
-- Same as supabase/updates/2026-11-03-admin.sql.
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

-- ───────────────────────── Feedback and error reports ─────────────────────────
-- Same as supabase/updates/2026-11-03-feedback.sql.
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

-- ───────────────────────── Forgotten password ─────────────────────────
-- Same as supabase/updates/2026-11-03-password.sql.
create extension if not exists pgcrypto with schema extensions;

-- Same shape as the hashes Supabase Auth writes itself (bcrypt).
create or replace function public.set_account_password(p_user uuid, p_password text) returns void
language sql security definer set search_path = public, extensions as $$
  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
  where id = p_user;
$$;
-- Only the functions below may call it.
revoke all on function public.set_account_password(uuid, text) from public, anon, authenticated;

-- 16 characters from an alphabet without look-alikes (no 0/O, 1/I): 80 random bits.
create or replace function public.random_code(p_length int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(p_length);
  code text := '';
begin
  for i in 0 .. p_length - 1 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- What the user typed, as it was stored: letters and digits only, upper case.
create or replace function public.normalize_code(p_code text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ───────────── Recovery codes ─────────────
-- Only a hash is kept; the code itself is shown to the user once.
create table if not exists public.recovery_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;  -- no policies: functions only

create or replace function public.has_recovery_code() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from recovery_codes where user_id = auth.uid());
$$;

-- A new code for the signed-in user (the old one stops working). Shown as XXXX-XXXX-XXXX-XXXX.
create or replace function public.new_recovery_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  code := random_code(16);
  insert into recovery_codes (user_id, code_hash) values (auth.uid(), crypt(code, gen_salt('bf', 10)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4) || '-' || substr(code, 13, 4);
end;
$$;

-- Failed tries per username, so a code cannot be guessed (10 an hour).
create table if not exists public.password_attempts (
  username text not null,
  at timestamptz not null default now()
);
create index if not exists password_attempts_username on public.password_attempts(username, at);
alter table public.password_attempts enable row level security;  -- no policies: functions only

-- Signed out, from the sign-in screen. Returns 'ok', 'wrong', 'limit' or 'short' (an error would
-- also undo the failed try being counted). The code is used up; the app offers a new one.
create or replace function public.reset_password_with_code(p_username text, p_code text, p_password text)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uname text := lower(trim(coalesce(p_username, '')));
  uid uuid;
  stored text;
begin
  if length(coalesce(p_password, '')) < 8 then return 'short'; end if;
  if (select count(*) from password_attempts where username = uname and at > now() - interval '1 hour') >= 10 then
    return 'limit';
  end if;
  select p.id, r.code_hash into uid, stored
  from profiles p join recovery_codes r on r.user_id = p.id
  where p.username = uname;
  if uid is null or stored <> crypt(normalize_code(p_code), stored) then
    insert into password_attempts (username) values (uname);
    return 'wrong';
  end if;
  perform set_account_password(uid, p_password);
  delete from recovery_codes where user_id = uid;
  delete from password_attempts where username = uname;
  delete from password_resets where user_id = uid;
  return 'ok';
end;
$$;

-- ───────────── Without a code: ask the admin ─────────────
create table if not exists public.password_help (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  user_id uuid references public.profiles(id) on delete cascade,  -- null: no such username
  contact text not null check (length(contact) between 3 and 200),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.password_help enable row level security;  -- no policies: functions only

-- Signed out. Says 'ok' whether or not the username exists, so it cannot be used to find accounts.
create or replace function public.request_password_help(p_username text, p_contact text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  uname text := lower(trim(coalesce(p_username, '')));
  how text := trim(coalesce(p_contact, ''));
begin
  if length(uname) < 3 or length(how) < 3 then return 'short'; end if;
  if (select count(*) from password_help where username = uname and created_at > now() - interval '1 day') >= 3
     or (select count(*) from password_help where created_at > now() - interval '1 day') >= 100 then
    return 'limit';
  end if;
  insert into password_help (username, user_id, contact)
  values (uname, (select id from profiles where username = uname), left(how, 200));
  return 'ok';
end;
$$;

-- ───────────── Temporary passwords ─────────────
-- A row here: the admin set a temporary password, the user must choose their own after signing in.
create table if not exists public.password_resets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.password_resets enable row level security;
drop policy if exists "password resets own" on public.password_resets;
create policy "password resets own" on public.password_resets for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "password resets done" on public.password_resets;
create policy "password resets done" on public.password_resets for delete to authenticated
  using (user_id = auth.uid());

-- ───────────── For the admin ─────────────
create or replace function public.admin_password_help()
returns table (id uuid, username text, user_id uuid, display_name text, contact text,
               created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select h.id, h.username, h.user_id, p.display_name, h.contact, h.created_at
  from password_help h left join profiles p on p.id = h.user_id
  where h.handled_at is null
  order by h.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_password_help_done(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update password_help set handled_at = now() where id = p_id;
end;
$$;

create or replace function public.admin_find_users(p_query text)
returns table (id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  q text := lower(trim(coalesce(p_query, '')));
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.created_at
  from profiles p
  where q <> '' and (p.username like '%' || q || '%' or lower(p.display_name) like '%' || q || '%')
  order by p.username = q desc, p.username
  limit 20;
end;
$$;

-- Returns the temporary password, to give to the user. Their open requests are marked handled.
create or replace function public.admin_reset_password(p_user uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  temp_password text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No such user'; end if;
  temp_password := lower(random_code(10));
  perform set_account_password(p_user, temp_password);
  insert into password_resets (user_id) values (p_user)
  on conflict (user_id) do update set created_at = now();
  update password_help set handled_at = now() where user_id = p_user and handled_at is null;
  return temp_password;
end;
$$;


-- ═════════════════════════ The game layer (updates/2026-11-13-game.sql) ═════════════════════════
-- or ends, and reads treat it as done from then on (settle_* functions are idempotent).

create extension if not exists pgcrypto with schema extensions;

-- ───────────── Gyms: position, manager and the poster's secret key ─────────────
alter table public.gyms add column if not exists lat double precision;
alter table public.gyms add column if not exists lng double precision;

create table if not exists public.gym_secrets (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  secret bytea not null default extensions.gen_random_bytes(32)
);
alter table public.gym_secrets enable row level security;  -- no policies: functions only

create or replace function public.is_gym_manager(p_gym uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from gyms where id = p_gym and created_by = auth.uid());
$$;

-- HMAC-SHA256 of the gym id with its secret, base64url, 22 characters. Never leaves the server
-- except on the manager's poster.
create or replace function public.gym_signature(p_gym uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  k bytea;
begin
  insert into gym_secrets (gym_id) values (p_gym) on conflict do nothing;
  select secret into k from gym_secrets where gym_id = p_gym;
  return left(translate(encode(hmac(convert_to('colosseum-gym:' || p_gym::text, 'UTF8'), k, 'sha256'),
                               'base64'), '+/=', '-_'), 22);
end;
$$;
revoke execute on function public.gym_signature(uuid) from public, anon, authenticated;

-- The poster: the manager stands in the gym and saves its position once, then prints the code.
create or replace function public.gym_poster(p_gym uuid, p_lat double precision default null,
                                             p_lng double precision default null)
returns table (signature text, lat double precision, lng double precision)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_gym_manager(p_gym) then raise exception 'Only the gym''s manager can make its poster'; end if;
  if p_lat is not null and p_lng is not null then
    update gyms set lat = p_lat, lng = p_lng where id = p_gym;
  end if;
  return query select gym_signature(p_gym), g.lat, g.lng from gyms g where g.id = p_gym;
end;
$$;
revoke execute on function public.gym_poster(uuid, double precision, double precision) from public, anon;
grant execute on function public.gym_poster(uuid, double precision, double precision) to authenticated;

create or replace function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))));
$$;

-- ───────────── Gym visits (QR check-in / check-out) ─────────────
create table if not exists public.gym_visits (
  id uuid primary key,                                   -- generated on the device
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  in_code text not null,
  in_at timestamptz not null,
  in_lat float8, in_lng float8, in_acc float8,
  out_code text,
  out_at timestamptz,
  out_lat float8, out_lng float8, out_acc float8,
  in_ok boolean,                                         -- set by the trigger only
  out_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (out_at is null or out_at > in_at)
);
create index if not exists gym_visits_user on public.gym_visits(user_id, in_at desc);
create index if not exists gym_visits_gym on public.gym_visits(gym_id, in_at desc);
alter table public.gym_visits enable row level security;

drop policy if exists "visits owner read" on public.gym_visits;
create policy "visits owner read" on public.gym_visits for select to authenticated using (user_id = auth.uid());
drop policy if exists "visits owner insert" on public.gym_visits;
create policy "visits owner insert" on public.gym_visits for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "visits owner update" on public.gym_visits;
create policy "visits owner update" on public.gym_visits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Checks each scan: the signature, the distance (150 m + up to 50 m of GPS accuracy) and the time
-- (scans saved offline are accepted up to 48 hours late). A written scan never changes again.
create or replace function public.check_gym_visit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g gyms;
  sig text;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.gym_id := old.gym_id; new.in_code := old.in_code;
    new.in_at := old.in_at; new.in_lat := old.in_lat; new.in_lng := old.in_lng;
    new.in_acc := old.in_acc; new.in_ok := old.in_ok;
    if old.out_at is not null then
      new.out_code := old.out_code; new.out_at := old.out_at; new.out_lat := old.out_lat;
      new.out_lng := old.out_lng; new.out_acc := old.out_acc; new.out_ok := old.out_ok;
      return new;
    end if;
  end if;
  select * into g from gyms where id = new.gym_id;
  sig := gym_signature(new.gym_id);
  if tg_op = 'INSERT' then
    new.in_ok := coalesce(new.in_code = sig and g.lat is not null and new.in_lat is not null
      and new.in_at between now() - interval '48 hours' and now() + interval '5 minutes'
      and distance_m(new.in_lat, new.in_lng, g.lat, g.lng) <= 150 + least(coalesce(new.in_acc, 0), 50), false);
  end if;
  if new.out_at is not null then
    new.out_ok := coalesce(new.out_code = sig and new.out_lat is not null
      and new.out_at between now() - interval '48 hours' and now() + interval '5 minutes'
      and distance_m(new.out_lat, new.out_lng, g.lat, g.lng) <= 150 + least(coalesce(new.out_acc, 0), 50), false);
  else
    new.out_ok := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists check_gym_visit on public.gym_visits;
create trigger check_gym_visit before insert or update on public.gym_visits
  for each row execute function public.check_gym_visit();

-- A verified check-in also shows you in "Training now".
create or replace function public.visit_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.in_ok and new.in_at > now() - interval '2 hours' then
    insert into gym_checkins (user_id, gym_id, checked_in_at) values (new.user_id, new.gym_id, new.in_at);
  end if;
  return null;
end;
$$;
drop trigger if exists visit_checkin on public.gym_visits;
create trigger visit_checkin after insert on public.gym_visits
  for each row execute function public.visit_checkin();

-- Same rules as visitStatus() in src/lib/game/visits.ts.
create or replace function public.visit_status(v public.gym_visits) returns text
language sql stable as $$
  select case
    when v.in_ok is false then 'rejected'
    when v.out_at is null then case when now() - v.in_at < interval '3 hours' then 'open' else 'incomplete' end
    when v.out_ok is false then 'incomplete'
    when v.out_at - v.in_at < interval '20 minutes' or v.out_at - v.in_at > interval '4 hours' then 'uncounted'
    when v.in_ok and v.out_ok then 'verified'
    else 'checking' end;
$$;

-- Finished workouts (3+ sets) that started during a verified visit (from 15 min before check-in).
create or replace function public.verified_sessions(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, user_id uuid, started_at timestamptz, prs int)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, s.started_at, least(s.pr_count, 3)
  from workout_sessions s
  where s.finished_at is not null and s.set_count >= 3
    and s.started_at >= p_from and s.started_at < p_to
    and exists (
      select 1 from gym_visits v
      where v.user_id = s.user_id and visit_status(v) = 'verified'
        and s.started_at between v.in_at - interval '15 minutes' and v.out_at);
$$;
revoke execute on function public.verified_sessions(timestamptz, timestamptz) from public, anon, authenticated;

-- ───────────── XP, laurels and denarii per day (computed on the device, capped here) ─────────────
create table if not exists public.game_days (
  id uuid primary key,                                   -- stable per user and day
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  xp int not null default 0 check (xp between 0 and 300),
  laurels int not null default 0 check (laurels between 0 and 45),
  denarii int not null default 0 check (denarii between 0 and 60),
  workouts int not null default 0 check (workouts between 0 and 10),
  prs int not null default 0 check (prs between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table public.game_days enable row level security;
drop policy if exists "game days read" on public.game_days;
create policy "game days read" on public.game_days for select to authenticated using (true);
drop policy if exists "game days write" on public.game_days;
create policy "game days write" on public.game_days for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No future days; without a verified visit around that day, at most 30 denarii.
create or replace function public.guard_game_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.day > (now() + interval '1 day')::date then raise exception 'That day has not come yet'; end if;
  if new.denarii > 30 and not exists (
    select 1 from gym_visits v
    where v.user_id = new.user_id and v.in_at >= new.day - 1 and v.in_at < new.day + 2
      and visit_status(v) = 'verified'
  ) then
    new.denarii := 30;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_game_day on public.game_days;
create trigger guard_game_day before insert or update on public.game_days
  for each row execute function public.guard_game_day();

create table if not exists public.game_carry (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season text not null check (season ~ '^\d{4}-\d{2}$'),
  carry int not null check (carry between 0 and 300),
  updated_at timestamptz not null default now(),
  unique (user_id, season)
);
alter table public.game_carry enable row level security;
drop policy if exists "carry read" on public.game_carry;
create policy "carry read" on public.game_carry for select to authenticated using (true);
drop policy if exists "carry write" on public.game_carry;
create policy "carry write" on public.game_carry for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Laurels won in duels, wars and Bellum. Written by the settle_* functions only.
create table if not exists public.laurel_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season text not null,
  amount int not null check (amount > 0),
  reason text not null check (reason in ('duel','war','bellum')),
  ref_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);
alter table public.laurel_awards enable row level security;
drop policy if exists "awards read" on public.laurel_awards;
create policy "awards read" on public.laurel_awards for select to authenticated using (true);

-- Season table: carry + laurels from workouts + awards.
create or replace function public.get_league(p_scope text, p_season text)
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, value numeric)
language sql stable security definer set search_path = public as $$
  with me as (select id, home_gym_id, global_ranking from profiles where id = auth.uid()),
  members as (
    select p.id from profiles p, me
    where (p_scope <> 'global' and p.id = me.id)
       or (p_scope = 'friends' and is_friend(me.id, p.id))
       or (p_scope = 'gym' and p.home_gym_id is not null and p.home_gym_id = me.home_gym_id)
       or (p_scope = 'global' and me.global_ranking and p.global_ranking)
  ),
  scores as (
    select m.id as user_id,
      coalesce((select c.carry from game_carry c where c.user_id = m.id and c.season = p_season), 0)
      + coalesce((select sum(d.laurels) from game_days d where d.user_id = m.id and to_char(d.day, 'YYYY-MM') = p_season), 0)
      + coalesce((select sum(a.amount) from laurel_awards a where a.user_id = m.id and a.season = p_season), 0) as value
    from members m
  )
  select rank() over (order by s.value desc), p.id, p.username, p.display_name, p.avatar_url, s.value::numeric
  from scores s join profiles p on p.id = s.user_id
  where s.value > 0 or s.user_id = auth.uid()
  order by 1
  limit 500;
$$;
revoke execute on function public.get_league(text, text) from public, anon;
grant execute on function public.get_league(text, text) to authenticated;

-- Another player's XP and season score, for their profile.
create or replace function public.game_profile(p_user uuid, p_season text)
returns table (xp bigint, season_score bigint)
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(d.xp) from game_days d where d.user_id = p_user), 0)::bigint,
         (coalesce((select c.carry from game_carry c where c.user_id = p_user and c.season = p_season), 0)
          + coalesce((select sum(d.laurels) from game_days d where d.user_id = p_user and to_char(d.day, 'YYYY-MM') = p_season), 0)
          + coalesce((select sum(a.amount) from laurel_awards a where a.user_id = p_user and a.season = p_season), 0))::bigint;
$$;
revoke execute on function public.game_profile(uuid, text) from public, anon;
grant execute on function public.game_profile(uuid, text) to authenticated;

-- ───────────── Ludus ─────────────
create table if not exists public.ludi (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 24),
  motto text not null default '' check (char_length(motto) <= 60),
  code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists ludi_name on public.ludi (lower(name));

create table if not exists public.ludus_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ludus_id uuid not null references public.ludi(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','member')),
  joined_at timestamptz not null default now()
);
create index if not exists ludus_members_ludus on public.ludus_members(ludus_id);

alter table public.ludi enable row level security;
alter table public.ludus_members enable row level security;
drop policy if exists "ludi read" on public.ludi;
create policy "ludi read" on public.ludi for select to authenticated using (true);
drop policy if exists "ludus members read" on public.ludus_members;
create policy "ludus members read" on public.ludus_members for select to authenticated using (true);

-- ───────────── Treasuries and buildings ─────────────
create table if not exists public.treasuries (
  owner_kind text not null check (owner_kind in ('ludus','gym')),
  owner_id uuid not null,
  denarii int not null default 0 check (denarii >= 0),
  primary key (owner_kind, owner_id)
);
create table if not exists public.treasury_gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_kind text not null check (owner_kind in ('ludus','gym')),
  owner_id uuid not null,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists treasury_gifts_user on public.treasury_gifts(user_id);
create table if not exists public.buildings (
  owner_kind text not null check (owner_kind in ('ludus','gym')),
  owner_id uuid not null,
  building text not null check (building in ('bench','rack','cable','platform','palisade','barracks','temple')),
  level int not null default 0 check (level between 0 and 5),
  target_level int check (target_level between 1 and 5),
  ready_at timestamptz,
  damaged boolean not null default false,
  primary key (owner_kind, owner_id, building)
);
alter table public.treasuries enable row level security;
alter table public.treasury_gifts enable row level security;
alter table public.buildings enable row level security;
drop policy if exists "treasuries read" on public.treasuries;
create policy "treasuries read" on public.treasuries for select to authenticated using (true);
drop policy if exists "gifts read" on public.treasury_gifts;
create policy "gifts read" on public.treasury_gifts for select to authenticated using (true);
drop policy if exists "buildings read" on public.buildings;
create policy "buildings read" on public.buildings for select to authenticated using (true);

create or replace function public.is_fortress_member(p_kind text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'ludus' then exists (select 1 from ludus_members where user_id = auth.uid() and ludus_id = p_id)
    when 'gym' then exists (select 1 from profiles where id = auth.uid() and home_gym_id = p_id)
    else false end;
$$;

-- Same as BUILDINGS in src/lib/game/fortress.ts.
create or replace function public.building_info(p_building text, out max_level int, out base_cost int, out ludus_only boolean)
language sql immutable as $$
  select case when p_building in ('palisade','barracks') then 5 else 3 end,
         case p_building when 'palisade' then 120 when 'barracks' then 200 when 'temple' then 250 else 150 end,
         p_building = 'barracks';
$$;

-- Finished constructions become the level.
create or replace function public.settle_buildings(p_kind text, p_id uuid) returns void
language sql security definer set search_path = public as $$
  update buildings set level = target_level, target_level = null, ready_at = null
  where owner_kind = p_kind and owner_id = p_id and target_level is not null and ready_at <= now();
$$;
revoke execute on function public.settle_buildings(text, uuid) from public, anon;

-- The level that gives its effect now (0 while damaged).
create or replace function public.working_level(p_kind text, p_id uuid, p_building text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when damaged then 0
                when target_level is not null and ready_at <= now() then target_level
                else level end
    from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building), 0);
$$;

create or replace function public.my_wallet() returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(denarii) from game_days where user_id = auth.uid()), 0)
        - coalesce((select sum(amount) from treasury_gifts where user_id = auth.uid()), 0))::int;
$$;
revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

create or replace function public.donate(p_kind text, p_id uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Give at least 1 denarius'; end if;
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || auth.uid()::text));
  if my_wallet() < p_amount then raise exception 'You do not have that many denarii'; end if;
  insert into treasury_gifts (user_id, owner_kind, owner_id, amount) values (auth.uid(), p_kind, p_id, p_amount);
  insert into treasuries (owner_kind, owner_id, denarii) values (p_kind, p_id, p_amount)
  on conflict (owner_kind, owner_id) do update set denarii = treasuries.denarii + excluded.denarii;
end;
$$;
revoke execute on function public.donate(text, uuid, int) from public, anon;
grant execute on function public.donate(text, uuid, int) to authenticated;

-- Pays from the treasury or fails.
create or replace function public.spend_treasury(p_kind text, p_id uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update treasuries set denarii = denarii - p_amount
  where owner_kind = p_kind and owner_id = p_id and denarii >= p_amount;
  if not found then raise exception 'The treasury needs % denarii', p_amount; end if;
end;
$$;
revoke execute on function public.spend_treasury(text, uuid, int) from public, anon, authenticated;

create or replace function public.start_building(p_kind text, p_id uuid, p_building text) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  info record;
  cur int;
  next_level int;
  cost int;
  ready timestamptz;
begin
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('fortress:' || p_kind || p_id::text));
  perform settle_buildings(p_kind, p_id);
  select * into info from building_info(p_building);
  if info.ludus_only and p_kind <> 'ludus' then raise exception 'Only a ludus builds barracks'; end if;
  if exists (select 1 from buildings where owner_kind = p_kind and owner_id = p_id and target_level is not null) then
    raise exception 'Something is being built already';
  end if;
  if exists (select 1 from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building and damaged) then
    raise exception 'Repair it first';
  end if;
  cur := coalesce((select level from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building), 0);
  next_level := cur + 1;
  if next_level > info.max_level then raise exception 'It is at the top level'; end if;
  cost := info.base_cost * next_level * (case when p_kind = 'gym' then 3 else 1 end);
  perform spend_treasury(p_kind, p_id, cost);
  ready := now() + make_interval(days => next_level);
  insert into buildings (owner_kind, owner_id, building, level, target_level, ready_at)
  values (p_kind, p_id, p_building, cur, next_level, ready)
  on conflict (owner_kind, owner_id, building) do update set target_level = next_level, ready_at = ready;
  return ready;
end;
$$;
revoke execute on function public.start_building(text, uuid, text) from public, anon;
grant execute on function public.start_building(text, uuid, text) to authenticated;

create or replace function public.repair_building(p_kind text, p_id uuid, p_building text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  lvl int;
begin
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('fortress:' || p_kind || p_id::text));
  select level into lvl from buildings
  where owner_kind = p_kind and owner_id = p_id and building = p_building and damaged;
  if lvl is null then raise exception 'Nothing to repair'; end if;
  perform spend_treasury(p_kind, p_id,
    ceil((select base_cost from building_info(p_building)) * greatest(lvl, 1)
         * (case when p_kind = 'gym' then 3 else 1 end) * 0.4)::int);
  update buildings set damaged = false where owner_kind = p_kind and owner_id = p_id and building = p_building;
end;
$$;
revoke execute on function public.repair_building(text, uuid, text) from public, anon;
grant execute on function public.repair_building(text, uuid, text) to authenticated;

-- ───────────── Ludus membership ─────────────
create or replace function public.ludus_limit(p_ludus uuid) returns int
language sql stable security definer set search_path = public as $$
  select least(10, 5 + working_level('ludus', p_ludus, 'barracks'));
$$;

create or replace function public.create_ludus(p_name text, p_motto text default '') returns uuid
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from ludus_members where user_id = auth.uid()) then raise exception 'Leave your ludus first'; end if;
  if exists (select 1 from ludi where lower(name) = lower(trim(p_name))) then raise exception 'That name is taken'; end if;
  insert into ludi (name, motto, code, created_by)
  values (trim(p_name), coalesce(trim(p_motto), ''), random_code(6), auth.uid()) returning id into new_id;
  insert into ludus_members (user_id, ludus_id, role) values (auth.uid(), new_id, 'leader');
  return new_id;
end;
$$;
revoke execute on function public.create_ludus(text, text) from public, anon;
grant execute on function public.create_ludus(text, text) to authenticated;

create or replace function public.join_ludus(p_code text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into target from ludi where code = upper(trim(p_code));
  if target is null then raise exception 'No ludus has that code'; end if;
  if exists (select 1 from ludus_members where user_id = auth.uid() and ludus_id = target) then return target; end if;
  if exists (select 1 from ludus_members where user_id = auth.uid()) then raise exception 'Leave your ludus first'; end if;
  perform pg_advisory_xact_lock(hashtext('ludus:' || target::text));
  if (select count(*) from ludus_members where ludus_id = target) >= ludus_limit(target) then
    raise exception 'This ludus is full. Barracks make room for more.';
  end if;
  insert into ludus_members (user_id, ludus_id) values (auth.uid(), target);
  return target;
end;
$$;
revoke execute on function public.join_ludus(text) from public, anon;
grant execute on function public.join_ludus(text) to authenticated;

create or replace function public.leave_ludus() returns void
language sql security definer set search_path = public as $$
  delete from ludus_members where user_id = auth.uid();
$$;
revoke execute on function public.leave_ludus() from public, anon;
grant execute on function public.leave_ludus() to authenticated;

create or replace function public.remove_ludus_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from ludus_members me join ludus_members them on them.ludus_id = me.ludus_id
    where me.user_id = auth.uid() and me.role = 'leader' and them.user_id = p_user and p_user <> auth.uid()
  ) then raise exception 'Only the leader can remove members'; end if;
  delete from ludus_members where user_id = p_user;
end;
$$;
revoke execute on function public.remove_ludus_member(uuid) from public, anon;
grant execute on function public.remove_ludus_member(uuid) to authenticated;

-- When someone leaves (or deletes their account): the longest member leads; the last one out
-- closes the ludus with its treasury and fortress.
create or replace function public.ludus_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ludus_members where ludus_id = old.ludus_id) then
    delete from treasuries where owner_kind = 'ludus' and owner_id = old.ludus_id;
    delete from buildings where owner_kind = 'ludus' and owner_id = old.ludus_id;
    delete from ludi where id = old.ludus_id;
  elsif not exists (select 1 from ludus_members where ludus_id = old.ludus_id and role = 'leader') then
    update ludus_members set role = 'leader'
    where user_id = (select user_id from ludus_members where ludus_id = old.ludus_id order by joined_at limit 1);
  end if;
  return null;
end;
$$;
drop trigger if exists ludus_member_left on public.ludus_members;
create trigger ludus_member_left after delete on public.ludus_members
  for each row execute function public.ludus_member_left();

-- Ludi to look at or fight, with their size.
create or replace function public.ludus_directory(p_query text default '')
returns table (id uuid, name text, motto text, members bigint)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.motto, count(m.user_id)
  from ludi l left join ludus_members m on m.ludus_id = l.id
  where coalesce(p_query, '') = '' or l.name ilike '%' || p_query || '%'
  group by l.id
  order by count(m.user_id) desc, l.name
  limit 30;
$$;
revoke execute on function public.ludus_directory(text) from public, anon;
grant execute on function public.ludus_directory(text) to authenticated;

-- ───────────── Ludus wars ─────────────
create table if not exists public.ludus_wars (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.ludi(id) on delete cascade,
  defender_id uuid not null references public.ludi(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  attacker_active int not null,
  defender_active int not null,
  defender_palisade int not null default 0,
  attacker_score numeric,
  defender_score numeric,
  winner_id uuid,
  spoils int,
  damaged_building text,
  settled_at timestamptz,
  check (attacker_id <> defender_id)
);
create index if not exists ludus_wars_sides on public.ludus_wars(attacker_id, defender_id, starts_at desc);
alter table public.ludus_wars enable row level security;
drop policy if exists "wars read" on public.ludus_wars;
create policy "wars read" on public.ludus_wars for select to authenticated using (true);

-- Members who trained in the 14 days before, at least 3.
create or replace function public.ludus_active(p_ludus uuid, p_at timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select greatest(3, count(distinct m.user_id))::int
  from ludus_members m join workout_sessions s on s.user_id = m.user_id
  where m.ludus_id = p_ludus and s.finished_at is not null and s.set_count >= 3
    and s.started_at >= p_at - interval '14 days' and s.started_at < p_at;
$$;

-- Raw points of a side: 10 a verified workout (2 a day), +5 a PR (3 a workout), +5 a day trained.
create or replace function public.war_points(p_ludus uuid, p_from timestamptz, p_to timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  with w as (
    select v.user_id, v.prs,
           row_number() over (partition by v.user_id, (v.started_at at time zone 'UTC')::date order by v.started_at) as n
    from verified_sessions(p_from, p_to) v
    join ludus_members m on m.user_id = v.user_id and m.ludus_id = p_ludus
  )
  select coalesce(sum(10 + 5 * prs + case when n = 1 then 5 else 0 end), 0) from w where n <= 2;
$$;

create or replace function public.war_scores(p_war uuid)
returns table (attacker_points numeric, defender_points numeric, attacker_score numeric, defender_score numeric)
language sql stable security definer set search_path = public as $$
  with w as (select * from ludus_wars where id = p_war),
  pts as (
    select war_points(w.attacker_id, w.starts_at, least(now(), w.ends_at)) a,
           war_points(w.defender_id, w.starts_at, least(now(), w.ends_at)) d, w.*
    from w
  )
  select a, d, round(a / greatest(3, attacker_active), 1),
         round(d / greatest(3, defender_active) * (1 + 0.05 * defender_palisade), 1)
  from pts;
$$;
revoke execute on function public.war_scores(uuid) from public, anon;
grant execute on function public.war_scores(uuid) to authenticated;

create or replace function public.declare_war(p_defender uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  mine uuid;
  war_id uuid;
begin
  select ludus_id into mine from ludus_members where user_id = auth.uid() and role = 'leader';
  if mine is null then raise exception 'Only a ludus leader can declare war'; end if;
  if mine = p_defender then raise exception 'That is your own ludus'; end if;
  perform settle_war(w.id) from ludus_wars w
    where w.settled_at is null and w.ends_at <= now() and (mine in (w.attacker_id, w.defender_id) or p_defender in (w.attacker_id, w.defender_id));
  if (select count(*) from ludus_members where ludus_id = mine) < 3 then raise exception 'Your ludus needs 3 members to fight'; end if;
  if (select count(*) from ludus_members where ludus_id = p_defender) < 3 then raise exception 'They need 3 members to fight'; end if;
  if exists (select 1 from ludus_wars where settled_at is null
             and (mine in (attacker_id, defender_id) or p_defender in (attacker_id, defender_id))) then
    raise exception 'One of you is at war already';
  end if;
  if exists (select 1 from ludus_wars where starts_at > now() - interval '7 days'
             and ((attacker_id = mine and defender_id = p_defender) or (attacker_id = p_defender and defender_id = mine))) then
    raise exception 'You fought them this week already';
  end if;
  insert into ludus_wars (attacker_id, defender_id, ends_at, attacker_active, defender_active, defender_palisade)
  values (mine, p_defender, now() + interval '3 days', ludus_active(mine, now()), ludus_active(p_defender, now()),
          working_level('ludus', p_defender, 'palisade'))
  returning id into war_id;
  return war_id;
end;
$$;
revoke execute on function public.declare_war(uuid) from public, anon;
grant execute on function public.declare_war(uuid) to authenticated;

-- After the window: the winner takes spoils and laurels, the loser gets one building damaged.
-- Nothing is deleted. Whoever opens the war first settles it; running it again does nothing.
create or replace function public.settle_war(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w ludus_wars;
  s record;
  winner uuid;
  loser uuid;
  loot int;
  hit text;
begin
  select * into w from ludus_wars where id = p_war for update;
  if w.id is null or w.settled_at is not null or w.ends_at > now() then return; end if;
  select * into s from war_scores(p_war);
  if s.attacker_score > s.defender_score then winner := w.attacker_id; loser := w.defender_id;
  else winner := w.defender_id; loser := w.attacker_id; end if;
  loot := least(300, floor(coalesce((select denarii from treasuries where owner_kind = 'ludus' and owner_id = loser), 0) * 0.2))::int;
  if loot > 0 then
    update treasuries set denarii = denarii - loot where owner_kind = 'ludus' and owner_id = loser;
    insert into treasuries (owner_kind, owner_id, denarii) values ('ludus', winner, loot)
    on conflict (owner_kind, owner_id) do update set denarii = treasuries.denarii + loot;
  end if;
  perform settle_buildings('ludus', loser);
  select building into hit from buildings
  where owner_kind = 'ludus' and owner_id = loser and level > 0 and not damaged
  order by level desc, building limit 1;
  if hit is not null then
    update buildings set damaged = true where owner_kind = 'ludus' and owner_id = loser and building = hit;
  end if;
  insert into laurel_awards (user_id, season, amount, reason, ref_id)
  select m.user_id, to_char(w.ends_at, 'YYYY-MM'), 30, 'war', w.id::text
  from ludus_members m where m.ludus_id = winner
  on conflict do nothing;
  update ludus_wars set attacker_score = s.attacker_score, defender_score = s.defender_score,
    winner_id = winner, spoils = loot, damaged_building = hit, settled_at = now()
  where id = p_war;
end;
$$;
revoke execute on function public.settle_war(uuid) from public, anon;
grant execute on function public.settle_war(uuid) to authenticated;

-- ───────────── Duels ─────────────
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('workouts','lift')),
  exercise_id uuid references public.exercises(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','declined','done')),
  starts_at timestamptz,
  ends_at timestamptz,
  challenger_score numeric,
  opponent_score numeric,
  winner_id uuid,
  created_at timestamptz not null default now(),
  check (challenger_id <> opponent_id),
  check (kind = 'workouts' or exercise_id is not null)
);
create index if not exists duels_players on public.duels(challenger_id, opponent_id);
alter table public.duels enable row level security;
drop policy if exists "duels read" on public.duels;
create policy "duels read" on public.duels for select to authenticated
  using (auth.uid() in (challenger_id, opponent_id));
drop policy if exists "duels withdraw" on public.duels;
create policy "duels withdraw" on public.duels for delete to authenticated
  using (challenger_id = auth.uid() and status = 'pending');

create or replace function public.e1rm(p_weight numeric, p_reps int) returns numeric
language sql immutable as $$
  select case when p_reps <= 0 then 0 when p_reps = 1 then p_weight else p_weight * (1 + p_reps / 30.0) end;
$$;

-- Same as duelScore() in src/lib/game/battles.ts.
create or replace function public.duel_score(p_user uuid, p_kind text, p_exercise uuid,
                                             p_from timestamptz, p_to timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p_kind = 'workouts' then (
    select count(*)::numeric from workout_sessions s
    where s.user_id = p_user and s.finished_at is not null and s.set_count >= 3
      and s.started_at >= p_from and s.started_at < p_to)
  else (
    with b as (
      select max(e1rm(e.weight_kg, e.reps)) filter (where s.started_at < p_from) before,
             max(e1rm(e.weight_kg, e.reps)) filter (where s.started_at >= p_from and s.started_at < p_to) during
      from set_entries e join workout_sessions s on s.id = e.session_id
      where s.user_id = p_user and s.finished_at is not null and e.exercise_id = p_exercise
        and e.done and not e.warmup and e.drop_of is null
    )
    select case when before is null then 0 else greatest(0, round(coalesce(during, 0) - before, 1)) end from b)
  end;
$$;
revoke execute on function public.duel_score(uuid, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.duel_scores(p_duel uuid)
returns table (challenger numeric, opponent numeric)
language sql stable security definer set search_path = public as $$
  select duel_score(d.challenger_id, d.kind, d.exercise_id, d.starts_at, least(now(), d.ends_at)),
         duel_score(d.opponent_id, d.kind, d.exercise_id, d.starts_at, least(now(), d.ends_at))
  from duels d where d.id = p_duel and d.starts_at is not null and auth.uid() in (d.challenger_id, d.opponent_id);
$$;
revoke execute on function public.duel_scores(uuid) from public, anon;
grant execute on function public.duel_scores(uuid) to authenticated;

create or replace function public.create_duel(p_opponent uuid, p_kind text, p_exercise uuid default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not is_friend(auth.uid(), p_opponent) then raise exception 'You can challenge friends only'; end if;
  if exists (select 1 from duels where status in ('pending','active')
             and ((challenger_id = auth.uid() and opponent_id = p_opponent) or (challenger_id = p_opponent and opponent_id = auth.uid()))) then
    raise exception 'You have a duel with them already';
  end if;
  insert into duels (challenger_id, opponent_id, kind, exercise_id)
  values (auth.uid(), p_opponent, p_kind, case when p_kind = 'lift' then p_exercise end)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.create_duel(uuid, text, uuid) from public, anon;
grant execute on function public.create_duel(uuid, text, uuid) to authenticated;

create or replace function public.answer_duel(p_duel uuid, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update duels set
    status = case when p_accept then 'active' else 'declined' end,
    starts_at = case when p_accept then now() end,
    ends_at = case when p_accept then now() + interval '7 days' end
  where id = p_duel and opponent_id = auth.uid() and status = 'pending';
  if not found then raise exception 'This duel is not waiting for you'; end if;
end;
$$;
revoke execute on function public.answer_duel(uuid, boolean) from public, anon;
grant execute on function public.answer_duel(uuid, boolean) to authenticated;

create or replace function public.settle_duel(p_duel uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  d duels;
  a numeric;
  b numeric;
  win uuid;
begin
  select * into d from duels where id = p_duel for update;
  if d.id is null or d.status <> 'active' or d.ends_at > now() then return; end if;
  a := duel_score(d.challenger_id, d.kind, d.exercise_id, d.starts_at, d.ends_at);
  b := duel_score(d.opponent_id, d.kind, d.exercise_id, d.starts_at, d.ends_at);
  win := case when a > b then d.challenger_id when b > a then d.opponent_id end;
  if win is not null then
    insert into laurel_awards (user_id, season, amount, reason, ref_id)
    values (win, to_char(d.ends_at, 'YYYY-MM'), 25, 'duel', d.id::text) on conflict do nothing;
  end if;
  update duels set status = 'done', challenger_score = a, opponent_score = b, winner_id = win where id = p_duel;
end;
$$;
revoke execute on function public.settle_duel(uuid) from public, anon;
grant execute on function public.settle_duel(uuid) to authenticated;

-- ───────────── Bellum: the gyms of a city, every month ─────────────
create table if not exists public.bellum_results (
  city text not null,
  month text not null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  score numeric not null,
  place int not null,
  primary key (city, month, gym_id)
);
alter table public.bellum_results enable row level security;
drop policy if exists "bellum read" on public.bellum_results;
create policy "bellum read" on public.bellum_results for select to authenticated using (true);

-- Verified visit days at the home gym per active member (at least 3 to rank), with the palisade.
create or replace function public.bellum_table(p_city text, p_month text)
returns table (gym_id uuid, name text, active bigint, visit_days bigint, palisade int, score numeric, place bigint)
language sql stable security definer set search_path = public as $$
  with span as (
    select to_date(p_month || '-01', 'YYYY-MM-DD')::timestamptz as a,
           (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamptz as b
  ),
  gyms_in as (select g.id, g.name from gyms g where lower(trim(g.city)) = lower(trim(p_city))),
  days as (
    select p.home_gym_id as gym_id, v.user_id, count(distinct (v.in_at at time zone 'UTC')::date) as d
    from gym_visits v join profiles p on p.id = v.user_id, span
    where v.gym_id = p.home_gym_id and v.in_at >= span.a and v.in_at < span.b
      and p.home_gym_id in (select id from gyms_in) and visit_status(v) = 'verified'
    group by p.home_gym_id, v.user_id
  ),
  t as (
    select g.id, g.name, count(d.user_id) as active, coalesce(sum(d.d), 0)::bigint as visit_days,
           working_level('gym', g.id, 'palisade') as palisade
    from gyms_in g left join days d on d.gym_id = g.id
    group by g.id, g.name
  )
  select t.id, t.name, t.active, t.visit_days, t.palisade,
         case when t.active >= 3 then round(t.visit_days::numeric / t.active * (1 + 0.02 * t.palisade), 2) end,
         rank() over (order by case when t.active >= 3 then t.visit_days::numeric / t.active * (1 + 0.02 * t.palisade) end desc nulls last)
  from t
  order by 7, t.name;
$$;
revoke execute on function public.bellum_table(text, text) from public, anon, authenticated;

create or replace function public.bellum_standings(p_month text)
returns table (gym_id uuid, name text, active bigint, visit_days bigint, palisade int, score numeric, place bigint)
language sql stable security definer set search_path = public as $$
  select b.* from profiles p join gyms g on g.id = p.home_gym_id,
       bellum_table(g.city, p_month) b
  where p.id = auth.uid() and g.city is not null and trim(g.city) <> '';
$$;
revoke execute on function public.bellum_standings(text) from public, anon;
grant execute on function public.bellum_standings(text) to authenticated;

-- Closes a finished month for the caller's city: saves the table and gives the winning gym's
-- active members their laurels. Running it again does nothing.
create or replace function public.settle_bellum(p_month text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  c text;
  win uuid;
begin
  select lower(trim(g.city)) into c from profiles p join gyms g on g.id = p.home_gym_id where p.id = auth.uid();
  if c is null or c = '' then return; end if;
  if to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month' > now() then return; end if;
  perform pg_advisory_xact_lock(hashtext('bellum:' || c || p_month));
  if exists (select 1 from bellum_results where city = c and month = p_month) then return; end if;
  insert into bellum_results (city, month, gym_id, score, place)
  select c, p_month, b.gym_id, b.score, b.place from bellum_table(c, p_month) b where b.score is not null;
  select gym_id into win from bellum_results where city = c and month = p_month and place = 1 limit 1;
  if win is null then return; end if;
  insert into laurel_awards (user_id, season, amount, reason, ref_id)
  select distinct v.user_id, to_char(now(), 'YYYY-MM'), 40, 'bellum', c || ':' || p_month
  from gym_visits v join profiles p on p.id = v.user_id
  where p.home_gym_id = win and v.gym_id = win and visit_status(v) = 'verified'
    and to_char(v.in_at, 'YYYY-MM') = p_month
  on conflict do nothing;
end;
$$;
revoke execute on function public.settle_bellum(text) from public, anon;
grant execute on function public.settle_bellum(text) to authenticated;

-- The temple's hall of records: the ludus's best squat, bench and deadlift (e1RM) and who lifted it.
create or replace function public.ludus_records(p_ludus uuid)
returns table (lift text, user_id uuid, display_name text, e1rm numeric)
language sql stable security definer set search_path = public as $$
  select distinct on (x.name) x.name, p.id, p.display_name, round(e1rm(e.weight_kg, e.reps), 1)
  from ludus_members m
  join workout_sessions s on s.user_id = m.user_id and s.finished_at is not null
  join set_entries e on e.session_id = s.id and e.done and not e.warmup and e.drop_of is null
  join exercises x on x.id = e.exercise_id and x.created_by is null and x.name in ('Squat','Bench Press','Deadlift')
  join profiles p on p.id = m.user_id
  where m.ludus_id = p_ludus
  order by x.name, e1rm(e.weight_kg, e.reps) desc;
$$;
revoke execute on function public.ludus_records(uuid) from public, anon;
grant execute on function public.ludus_records(uuid) to authenticated;


-- ═════════════════════════ Gloria and the ludus ranking (updates/2026-11-13-gloria.sql) ═════════════════════════

alter table public.ludi add column if not exists gloria int not null default 0 check (gloria >= 0);
alter table public.ludi add column if not exists best_gloria int not null default 0;
alter table public.ludi add column if not exists wins int not null default 0;
alter table public.ludi add column if not exists losses int not null default 0;
alter table public.ludi add column if not exists defences int not null default 0;  -- won as defender
alter table public.ludi add column if not exists upsets int not null default 0;    -- won against more gloria
alter table public.ludi add column if not exists streak int not null default 0;
alter table public.ludi add column if not exists best_streak int not null default 0;

-- Gloria each side won or lost in the war (null until settled).
alter table public.ludus_wars add column if not exists attacker_gloria int;
alter table public.ludus_wars add column if not exists defender_gloria int;

-- Applies a settled war to both records. Same as gloriaChange() and applyWar() in gloria.ts.
-- Runs once per war: a war with its gloria set is skipped.
create or replace function public.apply_war_gloria(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w ludus_wars;
  loser uuid;
  wg int;
  lg int;
  ws numeric;
  ls numeric;
  win_change int;
  lose_change int;
begin
  select * into w from ludus_wars where id = p_war for update;
  if w.id is null or w.settled_at is null or w.winner_id is null or w.attacker_gloria is not null then
    return;
  end if;
  if w.winner_id = w.attacker_id then
    loser := w.defender_id; ws := w.attacker_score; ls := w.defender_score;
  else
    loser := w.attacker_id; ws := w.defender_score; ls := w.attacker_score;
  end if;
  select gloria into wg from ludi where id = w.winner_id for update;
  select gloria into lg from ludi where id = loser for update;
  win_change := 30 + least(30, greatest(0, lg - wg) / 10);
  lose_change := case
    when coalesce(ws, 0) <= 0 or coalesce(ls, 0) >= ws * 0.9 or lg <= 0 then 0
    else -least(10, lg) end;

  update ludi set
    gloria = gloria + win_change,
    best_gloria = greatest(best_gloria, gloria + win_change),
    wins = wins + 1,
    defences = defences + (w.winner_id = w.defender_id)::int,
    upsets = upsets + (lg > wg)::int,
    streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
  where id = w.winner_id;
  update ludi set gloria = greatest(0, gloria + lose_change), losses = losses + 1, streak = 0
  where id = loser;

  update ludus_wars set
    attacker_gloria = case when w.winner_id = w.attacker_id then win_change else lose_change end,
    defender_gloria = case when w.winner_id = w.defender_id then win_change else lose_change end
  where id = p_war;
end;
$$;
revoke execute on function public.apply_war_gloria(uuid) from public, anon, authenticated;

-- settle_war from 2026-11-13-game.sql, now also giving gloria.
create or replace function public.settle_war(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w ludus_wars;
  s record;
  winner uuid;
  loser uuid;
  loot int;
  hit text;
begin
  select * into w from ludus_wars where id = p_war for update;
  if w.id is null or w.settled_at is not null or w.ends_at > now() then return; end if;
  select * into s from war_scores(p_war);
  if s.attacker_score > s.defender_score then winner := w.attacker_id; loser := w.defender_id;
  else winner := w.defender_id; loser := w.attacker_id; end if;
  loot := least(300, floor(coalesce((select denarii from treasuries where owner_kind = 'ludus' and owner_id = loser), 0) * 0.2))::int;
  if loot > 0 then
    update treasuries set denarii = denarii - loot where owner_kind = 'ludus' and owner_id = loser;
    insert into treasuries (owner_kind, owner_id, denarii) values ('ludus', winner, loot)
    on conflict (owner_kind, owner_id) do update set denarii = treasuries.denarii + loot;
  end if;
  perform settle_buildings('ludus', loser);
  select building into hit from buildings
  where owner_kind = 'ludus' and owner_id = loser and level > 0 and not damaged
  order by level desc, building limit 1;
  if hit is not null then
    update buildings set damaged = true where owner_kind = 'ludus' and owner_id = loser and building = hit;
  end if;
  insert into laurel_awards (user_id, season, amount, reason, ref_id)
  select m.user_id, to_char(w.ends_at, 'YYYY-MM'), 30, 'war', w.id::text
  from ludus_members m where m.ludus_id = winner
  on conflict do nothing;
  update ludus_wars set attacker_score = s.attacker_score, defender_score = s.defender_score,
    winner_id = winner, spoils = loot, damaged_building = hit, settled_at = now()
  where id = p_war;
  perform apply_war_gloria(p_war);
end;
$$;
revoke execute on function public.settle_war(uuid) from public, anon;
grant execute on function public.settle_war(uuid) to authenticated;

-- Wars settled before this update get their gloria, oldest first.
do $$
declare
  r record;
begin
  for r in select id from public.ludus_wars
           where settled_at is not null and attacker_gloria is null
           order by settled_at, id loop
    perform public.apply_war_gloria(r.id);
  end loop;
end;
$$;

-- The ludus ranking: the top 50 by gloria, plus p_ludus (your own) wherever it stands.
create or replace function public.ludus_ranking(p_ludus uuid default null)
returns table (place bigint, id uuid, name text, motto text, members bigint, gloria int,
               best_gloria int, wins int, losses int, defences int, upsets int, streak int,
               best_streak int)
language sql stable security definer set search_path = public as $$
  with t as (
    select row_number() over (order by l.gloria desc, l.wins desc, l.created_at) as place,
           l.id, l.name, l.motto,
           (select count(*) from ludus_members m where m.ludus_id = l.id) as members,
           l.gloria, l.best_gloria, l.wins, l.losses, l.defences, l.upsets, l.streak, l.best_streak
    from ludi l
  )
  select * from t where place <= 50 or id = p_ludus order by place;
$$;
revoke execute on function public.ludus_ranking(uuid) from public, anon;
grant execute on function public.ludus_ranking(uuid) to authenticated;


-- ═════════════════════════ Wars with 2 members (updates/2026-11-13-war-two-members.sql) ═════════════════════════
-- Members who trained in the 14 days before, at least 2.
create or replace function public.ludus_active(p_ludus uuid, p_at timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select greatest(2, count(distinct m.user_id))::int
  from ludus_members m join workout_sessions s on s.user_id = m.user_id
  where m.ludus_id = p_ludus and s.finished_at is not null and s.set_count >= 3
    and s.started_at >= p_at - interval '14 days' and s.started_at < p_at;
$$;

create or replace function public.war_scores(p_war uuid)
returns table (attacker_points numeric, defender_points numeric, attacker_score numeric, defender_score numeric)
language sql stable security definer set search_path = public as $$
  with w as (select * from ludus_wars where id = p_war),
  pts as (
    select war_points(w.attacker_id, w.starts_at, least(now(), w.ends_at)) a,
           war_points(w.defender_id, w.starts_at, least(now(), w.ends_at)) d, w.*
    from w
  )
  select a, d, round(a / greatest(2, attacker_active), 1),
         round(d / greatest(2, defender_active) * (1 + 0.05 * defender_palisade), 1)
  from pts;
$$;
revoke execute on function public.war_scores(uuid) from public, anon;
grant execute on function public.war_scores(uuid) to authenticated;

create or replace function public.declare_war(p_defender uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  mine uuid;
  war_id uuid;
begin
  select ludus_id into mine from ludus_members where user_id = auth.uid() and role = 'leader';
  if mine is null then raise exception 'Only a ludus leader can declare war'; end if;
  if mine = p_defender then raise exception 'That is your own ludus'; end if;
  perform settle_war(w.id) from ludus_wars w
    where w.settled_at is null and w.ends_at <= now() and (mine in (w.attacker_id, w.defender_id) or p_defender in (w.attacker_id, w.defender_id));
  if (select count(*) from ludus_members where ludus_id = mine) < 2 then raise exception 'Your ludus needs 2 members to fight'; end if;
  if (select count(*) from ludus_members where ludus_id = p_defender) < 2 then raise exception 'They need 2 members to fight'; end if;
  if exists (select 1 from ludus_wars where settled_at is null
             and (mine in (attacker_id, defender_id) or p_defender in (attacker_id, defender_id))) then
    raise exception 'One of you is at war already';
  end if;
  if exists (select 1 from ludus_wars where starts_at > now() - interval '7 days'
             and ((attacker_id = mine and defender_id = p_defender) or (attacker_id = p_defender and defender_id = mine))) then
    raise exception 'You fought them this week already';
  end if;
  insert into ludus_wars (attacker_id, defender_id, ends_at, attacker_active, defender_active, defender_palisade)
  values (mine, p_defender, now() + interval '3 days', ludus_active(mine, now()), ludus_active(p_defender, now()),
          working_level('ludus', p_defender, 'palisade'))
  returning id into war_id;
  return war_id;
end;
$$;
revoke execute on function public.declare_war(uuid) from public, anon;
grant execute on function public.declare_war(uuid) to authenticated;

-- ═════════════════════════ The city and the map (updates/2026-11-14-city.sql) ═════════════════════════

-- ───────────── Gladiator: style and gear ─────────────
create table if not exists public.gladiators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  style text check (style in ('murmillo','thraex','retiarius','secutor','hoplomachus','bestiarius')),
  style_season text,                          -- "2026-11": changed at most once a season
  styles jsonb not null default '[]',         -- [{id, since}] oldest first, for past XP
  helmet text, weapon text, shield text, guard text, armour text,
  power int not null default 120,
  updated_at timestamptz not null default now()
);
alter table public.gladiators enable row level security;
drop policy if exists "gladiators read" on public.gladiators;
create policy "gladiators read" on public.gladiators for select to authenticated using (true);

create table if not exists public.gear_purchases (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null,
  price int not null check (price > 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, item)
);
alter table public.gear_purchases enable row level security;
drop policy if exists "purchases read" on public.gear_purchases;
create policy "purchases read" on public.gear_purchases for select to authenticated using (user_id = auth.uid());

-- Same as GEAR_ITEMS in src/lib/game/gear.ts: slot, power and how a piece opens.
create or replace function public.gear_info(p_item text, out slot text, out power int, out kind text, out amount int)
language sql immutable as $$
  select x.slot, x.power, x.kind, x.amount from (values
    ('helmet_galea','helmet',40,'start',0), ('helmet_murmillo','helmet',60,'denarii',200),
    ('helmet_secutor','helmet',70,'denarii',320), ('helmet_thraex','helmet',70,'level',15),
    ('helmet_hoplomachus','helmet',75,'verified',50), ('helmet_provocator','helmet',80,'level',25),
    ('helmet_galea_gold','helmet',90,'league',350), ('helmet_laurel','helmet',100,'level',40),
    ('weapon_rudis','weapon',20,'start',0), ('weapon_pugio','weapon',50,'denarii',100),
    ('weapon_sica','weapon',60,'level',10), ('weapon_net','weapon',65,'level',20),
    ('weapon_trident','weapon',70,'verified',30), ('weapon_hasta','weapon',75,'denarii',250),
    ('weapon_gladius','weapon',80,'denarii',150), ('weapon_two_gladii','weapon',100,'verified',75),
    ('shield_parmula','shield',30,'start',0), ('shield_parma','shield',50,'denarii',120),
    ('shield_bronze','shield',60,'level',8), ('shield_scutum','shield',110,'denarii',350),
    ('guard_fasciae','guard',20,'start',0), ('guard_ocreae','guard',60,'level',12),
    ('guard_galerus','guard',65,'verified',40), ('guard_manica','guard',70,'denarii',180),
    ('armour_tunic','armour',10,'start',0), ('armour_exomis','armour',30,'denarii',80),
    ('armour_subligaculum','armour',40,'level',5), ('armour_straps','armour',60,'verified',25),
    ('armour_leopard','armour',70,'denarii',300), ('armour_cardiophylax','armour',80,'level',18),
    ('armour_cloak','armour',90,'level',25), ('armour_lorica','armour',110,'league',700)
  ) as x(item, slot, power, kind, amount) where x.item = p_item;
$$;

-- Level from total XP: the inverse of 50·(L−1)² + 100·(L−1).
create or replace function public.user_level(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select (floor((-100 + sqrt(10000 + 200 * coalesce(sum(xp), 0))) / 100) + 1)::int
  from game_days where user_id = p_user;
$$;
revoke execute on function public.user_level(uuid) from public, anon, authenticated;

create or replace function public.user_verified_workouts(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from verified_sessions('-infinity', now()) where user_id = p_user;
$$;
revoke execute on function public.user_verified_workouts(uuid) from public, anon, authenticated;

-- The best season score the user reached (laurels from workouts, carry-over and awards).
create or replace function public.user_best_season(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with s as (
    select to_char(day, 'YYYY-MM') season, sum(laurels) n from game_days where user_id = p_user group by 1
    union all select season, carry from game_carry where user_id = p_user
    union all select season, sum(amount) from laurel_awards where user_id = p_user group by 1
  )
  select coalesce(max(t), 0)::int from (select sum(n) t from s group by season) x;
$$;
revoke execute on function public.user_best_season(uuid) from public, anon, authenticated;

create or replace function public.owns_gear(p_user uuid, p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select case g.kind
    when 'start' then true
    when 'denarii' then exists (select 1 from gear_purchases where user_id = p_user and item = p_item)
    when 'level' then user_level(p_user) >= g.amount
    when 'verified' then user_verified_workouts(p_user) >= g.amount
    when 'league' then user_best_season(p_user) >= g.amount
    else false end
  from gear_info(p_item) g;
$$;
revoke execute on function public.owns_gear(uuid, text) from public, anon, authenticated;

-- Wallet: denarii earned − given − spent on gear.
create or replace function public.my_wallet() returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(denarii) from game_days where user_id = auth.uid()), 0)
        - coalesce((select sum(amount) from treasury_gifts where user_id = auth.uid()), 0)
        - coalesce((select sum(price) from gear_purchases where user_id = auth.uid()), 0))::int;
$$;
revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

create or replace function public.gladiator_power(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with g as (select * from gladiators where user_id = p_user)
  select ((select power from gear_info(coalesce((select helmet from g), 'helmet_galea')))
        + (select power from gear_info(coalesce((select weapon from g), 'weapon_rudis')))
        + (select power from gear_info(coalesce((select shield from g), 'shield_parmula')))
        + (select power from gear_info(coalesce((select guard from g), 'guard_fasciae')))
        + (select power from gear_info(coalesce((select armour from g), 'armour_tunic'))))::int;
$$;
revoke execute on function public.gladiator_power(uuid) from public, anon, authenticated;

create or replace function public.buy_gear(p_item text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  g record;
begin
  select * into g from gear_info(p_item);
  if g.kind is null then raise exception 'No such piece'; end if;
  if g.kind <> 'denarii' then raise exception 'This piece is earned by training, not bought'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || auth.uid()::text));
  if exists (select 1 from gear_purchases where user_id = auth.uid() and item = p_item) then
    raise exception 'You have it already';
  end if;
  if my_wallet() < g.amount then raise exception 'You need % denarii', g.amount; end if;
  insert into gear_purchases (user_id, item, price) values (auth.uid(), p_item, g.amount);
end;
$$;
revoke execute on function public.buy_gear(text) from public, anon;
grant execute on function public.buy_gear(text) to authenticated;

create or replace function public.equip_gear(p_item text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  s text;
begin
  select slot into s from gear_info(p_item);
  if s is null then raise exception 'No such piece'; end if;
  if not owns_gear(auth.uid(), p_item) then raise exception 'You have not earned this piece yet'; end if;
  insert into gladiators (user_id) values (auth.uid()) on conflict do nothing;
  execute format('update gladiators set %I = $1, updated_at = now() where user_id = $2', s) using p_item, auth.uid();
  update gladiators set power = gladiator_power(auth.uid()) where user_id = auth.uid();
end;
$$;
revoke execute on function public.equip_gear(text) from public, anon;
grant execute on function public.equip_gear(text) to authenticated;

-- Choose the fighting style: the first time any time, then once a season.
create or replace function public.choose_style(p_style text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  season text := to_char(now(), 'YYYY-MM');
  cur gladiators;
begin
  if p_style not in ('murmillo','thraex','retiarius','secutor','hoplomachus','bestiarius') then
    raise exception 'No such style';
  end if;
  insert into gladiators (user_id) values (auth.uid()) on conflict do nothing;
  select * into cur from gladiators where user_id = auth.uid() for update;
  if cur.style = p_style then return; end if;
  if cur.style_season is not null and cur.style_season >= season then
    raise exception 'You can change your style once a season';
  end if;
  update gladiators set style = p_style, style_season = season, updated_at = now(),
    styles = styles || jsonb_build_array(jsonb_build_object('id', p_style, 'since', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  where user_id = auth.uid();
end;
$$;
revoke execute on function public.choose_style(text) from public, anon;
grant execute on function public.choose_style(text) to authenticated;

-- ───────────── Tribe attacks ─────────────
create table if not exists public.tribe_wars (
  id uuid primary key default gen_random_uuid(),
  attacker_gym uuid not null references public.gyms(id) on delete cascade,
  defender_gym uuid not null references public.gyms(id) on delete cascade,
  declared_by uuid references public.profiles(id) on delete set null,
  declared_at timestamptz not null default now(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  revenge boolean not null default false,
  attacker_active int not null,
  defender_active int not null,
  attacker_gear numeric not null default 0,  -- gear bonus share at the declaration
  defender_gear numeric not null default 0,
  defender_palisade int not null default 0,
  attacker_score numeric,
  defender_score numeric,
  winner_gym uuid,
  spoils int,
  damaged_building text,
  settled_at timestamptz,
  check (attacker_gym <> defender_gym)
);
create index if not exists tribe_wars_sides on public.tribe_wars(attacker_gym, defender_gym, declared_at desc);
alter table public.tribe_wars enable row level security;
drop policy if exists "tribe wars read" on public.tribe_wars;
create policy "tribe wars read" on public.tribe_wars for select to authenticated using (true);

create table if not exists public.tribe_pledges (
  war_id uuid not null references public.tribe_wars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pledged_at timestamptz not null default now(),
  primary key (war_id, user_id)
);
alter table public.tribe_pledges enable row level security;
drop policy if exists "pledges read" on public.tribe_pledges;
create policy "pledges read" on public.tribe_pledges for select to authenticated using (true);

-- Who holds each gym's territory; no row = the gym holds its own.
create table if not exists public.territories (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  held_by uuid not null references public.gyms(id) on delete cascade,
  since timestamptz not null default now()
);
alter table public.territories enable row level security;
drop policy if exists "territories read" on public.territories;
create policy "territories read" on public.territories for select to authenticated using (true);

-- Tribe members with their verified workouts in the 14 days before p_at and their gear power.
create or replace function public.tribe_members(p_gym uuid, p_at timestamptz)
returns table (user_id uuid, workouts int, power int)
language sql stable security definer set search_path = public as $$
  select p.id,
         (select count(*) from verified_sessions(p_at - interval '14 days', p_at) v where v.user_id = p.id)::int,
         coalesce((select g.power from gladiators g where g.user_id = p.id), 120)
  from profiles p where p.home_gym_id = p_gym;
$$;
revoke execute on function public.tribe_members(uuid, timestamptz) from public, anon, authenticated;

-- Average gear bonus of the active members: 15 % × power ÷ 490 (MAX_POWER), each.
create or replace function public.tribe_gear_bonus(p_gym uuid, p_at timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(0.15 * least(1, power / 490.0)), 3), 0)
  from tribe_members(p_gym, p_at) where workouts > 0;
$$;
revoke execute on function public.tribe_gear_bonus(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.tribe_war_points(p_gym uuid, p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, points numeric)
language sql stable security definer set search_path = public as $$
  with w as (
    select v.user_id, v.prs,
           row_number() over (partition by v.user_id, (v.started_at at time zone 'UTC')::date order by v.started_at) as n
    from verified_sessions(p_from, p_to) v
    join profiles p on p.id = v.user_id and p.home_gym_id = p_gym
  )
  select user_id, sum(10 + 5 * prs + case when n = 1 then 5 else 0 end) from w where n <= 2 group by user_id;
$$;
revoke execute on function public.tribe_war_points(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.tribe_war_scores(p_war uuid)
returns table (attacker_points numeric, defender_points numeric, attacker_score numeric, defender_score numeric)
language sql stable security definer set search_path = public as $$
  with w as (select * from tribe_wars where id = p_war),
  pts as (
    select (select coalesce(sum(points), 0) from tribe_war_points(w.attacker_gym, w.starts_at, least(now(), w.ends_at))) a,
           (select coalesce(sum(points), 0) from tribe_war_points(w.defender_gym, w.starts_at, least(now(), w.ends_at))) d,
           w.*
    from w
  )
  select a, d,
         round(a / greatest(3, attacker_active) * (1 + attacker_gear + case when revenge then 0.2 else 0 end), 1),
         round(d / greatest(3, defender_active) * (1 + defender_gear + 0.03 * defender_palisade), 1)
  from pts;
$$;
revoke execute on function public.tribe_war_scores(uuid) from public, anon;
grant execute on function public.tribe_war_scores(uuid) to authenticated;

-- My points and place in my tribe's side of a war.
create or replace function public.tribe_war_me(p_war uuid)
returns table (points numeric, place int, members int)
language sql stable security definer set search_path = public as $$
  with w as (select * from tribe_wars where id = p_war),
  mine as (select home_gym_id g from profiles where id = auth.uid()),
  pts as (
    select t.user_id, t.points from w, mine, tribe_war_points(mine.g, w.starts_at, least(now(), w.ends_at)) t
  ),
  ranked as (select user_id, points, rank() over (order by points desc)::int place, count(*) over ()::int n from pts)
  select coalesce((select points from ranked where user_id = auth.uid()), 0),
         (select place from ranked where user_id = auth.uid()),
         coalesce((select max(n) from ranked), 0);
$$;
revoke execute on function public.tribe_war_me(uuid) from public, anon;
grant execute on function public.tribe_war_me(uuid) to authenticated;

create or replace function public.settle_tribe_war(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w tribe_wars;
  s record;
  winner uuid;
  loser uuid;
  loot int;
  hit text;
begin
  select * into w from tribe_wars where id = p_war for update;
  if w.id is null or w.settled_at is not null or w.ends_at > now() then return; end if;
  select * into s from tribe_war_scores(p_war);
  if s.attacker_score > s.defender_score then winner := w.attacker_gym; loser := w.defender_gym;
  else winner := w.defender_gym; loser := w.attacker_gym; end if;
  loot := least(500, floor(coalesce((select denarii from treasuries where owner_kind = 'gym' and owner_id = loser), 0) * 0.2))::int;
  if loot > 0 then
    update treasuries set denarii = denarii - loot where owner_kind = 'gym' and owner_id = loser;
    insert into treasuries (owner_kind, owner_id, denarii) values ('gym', winner, loot)
    on conflict (owner_kind, owner_id) do update set denarii = treasuries.denarii + loot;
  end if;
  -- The walls take the hit first; nothing is destroyed, only damaged until repaired.
  perform settle_buildings('gym', loser);
  select building into hit from buildings
  where owner_kind = 'gym' and owner_id = loser and level > 0 and not damaged
  order by (building = 'palisade') desc, level desc, building limit 1;
  if hit is not null then
    update buildings set damaged = true where owner_kind = 'gym' and owner_id = loser and building = hit;
  end if;
  -- An attacker who wins takes every territory the defender holds.
  if winner = w.attacker_gym then
    insert into territories (gym_id, held_by)
    select g.id, w.attacker_gym from gyms g
    where coalesce((select held_by from territories t where t.gym_id = g.id), g.id) = w.defender_gym
    on conflict (gym_id) do update set held_by = excluded.held_by, since = now();
    delete from territories where gym_id = held_by;
  end if;
  update tribe_wars set attacker_score = s.attacker_score, defender_score = s.defender_score,
    winner_gym = winner, spoils = loot, damaged_building = hit, settled_at = now()
  where id = p_war;
end;
$$;
revoke execute on function public.settle_tribe_war(uuid) from public, anon;
grant execute on function public.settle_tribe_war(uuid) to authenticated;

create or replace function public.declare_tribe_war(p_target uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  mine uuid;
  is_revenge boolean;
  war_id uuid;
  a_active int;
  d_active int;
begin
  select home_gym_id into mine from profiles where id = auth.uid();
  if mine is null then raise exception 'Choose your home gym first'; end if;
  if mine = p_target then raise exception 'That is your own tribe'; end if;
  if (select city from gyms where id = mine) is distinct from (select city from gyms where id = p_target) then
    raise exception 'You can attack only tribes in your city';
  end if;
  if user_level(auth.uid()) < 5 then raise exception 'Attacks open at level 5 (Gladiator)'; end if;
  perform settle_tribe_war(w.id) from tribe_wars w
    where w.settled_at is null and w.ends_at <= now()
      and (mine in (w.attacker_gym, w.defender_gym) or p_target in (w.attacker_gym, w.defender_gym));
  if exists (select 1 from tribe_wars where settled_at is null
             and (mine in (attacker_gym, defender_gym) or p_target in (attacker_gym, defender_gym))) then
    raise exception 'One of the tribes is at war already';
  end if;
  -- Revenge: they beat our defence in the last 24 hours.
  is_revenge := exists (select 1 from tribe_wars where attacker_gym = p_target and defender_gym = mine
                        and winner_gym = p_target and ends_at > now() - interval '24 hours');
  if not is_revenge and exists (
      select 1 from tribe_wars where declared_at > now() - interval '7 days'
      and ((attacker_gym = mine and defender_gym = p_target) or (attacker_gym = p_target and defender_gym = mine))) then
    raise exception 'You fought them this week already';
  end if;
  select count(*) filter (where workouts > 0) into a_active from tribe_members(mine, now());
  select count(*) filter (where workouts > 0) into d_active from tribe_members(p_target, now());
  if a_active < 3 then raise exception 'Your tribe needs 3 members who trained at the gym in the last 14 days'; end if;
  if d_active < 3 then raise exception 'They have fewer than 3 active members'; end if;
  if not is_revenge then perform spend_treasury('gym', mine, 100); end if;
  insert into tribe_wars (attacker_gym, defender_gym, declared_by, starts_at, ends_at, revenge,
                          attacker_active, defender_active, attacker_gear, defender_gear, defender_palisade)
  values (mine, p_target, auth.uid(), now() + interval '24 hours', now() + interval '96 hours', is_revenge,
          a_active, d_active, tribe_gear_bonus(mine, now()), tribe_gear_bonus(p_target, now()),
          working_level('gym', p_target, 'palisade'))
  returning id into war_id;
  return war_id;
end;
$$;
revoke execute on function public.declare_tribe_war(uuid) from public, anon;
grant execute on function public.declare_tribe_war(uuid) to authenticated;

create or replace function public.pledge_defence(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from tribe_wars w join profiles p on p.id = auth.uid()
                 where w.id = p_war and w.settled_at is null and p.home_gym_id in (w.attacker_gym, w.defender_gym)) then
    raise exception 'This is not your tribe''s war';
  end if;
  insert into tribe_pledges (war_id, user_id) values (p_war, auth.uid()) on conflict do nothing;
end;
$$;
revoke execute on function public.pledge_defence(uuid) from public, anon;
grant execute on function public.pledge_defence(uuid) to authenticated;

-- The city's tribes for the map: position, fortress level, members, strength and territories.
create or replace function public.city_map(p_city text)
returns table (id uuid, name text, lat float8, lng float8, level int, members int, strength int,
               territories int, held_by uuid, treasury int, palisade int, at_war boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.lat, g.lng,
         coalesce((select sum(case when b.target_level is not null and b.ready_at <= now() then b.target_level else b.level end)
                   from buildings b where b.owner_kind = 'gym' and b.owner_id = g.id), 0)::int,
         (select count(*) from profiles p where p.home_gym_id = g.id)::int,
         coalesce((select sum(m.workouts * 20 + m.power) from tribe_members(g.id, now()) m where m.workouts > 0), 0)::int,
         (select count(*) from gyms o where o.city = g.city
            and coalesce((select t.held_by from territories t where t.gym_id = o.id), o.id) = g.id)::int,
         (select t.held_by from territories t where t.gym_id = g.id),
         coalesce((select denarii from treasuries where owner_kind = 'gym' and owner_id = g.id), 0),
         working_level('gym', g.id, 'palisade'),
         exists (select 1 from tribe_wars w where w.settled_at is null and g.id in (w.attacker_gym, w.defender_gym))
  from gyms g where g.city = p_city;
$$;
revoke execute on function public.city_map(text) from public, anon;
grant execute on function public.city_map(text) to authenticated;

-- A tribe up close: its best three gladiators and when its members train.
create or replace function public.tribe_info(p_gym uuid)
returns table (user_id uuid, display_name text, level int, style text, power int, weekend_share numeric)
language sql stable security definer set search_path = public as $$
  with best as (
    select p.id, p.display_name, user_level(p.id) lv, g.style, coalesce(g.power, 120) pw
    from profiles p left join gladiators g on g.user_id = p.id
    where p.home_gym_id = p_gym
    order by coalesce(g.power, 120) desc, p.display_name limit 3
  ),
  week as (
    select count(*) filter (where extract(isodow from v.started_at) >= 6)::numeric / greatest(1, count(*)) share
    from verified_sessions(now() - interval '28 days', now()) v
    join profiles p on p.id = v.user_id and p.home_gym_id = p_gym
  )
  select best.id, best.display_name, best.lv, best.style, best.pw, round(week.share, 2) from best, week;
$$;
revoke execute on function public.tribe_info(uuid) from public, anon;
grant execute on function public.tribe_info(uuid) to authenticated;

-- ═════════════════════════ Running (updates/2026-11-14-running.sql) ═════════════════════════

-- ───────────── The run on the session ─────────────
-- The fastest anyone has run from a distance on, in seconds per km (same steps as running.ts).
create or replace function public.run_wr_pace(p_distance numeric) returns numeric
language sql immutable as $$
  select case
    when p_distance >= 42195 then 171
    when p_distance >= 21097 then 163
    when p_distance >= 10000 then 157
    when p_distance >= 5000 then 151
    when p_distance >= 3000 then 146
    else 131 end;
$$;

alter table public.workout_sessions add column if not exists kind text not null default 'lift';
alter table public.workout_sessions add column if not exists distance_m int;
alter table public.workout_sessions add column if not exists duration_s int;
alter table public.workout_sessions add column if not exists run_place text;
alter table public.workout_sessions add column if not exists elevation_m int;

alter table public.workout_sessions drop constraint if exists workout_sessions_kind;
alter table public.workout_sessions add constraint workout_sessions_kind check (kind in ('lift','run'));
alter table public.workout_sessions drop constraint if exists workout_sessions_run;
alter table public.workout_sessions add constraint workout_sessions_run check (
  kind <> 'run' or (
    finished_at is not null
    and distance_m between 1 and 100000
    and duration_s between 1 and 43200
    and run_place in ('outdoor','treadmill')
    and (elevation_m is null or elevation_m between 0 and 10000)
    and pr_count between 0 and 1
    -- Nobody runs faster than the world record.
    and duration_s >= distance_m * run_wr_pace(distance_m) / 1000.0
  ));

-- No runs in the future, and none logged long after (the app offers the last 7 days).
create or replace function public.guard_run() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'run' then
    if new.finished_at > now() + interval '10 minutes' then
      raise exception 'That run has not happened yet';
    end if;
    -- An upsert of an existing run (an edit) also fires the insert trigger first.
    if tg_op = 'INSERT' and new.started_at < now() - interval '14 days'
       and not exists (select 1 from workout_sessions w where w.id = new.id) then
      raise exception 'Runs can be logged for the last 7 days';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_run on public.workout_sessions;
create trigger guard_run before insert or update on public.workout_sessions
  for each row execute function public.guard_run();

-- The average heart rate is private, like how a workout felt.
alter table public.session_ratings add column if not exists avg_hr smallint;
alter table public.session_ratings drop constraint if exists session_ratings_avg_hr;
alter table public.session_ratings add constraint session_ratings_avg_hr
  check (avg_hr is null or avg_hr between 60 and 220);

-- A workout that earns anything: 3+ working sets, or a run from 3 km or 20 minutes at a running
-- pace (12:00 /km or faster). Same as qualifies() in src/lib/game/engine.ts.
create or replace function public.session_counts(s public.workout_sessions) returns boolean
language sql stable as $$
  select s.finished_at is not null and case
    when s.kind = 'run' then (s.distance_m >= 3000 or s.duration_s >= 1200)
                             and s.duration_s <= s.distance_m * 0.72
    else s.set_count >= 3 end;
$$;

-- VDOT (Jack Daniels) from distance and time. Same as vdot() in src/lib/running.ts.
create or replace function public.vdot(p_distance numeric, p_seconds numeric) returns numeric
language sql immutable as $$
  select case when p_distance <= 0 or p_seconds <= 0 then 0 else
    (-4.6 + 0.182258 * x.v + 0.000104 * x.v * x.v)
    / (0.8 + 0.1894393 * exp(-0.012778 * x.t) + 0.2989558 * exp(-0.1932605 * x.t)) end
  from (select p_distance / (p_seconds / 60.0) as v, p_seconds / 60.0 as t) x;
$$;

-- ───────────── Runs count in battles ─────────────
-- Workouts that count in wars, attacks and Bellum: verified at the gym (3+ sets during a verified
-- visit), or a run that counts (wherever it was run).
create or replace function public.verified_sessions(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, user_id uuid, started_at timestamptz, prs int)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, s.started_at, least(s.pr_count, 3)
  from workout_sessions s
  where session_counts(s)
    and s.started_at >= p_from and s.started_at < p_to
    and (s.kind = 'run' or exists (
      select 1 from gym_visits v
      where v.user_id = s.user_id and visit_status(v) = 'verified'
        and s.started_at between v.in_at - interval '15 minutes' and v.out_at));
$$;
revoke execute on function public.verified_sessions(timestamptz, timestamptz) from public, anon, authenticated;

-- Members who trained (lifted or ran) in the 14 days before, at least 2.
create or replace function public.ludus_active(p_ludus uuid, p_at timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select greatest(2, count(distinct m.user_id))::int
  from ludus_members m join workout_sessions s on s.user_id = m.user_id
  where m.ludus_id = p_ludus and session_counts(s)
    and s.started_at >= p_at - interval '14 days' and s.started_at < p_at;
$$;

-- Same as duelScore() in src/lib/game/battles.ts; a "workouts" duel counts runs too.
create or replace function public.duel_score(p_user uuid, p_kind text, p_exercise uuid,
                                             p_from timestamptz, p_to timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p_kind = 'workouts' then (
    select count(*)::numeric from workout_sessions s
    where s.user_id = p_user and session_counts(s)
      and s.started_at >= p_from and s.started_at < p_to)
  else (
    with b as (
      select max(e1rm(e.weight_kg, e.reps)) filter (where s.started_at < p_from) before,
             max(e1rm(e.weight_kg, e.reps)) filter (where s.started_at >= p_from and s.started_at < p_to) during
      from set_entries e join workout_sessions s on s.id = e.session_id
      where s.user_id = p_user and s.finished_at is not null and e.exercise_id = p_exercise
        and e.done and not e.warmup and e.drop_of is null
    )
    select case when before is null then 0 else greatest(0, round(coalesce(during, 0) - before, 1)) end from b)
  end;
$$;
revoke execute on function public.duel_score(uuid, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ───────────── Running boards in the Arena ─────────────
-- New metrics: 'run_5k' and 'run_10k' (best time in seconds, lower is better), 'vdot' and
-- 'run_km'. 'workouts' counts runs that count too.
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
  runs as (
    select s.user_id, s.distance_m, s.duration_s
    from workout_sessions s, since
    where s.kind = 'run' and session_counts(s) and s.started_at >= since.t
      and s.user_id in (select id from members)
  ),
  together as (
    select u.user_id, count(*)::numeric as value
    from (select t.owner_id as user_id, t.confirmed_at from trained_together t
          union all select t.user_id, t.confirmed_at from trained_together t) u, since
    where u.confirmed_at >= since.t and u.user_id in (select id from members)
    group by u.user_id
  ),
  vals as (
    select user_id,
      case
        when (select key from metric) = 'volume' then sum(weight_kg * work_reps)
        else max(case when exercise_id::text = (select key from metric)
                      then case when reps <= 1 then weight_kg else weight_kg * (1 + reps / 30.0) end end)
      end as value
    from sets
    where (select key from metric) not in ('together','workouts','run_5k','run_10k','vdot','run_km')
    group by user_id
    union all
    select u.user_id, count(distinct u.session_id)::numeric
    from (select user_id, session_id from sets
          union all select s.user_id, s.id from workout_sessions s, since
          where s.kind = 'run' and session_counts(s) and s.started_at >= since.t
            and s.user_id in (select id from members)) u
    where (select key from metric) = 'workouts'
    group by u.user_id
    union all
    select r.user_id,
      case (select key from metric)
        when 'run_km' then round(sum(r.distance_m) / 1000.0, 1)
        when 'vdot' then max(vdot(r.distance_m, r.duration_s))
        when 'run_5k' then round(min(r.duration_s * 5000.0 / r.distance_m)
                                 filter (where r.distance_m between 5000 and 5250))
        when 'run_10k' then round(min(r.duration_s * 10000.0 / r.distance_m)
                                  filter (where r.distance_m between 10000 and 10500))
      end
    from runs r
    where (select key from metric) in ('run_5k','run_10k','vdot','run_km')
    group by r.user_id
    union all
    select t.user_id, t.value from together t where (select key from metric) = 'together'
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
  -- away bodyweight. The caller sees their own score. Times rank fastest first.
  select rank() over (order by case when (select key from metric) in ('run_5k','run_10k')
                                    then -v.value else v.value end desc nulls last),
         p.id, p.username, p.display_name, p.avatar_url,
         case when (select dots from metric) and p.id <> auth.uid() then null else round(v.value, 1) end
  from scored v join profiles p on p.id = v.user_id
  where v.value is not null
  order by 1
  limit 500;
$$;

-- ═══════════════ 2026-11-27: hours (supabase/updates/2026-11-27-hours.sql) ═══════════════
-- Hours (docs/GAME.md §5, Matyáš 2026-11-27): time in the gym pays for building. Every verified
-- visit adds its minutes to the visitor's house, ludus and tribe treasuries. Building, repairs,
-- tribe attacks and war spoils are in hours; denarii given to treasuries go back to the givers.
-- Numbers match src/lib/game/config.ts (HOURS, WAR, TRIBE_WAR) and src/lib/game/fortress.ts.

-- ───────────── Treasuries count minutes ─────────────
alter table public.treasuries add column if not exists minutes int not null default 0;
alter table public.treasuries drop constraint if exists treasuries_minutes_check;
alter table public.treasuries add constraint treasuries_minutes_check check (minutes >= 0);
alter table public.ludus_wars add column if not exists spoils_minutes int;
alter table public.tribe_wars add column if not exists spoils_minutes int;

-- Your house: its level and your own hours (minutes), seen only by you.
create table if not exists public.homes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level int not null default 1 check (level between 1 and 5),
  minutes int not null default 0 check (minutes >= 0)
);
create table if not exists public.home_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null check (item in ('hortus','fountain','pergola','lararium','palaestra')),
  built_at timestamptz not null default now(),
  primary key (user_id, item)
);
-- Which visits have paid in their minutes (each one once).
create table if not exists public.visit_credits (
  visit_id uuid primary key references public.gym_visits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes int not null check (minutes > 0),
  ludus_id uuid,
  gym_id uuid,
  credited_at timestamptz not null default now()
);
create index if not exists visit_credits_user on public.visit_credits(user_id, credited_at desc);
alter table public.homes enable row level security;
alter table public.home_items enable row level security;
alter table public.visit_credits enable row level security;
drop policy if exists "homes owner read" on public.homes;
create policy "homes owner read" on public.homes for select to authenticated using (user_id = auth.uid());
drop policy if exists "home items owner read" on public.home_items;
create policy "home items owner read" on public.home_items for select to authenticated using (user_id = auth.uid());
drop policy if exists "visit credits owner read" on public.visit_credits;
create policy "visit credits owner read" on public.visit_credits for select to authenticated using (user_id = auth.uid());

-- A verified visit pays in once: to the house, to the ludus (if joined before the visit) and to
-- the tribe (if it was at the home gym).
create or replace function public.credit_visit(v public.gym_visits) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  mins int;
  lud uuid;
  home uuid;
begin
  if visit_status(v) <> 'verified' then return; end if;
  mins := floor(extract(epoch from (v.out_at - v.in_at)) / 60)::int;
  if mins <= 0 then return; end if;
  select ludus_id into lud from ludus_members where user_id = v.user_id and joined_at <= v.in_at;
  select home_gym_id into home from profiles where id = v.user_id;
  if home is distinct from v.gym_id then home := null; end if;
  insert into visit_credits (visit_id, user_id, minutes, ludus_id, gym_id)
  values (v.id, v.user_id, mins, lud, home)
  on conflict (visit_id) do nothing;
  if not found then return; end if;
  insert into homes (user_id, minutes) values (v.user_id, mins)
  on conflict (user_id) do update set minutes = homes.minutes + excluded.minutes;
  if lud is not null then
    insert into treasuries (owner_kind, owner_id, minutes) values ('ludus', lud, mins)
    on conflict (owner_kind, owner_id) do update set minutes = treasuries.minutes + excluded.minutes;
  end if;
  if home is not null then
    insert into treasuries (owner_kind, owner_id, minutes) values ('gym', home, mins)
    on conflict (owner_kind, owner_id) do update set minutes = treasuries.minutes + excluded.minutes;
  end if;
end;
$$;
revoke execute on function public.credit_visit(public.gym_visits) from public, anon, authenticated;

create or replace function public.visit_credit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform credit_visit(new);
  return null;
end;
$$;
drop trigger if exists visit_credit on public.gym_visits;
create trigger visit_credit after insert or update on public.gym_visits
  for each row execute function public.visit_credit();

-- Visits verified before hours existed count too, once.
do $$
declare
  r public.gym_visits;
begin
  for r in select * from public.gym_visits where out_at is not null order by in_at loop
    perform public.credit_visit(r);
  end loop;
end;
$$;

-- ───────────── Paying in hours ─────────────
create or replace function public.spend_hours(p_kind text, p_id uuid, p_minutes int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update treasuries set minutes = minutes - p_minutes
  where owner_kind = p_kind and owner_id = p_id and minutes >= p_minutes;
  if not found then raise exception 'The treasury needs % h', ceil(p_minutes / 60.0)::int; end if;
end;
$$;
revoke execute on function public.spend_hours(text, uuid, int) from public, anon, authenticated;

-- base_cost is now hours per level for a ludus (a gym pays 3×).
create or replace function public.building_info(p_building text, out max_level int, out base_cost int, out ludus_only boolean)
language sql immutable as $$
  select case when p_building in ('palisade','barracks') then 5 else 3 end,
         case p_building when 'palisade' then 5 when 'barracks' then 8 when 'temple' then 10 else 6 end,
         p_building = 'barracks';
$$;

create or replace function public.start_building(p_kind text, p_id uuid, p_building text) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  info record;
  cur int;
  next_level int;
  ready timestamptz;
begin
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('fortress:' || p_kind || p_id::text));
  perform settle_buildings(p_kind, p_id);
  select * into info from building_info(p_building);
  if info.ludus_only and p_kind <> 'ludus' then raise exception 'Only a ludus builds barracks'; end if;
  if exists (select 1 from buildings where owner_kind = p_kind and owner_id = p_id and target_level is not null) then
    raise exception 'Something is being built already';
  end if;
  if exists (select 1 from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building and damaged) then
    raise exception 'Repair it first';
  end if;
  cur := coalesce((select level from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building), 0);
  next_level := cur + 1;
  if next_level > info.max_level then raise exception 'It is at the top level'; end if;
  perform spend_hours(p_kind, p_id, info.base_cost * next_level * (case when p_kind = 'gym' then 3 else 1 end) * 60);
  ready := now() + make_interval(days => next_level);
  insert into buildings (owner_kind, owner_id, building, level, target_level, ready_at)
  values (p_kind, p_id, p_building, cur, next_level, ready)
  on conflict (owner_kind, owner_id, building) do update set target_level = next_level, ready_at = ready;
  return ready;
end;
$$;
revoke execute on function public.start_building(text, uuid, text) from public, anon;
grant execute on function public.start_building(text, uuid, text) to authenticated;

create or replace function public.repair_building(p_kind text, p_id uuid, p_building text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  lvl int;
begin
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('fortress:' || p_kind || p_id::text));
  select level into lvl from buildings
  where owner_kind = p_kind and owner_id = p_id and building = p_building and damaged;
  if lvl is null then raise exception 'Nothing to repair'; end if;
  perform spend_hours(p_kind, p_id,
    ceil((select base_cost from building_info(p_building)) * greatest(lvl, 1)
         * (case when p_kind = 'gym' then 3 else 1 end) * 60 * 0.4)::int);
  update buildings set damaged = false where owner_kind = p_kind and owner_id = p_id and building = p_building;
end;
$$;
revoke execute on function public.repair_building(text, uuid, text) from public, anon;
grant execute on function public.repair_building(text, uuid, text) to authenticated;

-- Denarii are for gear now: gifts to treasuries are closed and go back to the givers.
create or replace function public.donate(p_kind text, p_id uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  raise exception 'Treasuries fill with hours now: every verified visit to the gym adds its time';
end;
$$;

create or replace function public.my_wallet() returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(denarii) from game_days where user_id = auth.uid()), 0)
        - coalesce((select sum(price) from gear_purchases where user_id = auth.uid()), 0))::int;
$$;
revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

-- ───────────── Wars: spoils and the attack price in hours ─────────────
create or replace function public.settle_war(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w ludus_wars;
  s record;
  winner uuid;
  loser uuid;
  loot int;
  hit text;
begin
  select * into w from ludus_wars where id = p_war for update;
  if w.id is null or w.settled_at is not null or w.ends_at > now() then return; end if;
  select * into s from war_scores(p_war);
  if s.attacker_score > s.defender_score then winner := w.attacker_id; loser := w.defender_id;
  else winner := w.defender_id; loser := w.attacker_id; end if;
  loot := least(720, floor(coalesce((select minutes from treasuries where owner_kind = 'ludus' and owner_id = loser), 0) * 0.2))::int;
  if loot > 0 then
    update treasuries set minutes = minutes - loot where owner_kind = 'ludus' and owner_id = loser;
    insert into treasuries (owner_kind, owner_id, minutes) values ('ludus', winner, loot)
    on conflict (owner_kind, owner_id) do update set minutes = treasuries.minutes + loot;
  end if;
  perform settle_buildings('ludus', loser);
  select building into hit from buildings
  where owner_kind = 'ludus' and owner_id = loser and level > 0 and not damaged
  order by level desc, building limit 1;
  if hit is not null then
    update buildings set damaged = true where owner_kind = 'ludus' and owner_id = loser and building = hit;
  end if;
  insert into laurel_awards (user_id, season, amount, reason, ref_id)
  select m.user_id, to_char(w.ends_at, 'YYYY-MM'), 30, 'war', w.id::text
  from ludus_members m where m.ludus_id = winner
  on conflict do nothing;
  update ludus_wars set attacker_score = s.attacker_score, defender_score = s.defender_score,
    winner_id = winner, spoils = null, spoils_minutes = loot, damaged_building = hit, settled_at = now()
  where id = p_war;
  perform apply_war_gloria(p_war);
end;
$$;
revoke execute on function public.settle_war(uuid) from public, anon;
grant execute on function public.settle_war(uuid) to authenticated;

create or replace function public.settle_tribe_war(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w tribe_wars;
  s record;
  winner uuid;
  loser uuid;
  loot int;
  hit text;
begin
  select * into w from tribe_wars where id = p_war for update;
  if w.id is null or w.settled_at is not null or w.ends_at > now() then return; end if;
  select * into s from tribe_war_scores(p_war);
  if s.attacker_score > s.defender_score then winner := w.attacker_gym; loser := w.defender_gym;
  else winner := w.defender_gym; loser := w.attacker_gym; end if;
  loot := least(1200, floor(coalesce((select minutes from treasuries where owner_kind = 'gym' and owner_id = loser), 0) * 0.2))::int;
  if loot > 0 then
    update treasuries set minutes = minutes - loot where owner_kind = 'gym' and owner_id = loser;
    insert into treasuries (owner_kind, owner_id, minutes) values ('gym', winner, loot)
    on conflict (owner_kind, owner_id) do update set minutes = treasuries.minutes + loot;
  end if;
  -- The walls take the hit first; nothing is destroyed, only damaged until repaired.
  perform settle_buildings('gym', loser);
  select building into hit from buildings
  where owner_kind = 'gym' and owner_id = loser and level > 0 and not damaged
  order by (building = 'palisade') desc, level desc, building limit 1;
  if hit is not null then
    update buildings set damaged = true where owner_kind = 'gym' and owner_id = loser and building = hit;
  end if;
  -- An attacker who wins takes every territory the defender holds.
  if winner = w.attacker_gym then
    insert into territories (gym_id, held_by)
    select g.id, w.attacker_gym from gyms g
    where coalesce((select held_by from territories t where t.gym_id = g.id), g.id) = w.defender_gym
    on conflict (gym_id) do update set held_by = excluded.held_by, since = now();
    delete from territories where gym_id = held_by;
  end if;
  update tribe_wars set attacker_score = s.attacker_score, defender_score = s.defender_score,
    winner_gym = winner, spoils = null, spoils_minutes = loot, damaged_building = hit, settled_at = now()
  where id = p_war;
end;
$$;
revoke execute on function public.settle_tribe_war(uuid) from public, anon;
grant execute on function public.settle_tribe_war(uuid) to authenticated;

create or replace function public.declare_tribe_war(p_target uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  mine uuid;
  is_revenge boolean;
  war_id uuid;
  a_active int;
  d_active int;
begin
  select home_gym_id into mine from profiles where id = auth.uid();
  if mine is null then raise exception 'Choose your home gym first'; end if;
  if mine = p_target then raise exception 'That is your own tribe'; end if;
  if (select city from gyms where id = mine) is distinct from (select city from gyms where id = p_target) then
    raise exception 'You can attack only tribes in your city';
  end if;
  if user_level(auth.uid()) < 5 then raise exception 'Attacks open at level 5 (Gladiator)'; end if;
  perform settle_tribe_war(w.id) from tribe_wars w
    where w.settled_at is null and w.ends_at <= now()
      and (mine in (w.attacker_gym, w.defender_gym) or p_target in (w.attacker_gym, w.defender_gym));
  if exists (select 1 from tribe_wars where settled_at is null
             and (mine in (attacker_gym, defender_gym) or p_target in (attacker_gym, defender_gym))) then
    raise exception 'One of the tribes is at war already';
  end if;
  -- Revenge: they beat our defence in the last 24 hours.
  is_revenge := exists (select 1 from tribe_wars where attacker_gym = p_target and defender_gym = mine
                        and winner_gym = p_target and ends_at > now() - interval '24 hours');
  if not is_revenge and exists (
      select 1 from tribe_wars where declared_at > now() - interval '7 days'
      and ((attacker_gym = mine and defender_gym = p_target) or (attacker_gym = p_target and defender_gym = mine))) then
    raise exception 'You fought them this week already';
  end if;
  select count(*) filter (where workouts > 0) into a_active from tribe_members(mine, now());
  select count(*) filter (where workouts > 0) into d_active from tribe_members(p_target, now());
  if a_active < 3 then raise exception 'Your tribe needs 3 members who trained at the gym in the last 14 days'; end if;
  if d_active < 3 then raise exception 'They have fewer than 3 active members'; end if;
  if not is_revenge then perform spend_hours('gym', mine, 240); end if;
  insert into tribe_wars (attacker_gym, defender_gym, declared_by, starts_at, ends_at, revenge,
                          attacker_active, defender_active, attacker_gear, defender_gear, defender_palisade)
  values (mine, p_target, auth.uid(), now() + interval '24 hours', now() + interval '96 hours', is_revenge,
          a_active, d_active, tribe_gear_bonus(mine, now()), tribe_gear_bonus(p_target, now()),
          working_level('gym', p_target, 'palisade'))
  returning id into war_id;
  return war_id;
end;
$$;
revoke execute on function public.declare_tribe_war(uuid) from public, anon;
grant execute on function public.declare_tribe_war(uuid) to authenticated;

-- ───────────── Your house ─────────────
-- Minutes a house level costs (level 1 is free).
create or replace function public.home_cost(p_level int) returns int
language sql immutable as $$
  select case p_level when 2 then 600 when 3 then 1500 when 4 then 3000 when 5 then 6000 end;
$$;

create or replace function public.upgrade_home() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  h homes;
  cost int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into homes (user_id) values (auth.uid()) on conflict do nothing;
  select * into h from homes where user_id = auth.uid() for update;
  if h.level >= 5 then raise exception 'Your house is at the top level'; end if;
  cost := home_cost(h.level + 1);
  if h.minutes < cost then raise exception 'You need % h of your own', cost / 60; end if;
  update homes set level = level + 1, minutes = minutes - cost where user_id = auth.uid();
  return h.level + 1;
end;
$$;
revoke execute on function public.upgrade_home() from public, anon;
grant execute on function public.upgrade_home() to authenticated;

create or replace function public.build_home_item(p_item text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  h homes;
begin
  if p_item not in ('hortus','fountain','pergola','lararium','palaestra') then raise exception 'Unknown item'; end if;
  insert into homes (user_id) values (auth.uid()) on conflict do nothing;
  select * into h from homes where user_id = auth.uid() for update;
  if h.level < 2 then raise exception 'Upgrade your house first'; end if;
  if exists (select 1 from home_items where user_id = auth.uid() and item = p_item) then
    raise exception 'You have it already';
  end if;
  if h.minutes < 300 then raise exception 'You need 5 h of your own'; end if;
  update homes set minutes = minutes - 300 where user_id = auth.uid();
  insert into home_items (user_id, item) values (auth.uid(), p_item);
end;
$$;
revoke execute on function public.build_home_item(text) from public, anon;
grant execute on function public.build_home_item(text) to authenticated;

-- The city map shows each tribe's treasury in minutes now (for the spoils of an attack).
create or replace function public.city_map(p_city text)
returns table (id uuid, name text, lat float8, lng float8, level int, members int, strength int,
               territories int, held_by uuid, treasury int, palisade int, at_war boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.lat, g.lng,
         coalesce((select sum(case when b.target_level is not null and b.ready_at <= now() then b.target_level else b.level end)
                   from buildings b where b.owner_kind = 'gym' and b.owner_id = g.id), 0)::int,
         (select count(*) from profiles p where p.home_gym_id = g.id)::int,
         coalesce((select sum(m.workouts * 20 + m.power) from tribe_members(g.id, now()) m where m.workouts > 0), 0)::int,
         (select count(*) from gyms o where o.city = g.city
            and coalesce((select t.held_by from territories t where t.gym_id = o.id), o.id) = g.id)::int,
         (select t.held_by from territories t where t.gym_id = g.id),
         coalesce((select minutes from treasuries where owner_kind = 'gym' and owner_id = g.id), 0),
         working_level('gym', g.id, 'palisade'),
         exists (select 1 from tribe_wars w where w.settled_at is null and g.id in (w.attacker_gym, w.defender_gym))
  from gyms g where g.city = p_city;
$$;
revoke execute on function public.city_map(text) from public, anon;
grant execute on function public.city_map(text) to authenticated;

-- ═══════════════ 2026-11-27: cycling and swimming (supabase/updates/2026-11-27-cardio.sql) ═══════════════
-- Cycling and swimming (docs/GAME.md §11, Matyáš 2026-11-27): a ride or a swim is a
-- workout_sessions row of kind 'ride' or 'swim' with distance and time and no sets, like a run.
-- One that counts is worth one workout: XP, laurels, the weekly target, wars, attacks, Bellum and
-- duels. Numbers match RIDE and SWIM in src/lib/game/config.ts and src/lib/cardio.ts.

-- ───────────── The ride or swim on the session ─────────────
-- The fastest possible pace from a distance on, in seconds per km: 60 km/h on a bike, the world
-- records in the water, the running records for a run.
create or replace function public.cardio_fastest(p_kind text, p_distance numeric) returns numeric
language sql immutable as $$
  select case p_kind
    when 'ride' then 60
    when 'swim' then case when p_distance >= 5000 then 620 when p_distance >= 1500 then 570
                          when p_distance >= 400 then 540 else 460 end
    else run_wr_pace(p_distance) end;
$$;

alter table public.workout_sessions drop constraint if exists workout_sessions_kind;
alter table public.workout_sessions add constraint workout_sessions_kind
  check (kind in ('lift','run','ride','swim'));
alter table public.workout_sessions drop constraint if exists workout_sessions_cardio;
alter table public.workout_sessions add constraint workout_sessions_cardio check (
  kind not in ('ride','swim') or (
    finished_at is not null
    and distance_m between 1 and (case when kind = 'ride' then 400000 else 30000 end)
    and duration_s between 1 and (case when kind = 'ride' then 57600 else 43200 end)
    and run_place in (case when kind = 'ride' then 'outdoor' else 'pool' end,
                      case when kind = 'ride' then 'indoor' else 'open' end)
    and (elevation_m is null or elevation_m between 0 and 10000)
    and pr_count between 0 and 1
    and duration_s >= distance_m * cardio_fastest(kind, distance_m) / 1000.0
  ));

-- No sessions in the future, and none logged long after (the app offers the last 7 days).
create or replace function public.guard_run() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind in ('run','ride','swim') then
    if new.finished_at > now() + interval '10 minutes' then
      raise exception 'That % has not happened yet', new.kind;
    end if;
    -- An upsert of an existing one (an edit) also fires the insert trigger first.
    if tg_op = 'INSERT' and new.started_at < now() - interval '14 days'
       and not exists (select 1 from workout_sessions w where w.id = new.id) then
      raise exception 'Runs, rides and swims can be logged for the last 7 days';
    end if;
  end if;
  return new;
end;
$$;

-- A workout that earns anything: 3+ working sets, or a run, ride or swim long enough and fast
-- enough (a run 3 km or 20 min at 12:00 /km or faster, a ride 10 km or 30 min at 10 km/h or
-- faster, a swim 750 m or 20 min at 4:00 /100 m or faster). Same as qualifies() in engine.ts.
create or replace function public.session_counts(s public.workout_sessions) returns boolean
language sql stable as $$
  select s.finished_at is not null and case
    when s.kind = 'run' then (s.distance_m >= 3000 or s.duration_s >= 1200)
                             and s.duration_s <= s.distance_m * 0.72
    when s.kind = 'ride' then (s.distance_m >= 10000 or s.duration_s >= 1800)
                              and s.duration_s <= s.distance_m * 0.36
    when s.kind = 'swim' then (s.distance_m >= 750 or s.duration_s >= 1200)
                              and s.duration_s <= s.distance_m * 2.4
    else s.set_count >= 3 end;
$$;

-- Workouts that count in wars, attacks and Bellum: verified at the gym (3+ sets during a verified
-- visit), or a run, ride or swim that counts (wherever it was done).
create or replace function public.verified_sessions(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, user_id uuid, started_at timestamptz, prs int)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, s.started_at, least(s.pr_count, 3)
  from workout_sessions s
  where session_counts(s)
    and s.started_at >= p_from and s.started_at < p_to
    and (s.kind in ('run','ride','swim') or exists (
      select 1 from gym_visits v
      where v.user_id = s.user_id and visit_status(v) = 'verified'
        and s.started_at between v.in_at - interval '15 minutes' and v.out_at));
$$;
revoke execute on function public.verified_sessions(timestamptz, timestamptz) from public, anon, authenticated;

-- ───────────── Cycling and swimming boards in the Arena ─────────────
-- New metrics: 'ride_40k' and 'swim_1500' (best time in seconds, lower is better), 'ride_km' and
-- 'swim_km'. 'workouts' counts rides and swims that count too.
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
  runs as (
    select s.user_id, s.kind, s.distance_m, s.duration_s
    from workout_sessions s, since
    where s.kind in ('run','ride','swim') and session_counts(s) and s.started_at >= since.t
      and s.user_id in (select id from members)
  ),
  together as (
    select u.user_id, count(*)::numeric as value
    from (select t.owner_id as user_id, t.confirmed_at from trained_together t
          union all select t.user_id, t.confirmed_at from trained_together t) u, since
    where u.confirmed_at >= since.t and u.user_id in (select id from members)
    group by u.user_id
  ),
  vals as (
    select user_id,
      case
        when (select key from metric) = 'volume' then sum(weight_kg * work_reps)
        else max(case when exercise_id::text = (select key from metric)
                      then case when reps <= 1 then weight_kg else weight_kg * (1 + reps / 30.0) end end)
      end as value
    from sets
    where (select key from metric) not in ('together','workouts','run_5k','run_10k','vdot','run_km',
                                           'ride_40k','ride_km','swim_1500','swim_km')
    group by user_id
    union all
    select u.user_id, count(distinct u.session_id)::numeric
    from (select user_id, session_id from sets
          union all select s.user_id, s.id from workout_sessions s, since
          where s.kind in ('run','ride','swim') and session_counts(s) and s.started_at >= since.t
            and s.user_id in (select id from members)) u
    where (select key from metric) = 'workouts'
    group by u.user_id
    union all
    select r.user_id,
      case (select key from metric)
        when 'run_km' then round(sum(r.distance_m) filter (where r.kind = 'run') / 1000.0, 1)
        when 'ride_km' then round(sum(r.distance_m) filter (where r.kind = 'ride') / 1000.0, 1)
        when 'swim_km' then round(sum(r.distance_m) filter (where r.kind = 'swim') / 1000.0, 1)
        when 'vdot' then max(vdot(r.distance_m, r.duration_s)) filter (where r.kind = 'run')
        when 'run_5k' then round(min(r.duration_s * 5000.0 / r.distance_m)
                                 filter (where r.kind = 'run' and r.distance_m between 5000 and 5250))
        when 'run_10k' then round(min(r.duration_s * 10000.0 / r.distance_m)
                                  filter (where r.kind = 'run' and r.distance_m between 10000 and 10500))
        when 'ride_40k' then round(min(r.duration_s * 40000.0 / r.distance_m)
                                   filter (where r.kind = 'ride' and r.distance_m between 40000 and 42000))
        when 'swim_1500' then round(min(r.duration_s * 1500.0 / r.distance_m)
                                    filter (where r.kind = 'swim' and r.distance_m between 1500 and 1575))
      end
    from runs r
    where (select key from metric) in ('run_5k','run_10k','vdot','run_km','ride_40k','ride_km','swim_1500','swim_km')
    group by r.user_id
    union all
    select t.user_id, t.value from together t where (select key from metric) = 'together'
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
  -- away bodyweight. The caller sees their own score. Times rank fastest first.
  select rank() over (order by case when (select key from metric) in ('run_5k','run_10k','ride_40k','swim_1500')
                                    then -v.value else v.value end desc nulls last),
         p.id, p.username, p.display_name, p.avatar_url,
         case when (select dots from metric) and p.id <> auth.uid() then null else round(v.value, 1) end
  from scored v join profiles p on p.id = v.user_id
  where v.value is not null
  order by 1
  limit 500;
$$;
