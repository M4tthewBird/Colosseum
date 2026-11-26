-- Run in the SQL editor after 2026-11-14-city.sql (safe to run again).
-- Running (docs/GAME.md §11): a run is a workout_sessions row of kind 'run' with distance and
-- time and no sets. A run that counts is worth one workout: it counts in ludus wars, tribe
-- attacks, Bellum and duels like a verified workout. Numbers match RUN in src/lib/game/config.ts
-- and src/lib/running.ts.

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
