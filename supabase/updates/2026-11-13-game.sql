-- The game layer (docs/GAME.md): XP, leagues, verified gym visits, ludus, denarii, fortresses,
-- wars, duels and Bellum. Run once in the SQL editor after the earlier updates.
-- Numbers mirror src/lib/game/config.ts. Timers need no cron: rows store when something is ready
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
