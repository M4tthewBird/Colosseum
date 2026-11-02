-- Run in the SQL editor (safe to run again): whoever started a gym challenge can change or cancel
-- it, and a repetitions challenge can count several exercises (pull-ups and chin-ups).
drop policy if exists "challenges update" on public.gym_challenges;
drop policy if exists "challenges delete" on public.gym_challenges;
create policy "challenges update" on public.gym_challenges for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and gym_id = (select home_gym_id from profiles where id = auth.uid()));
create policy "challenges delete" on public.gym_challenges for delete to authenticated
  using (created_by = auth.uid());

alter table public.gym_challenges add column if not exists exercise_ids uuid[] not null default '{}';
update public.gym_challenges set exercise_ids = array[exercise_id]
  where exercise_id is not null and cardinality(exercise_ids) = 0;

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
