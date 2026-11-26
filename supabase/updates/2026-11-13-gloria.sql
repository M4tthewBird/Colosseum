-- Gloria: a ludus's lasting fame from wars, its war record (badges come from it) and the ludus
-- ranking (docs/GAME.md, section 6). Run in the SQL editor after 2026-11-13-game.sql (safe to run
-- again). Numbers mirror GLORIA in src/lib/game/config.ts and src/lib/game/gloria.ts.

alter table public.ludi add column if not exists gloria int not null default 0 check (gloria >= 0);
alter table public.ludi add column if not exists best_gloria int not null default 0;
alter table public.ludi add column if not exists wins int not null default 0;
alter table public.ludi add column if not exists losses int not null default 0;
alter table public.ludi add column if not exists defences int not null default 0;  -- won as defender
alter table public.ludi add column if not exists upsets int not null default 0;    -- won against more gloria
alter table public.ludi add column if not exists streak int not null default 0;
alter table public.ludi add column if not exists best_streak int not null default 0;

-- Gloria each side won or lost in the war (null until settled).
alter table public.ludus_wars add column if not exists attacker_gloria int;
alter table public.ludus_wars add column if not exists defender_gloria int;

-- Applies a settled war to both records. Same as gloriaChange() and applyWar() in gloria.ts.
-- Runs once per war: a war with its gloria set is skipped.
create or replace function public.apply_war_gloria(p_war uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w ludus_wars;
  loser uuid;
  wg int;
  lg int;
  ws numeric;
  ls numeric;
  win_change int;
  lose_change int;
begin
  select * into w from ludus_wars where id = p_war for update;
  if w.id is null or w.settled_at is null or w.winner_id is null or w.attacker_gloria is not null then
    return;
  end if;
  if w.winner_id = w.attacker_id then
    loser := w.defender_id; ws := w.attacker_score; ls := w.defender_score;
  else
    loser := w.attacker_id; ws := w.defender_score; ls := w.attacker_score;
  end if;
  select gloria into wg from ludi where id = w.winner_id for update;
  select gloria into lg from ludi where id = loser for update;
  win_change := 30 + least(30, greatest(0, lg - wg) / 10);
  lose_change := case
    when coalesce(ws, 0) <= 0 or coalesce(ls, 0) >= ws * 0.9 or lg <= 0 then 0
    else -least(10, lg) end;

  update ludi set
    gloria = gloria + win_change,
    best_gloria = greatest(best_gloria, gloria + win_change),
    wins = wins + 1,
    defences = defences + (w.winner_id = w.defender_id)::int,
    upsets = upsets + (lg > wg)::int,
    streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
  where id = w.winner_id;
  update ludi set gloria = greatest(0, gloria + lose_change), losses = losses + 1, streak = 0
  where id = loser;

  update ludus_wars set
    attacker_gloria = case when w.winner_id = w.attacker_id then win_change else lose_change end,
    defender_gloria = case when w.winner_id = w.defender_id then win_change else lose_change end
  where id = p_war;
end;
$$;
revoke execute on function public.apply_war_gloria(uuid) from public, anon, authenticated;

-- settle_war from 2026-11-13-game.sql, now also giving gloria.
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
  perform apply_war_gloria(p_war);
end;
$$;
revoke execute on function public.settle_war(uuid) from public, anon;
grant execute on function public.settle_war(uuid) to authenticated;

-- Wars settled before this update get their gloria, oldest first.
do $$
declare
  r record;
begin
  for r in select id from public.ludus_wars
           where settled_at is not null and attacker_gloria is null
           order by settled_at, id loop
    perform public.apply_war_gloria(r.id);
  end loop;
end;
$$;

-- The ludus ranking: the top 50 by gloria, plus p_ludus (your own) wherever it stands.
create or replace function public.ludus_ranking(p_ludus uuid default null)
returns table (place bigint, id uuid, name text, motto text, members bigint, gloria int,
               best_gloria int, wins int, losses int, defences int, upsets int, streak int,
               best_streak int)
language sql stable security definer set search_path = public as $$
  with t as (
    select row_number() over (order by l.gloria desc, l.wins desc, l.created_at) as place,
           l.id, l.name, l.motto,
           (select count(*) from ludus_members m where m.ludus_id = l.id) as members,
           l.gloria, l.best_gloria, l.wins, l.losses, l.defences, l.upsets, l.streak, l.best_streak
    from ludi l
  )
  select * from t where place <= 50 or id = p_ludus order by place;
$$;
revoke execute on function public.ludus_ranking(uuid) from public, anon;
grant execute on function public.ludus_ranking(uuid) to authenticated;
