-- Run in the SQL editor after 2026-11-27-cardio.sql (safe to run again).
-- Grids (Matyáš, 2026-11-27): the training ground of a ludus and of a tribe, and your own house,
-- are grids you build on (src/lib/game/grounds.ts). The heart stands at (0, 0): the ludus's school
-- or the tribe's arena (3×3), your house (2×2). A piece goes on free tiles touching what is built,
-- at most 15 tiles from the heart. Ludus and tribe pay from their hours (anyone builds, nothing
-- moves); your house pays from your own hours and you may move its pieces.

create table if not exists public.ground_pieces (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('ludus','gym','home')),
  owner_id uuid not null,
  piece text not null,
  i int not null check (i between -15 and 15),
  j int not null check (j between -15 and 15),
  placed_by uuid references public.profiles(id) on delete set null,
  placed_at timestamptz not null default now()
);
create index if not exists ground_pieces_owner on public.ground_pieces(owner_kind, owner_id);
alter table public.ground_pieces enable row level security;
drop policy if exists "ground pieces read" on public.ground_pieces;
create policy "ground pieces read" on public.ground_pieces for select to authenticated using (true);

-- A piece's size in tiles (same as groundSize()).
create or replace function public.ground_size(p_kind text, p_piece text) returns int
language sql immutable as $$
  select case
    when p_piece = '__root' then case when p_kind = 'home' then 2 else 3 end
    when p_piece in ('palisade','barracks','temple','arch','baths') then 2
    else 1 end;
$$;

-- Minutes a piece costs on a grid, null when it cannot be built there (same as GROUND_ITEMS:
-- hours × 60, a tribe pays 3×). Fortress buildings are not here: start_building() pays for them.
create or replace function public.ground_minutes(p_kind text, p_piece text) returns int
language sql immutable as $$
  select (x.h * 60 * case when p_kind = 'gym' then 3 else 1 end)::int
  from (select case
    when p_piece in ('palus','brazier') then 2
    when p_piece in ('water-trough','halteres-1','pullup-1') then 3
    when p_piece in ('tree-cypress','tree-pine','banner','amphorae','cart') then 1
    when p_piece = 'statue' then 5
    when p_kind in ('ludus','gym') then case p_piece
      when 'weapon-rack' then 2 when 'halteres-2' then 6 when 'halteres-3' then 10
      when 'pullup-2' then 6 when 'pullup-3' then 10
      when 'wall-1-a' then 1 when 'wall-1-b' then 1 when 'wall-1-tower' then 3
      when 'wall-2-a' then 2 when 'wall-2-b' then 2 when 'wall-2-tower' then 5
      when 'wall-3-a' then 3 when 'wall-3-b' then 3 when 'wall-3-tower' then 8 end
    when p_kind = 'home' then case p_piece
      when 'arch' then 20 when 'baths' then 30
      when 'hortus' then 5 when 'fountain' then 5 when 'pergola' then 5
      when 'lararium' then 5 when 'palaestra' then 5 end
    end as h) x
  where x.h is not null;
$$;

