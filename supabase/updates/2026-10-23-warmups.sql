-- Run once in the SQL editor: warm-up sets (logged, but never counted to volume, bests or PRs).
-- Run 2026-10-23-each-side.sql first.
alter table public.set_entries add column if not exists warmup boolean not null default false;

create or replace view public.exercise_bests with (security_invoker = true) as
select s.user_id, e.exercise_id,
       max(e.weight_kg) as best_weight_kg,
       max(case when e.reps <= 1 then e.weight_kg else e.weight_kg * (1 + e.reps / 30.0) end) as best_e1rm_kg
from public.set_entries e
join public.workout_sessions s on s.id = e.session_id
where e.done and not e.warmup and s.finished_at is not null
group by s.user_id, e.exercise_id;

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
