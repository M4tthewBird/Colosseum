-- Run in the SQL editor after the 2026-11-14 updates (safe to run again).
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