-- Can a piece stand at (i, j)? Free tiles, sharing an edge with what is built, within reach.
create or replace function public.ground_fits(p_kind text, p_owner uuid, p_piece text, p_i int, p_j int,
                                              p_without uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  with pieces as (
    select 0 as i, 0 as j, ground_size(p_kind, '__root') as n
    union all
    select g.i, g.j, ground_size(p_kind, g.piece) from ground_pieces g
    where g.owner_kind = p_kind and g.owner_id = p_owner and g.id is distinct from p_without
  ),
  taken as (
    select p.i + a as i, p.j + b as j
    from pieces p, generate_series(0, p.n - 1) a, generate_series(0, p.n - 1) b
  ),
  mine as (
    select p_i + a as i, p_j + b as j
    from generate_series(0, ground_size(p_kind, p_piece) - 1) a,
         generate_series(0, ground_size(p_kind, p_piece) - 1) b
  )
  select abs(p_i) <= 15 and abs(p_j) <= 15
     and abs(p_i + ground_size(p_kind, p_piece) - 1) <= 15
     and abs(p_j + ground_size(p_kind, p_piece) - 1) <= 15
     and not exists (select 1 from mine m join taken t on t.i = m.i and t.j = m.j)
     and exists (select 1 from mine m join taken t on abs(t.i - m.i) + abs(t.j - m.j) = 1);
$$;
revoke execute on function public.ground_fits(text, uuid, text, int, int, uuid) from public, anon, authenticated;

-- Buys a piece and puts it down: from the ludus's or tribe's hours, or your own for your house.
create or replace function public.buy_ground_piece(p_kind text, p_id uuid, p_piece text, p_i int, p_j int)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  owner uuid;
  cost int;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_kind = 'home' then owner := auth.uid();
  elsif p_kind in ('ludus','gym') then
    if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
    owner := p_id;
  else raise exception 'Unknown ground';
  end if;
  perform pg_advisory_xact_lock(hashtext('ground:' || p_kind || owner::text));
  cost := ground_minutes(p_kind, p_piece);
  if cost is null then raise exception 'That cannot be built here'; end if;
  if p_kind = 'home' and p_piece in ('hortus','fountain','pergola','lararium','palaestra')
     and exists (select 1 from home_items where user_id = owner and item = p_piece) then
    raise exception 'You have it already';
  end if;
  if not ground_fits(p_kind, owner, p_piece, p_i, p_j) then
    raise exception 'It has to touch what is built, on free tiles';
  end if;
  if p_kind = 'home' then
    insert into homes (user_id) values (owner) on conflict do nothing;
    update homes set minutes = minutes - cost where user_id = owner and minutes >= cost;
    if not found then raise exception 'You need % h of your own', ceil(cost / 60.0)::int; end if;
    if p_piece in ('hortus','fountain','pergola','lararium','palaestra') then
      insert into home_items (user_id, item) values (owner, p_piece) on conflict do nothing;
    end if;
  else
    perform spend_hours(p_kind, owner, cost);
  end if;
  insert into ground_pieces (owner_kind, owner_id, piece, i, j, placed_by)
  values (p_kind, owner, p_piece, p_i, p_j, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.buy_ground_piece(text, uuid, text, int, int) from public, anon;
grant execute on function public.buy_ground_piece(text, uuid, text, int, int) to authenticated;

-- Starts a fortress building (its level 1) at a spot on the training ground.
create or replace function public.build_on_ground(p_kind text, p_id uuid, p_building text, p_i int, p_j int)
returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  ready timestamptz;
begin
  if p_kind not in ('ludus','gym') then raise exception 'Unknown ground'; end if;
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('ground:' || p_kind || p_id::text));
  if exists (select 1 from ground_pieces where owner_kind = p_kind and owner_id = p_id and piece = p_building) then
    raise exception 'It stands already: upgrade it';
  end if;
  if not ground_fits(p_kind, p_id, p_building, p_i, p_j) then
    raise exception 'It has to touch what is built, on free tiles';
  end if;
  ready := start_building(p_kind, p_id, p_building);
  insert into ground_pieces (owner_kind, owner_id, piece, i, j, placed_by)
  values (p_kind, p_id, p_building, p_i, p_j, auth.uid());
  return ready;
end;
$$;
revoke execute on function public.build_on_ground(text, uuid, text, int, int) from public, anon;
grant execute on function public.build_on_ground(text, uuid, text, int, int) to authenticated;

-- Puts down, for free, a building built before the grids existed.
create or replace function public.place_built(p_kind text, p_id uuid, p_building text, p_i int, p_j int)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if p_kind not in ('ludus','gym') then raise exception 'Unknown ground'; end if;
  if not is_fortress_member(p_kind, p_id) then raise exception 'You are not a member'; end if;
  perform pg_advisory_xact_lock(hashtext('ground:' || p_kind || p_id::text));
  if not exists (select 1 from buildings where owner_kind = p_kind and owner_id = p_id and building = p_building
                 and (level > 0 or target_level is not null)) then
    raise exception 'Build it first';
  end if;
  if exists (select 1 from ground_pieces where owner_kind = p_kind and owner_id = p_id and piece = p_building) then
    raise exception 'It stands already';
  end if;
  if not ground_fits(p_kind, p_id, p_building, p_i, p_j) then
    raise exception 'It has to touch what is built, on free tiles';
  end if;
  insert into ground_pieces (owner_kind, owner_id, piece, i, j, placed_by)
  values (p_kind, p_id, p_building, p_i, p_j, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.place_built(text, uuid, text, int, int) from public, anon;
grant execute on function public.place_built(text, uuid, text, int, int) to authenticated;

-- Puts down, for free, a thing by your house bought before the house was a grid.
create or replace function public.place_home_item(p_item text, p_i int, p_j int) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ground:home' || auth.uid()::text));
  if not exists (select 1 from home_items where user_id = auth.uid() and item = p_item) then
    raise exception 'Build it first';
  end if;
  if exists (select 1 from ground_pieces where owner_kind = 'home' and owner_id = auth.uid() and piece = p_item) then
    raise exception 'It stands already';
  end if;
  if not ground_fits('home', auth.uid(), p_item, p_i, p_j) then
    raise exception 'It has to touch what is built, on free tiles';
  end if;
  insert into ground_pieces (owner_kind, owner_id, piece, i, j, placed_by)
  values ('home', auth.uid(), p_item, p_i, p_j, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.place_home_item(text, int, int) from public, anon;
grant execute on function public.place_home_item(text, int, int) to authenticated;

-- Moves a piece of your own house.
create or replace function public.move_home_piece(p_piece_id uuid, p_i int, p_j int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  g ground_pieces;
begin
  perform pg_advisory_xact_lock(hashtext('ground:home' || auth.uid()::text));
  select * into g from ground_pieces where id = p_piece_id and owner_kind = 'home' and owner_id = auth.uid();
  if g.id is null then raise exception 'That is not yours'; end if;
  if not ground_fits('home', auth.uid(), g.piece, p_i, p_j, g.id) then
    raise exception 'It has to touch what is built, on free tiles';
  end if;
  update ground_pieces set i = p_i, j = p_j where id = g.id;
end;
$$;
revoke execute on function public.move_home_piece(uuid, int, int) from public, anon;
grant execute on function public.move_home_piece(uuid, int, int) to authenticated;

-- A closed ludus takes its training ground with it.
create or replace function public.ground_of_ludus_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from ground_pieces where owner_kind = 'ludus' and owner_id = old.id;
  return old;
end;
$$;
drop trigger if exists ground_of_ludus_gone on public.ludi;
create trigger ground_of_ludus_gone after delete on public.ludi
  for each row execute function public.ground_of_ludus_gone();
