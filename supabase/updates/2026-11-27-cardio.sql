-- Run in the SQL editor after 2026-11-27-hours.sql (safe to run again).
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
