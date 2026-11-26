-- Run in the SQL editor after the 2026-11-13 game updates (safe to run again).
-- The city and the map (docs/GAME.md §9–10): fighting styles, gear bought with denarii, tribe
-- attacks between gyms of a city, territories and defence pledges. Numbers match
-- src/lib/game/config.ts (STYLE, GEAR, TRIBE_WAR) and src/lib/game/gear.ts.

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
