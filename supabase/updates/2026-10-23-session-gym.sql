-- Run once in the SQL editor: the gym a workout was done at (confirmed when it starts).
alter table public.workout_sessions add column if not exists gym_id uuid references public.gyms(id) on delete set null;

-- Training now leaves out members who are training at another gym.
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
