-- Run once in the SQL editor: "going to train" plans and invites, and workouts confirmed as
-- done together by QR code (with a Together metric on the leaderboard).

-- A plan to train: open to friends and the gym, or an invite to one friend (invitee_id).
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  planned_at timestamptz not null,
  gym_id uuid references public.gyms(id) on delete set null,
  note text not null default '' check (length(note) <= 140),
  invitee_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id is null or invitee_id <> user_id)
);
create index if not exists training_plans_when on public.training_plans(planned_at);

-- Who is in (going = true) or can't make it (going = false).
create table if not exists public.training_plan_answers (
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  going boolean not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

-- Confirmed by scanning a QR code of owner_id's workout. Written only by confirm_together().
create table if not exists public.trained_together (
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (session_id, user_id),
  check (owner_id <> user_id)
);
create index if not exists trained_together_when on public.trained_together(confirmed_at desc);

alter table public.training_plans enable row level security;
alter table public.training_plan_answers enable row level security;
alter table public.trained_together enable row level security;

drop policy if exists "plans read" on public.training_plans;
drop policy if exists "plans insert" on public.training_plans;
drop policy if exists "plans delete" on public.training_plans;
drop policy if exists "plan answers read" on public.training_plan_answers;
drop policy if exists "plan answers write" on public.training_plan_answers;
drop policy if exists "together read" on public.trained_together;
drop policy if exists "together delete" on public.trained_together;

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

-- The leaderboard learns the metric 'together': confirmed workouts with someone.
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
