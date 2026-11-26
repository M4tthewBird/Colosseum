-- Run in the SQL editor after 2026-11-13-game.sql (safe to run again): a ludus needs 2 members to
-- fight (not 3), and war points are divided by at least 2 active members. Same as LUDUS.minMembers
-- in src/lib/game/config.ts.

-- Members who trained in the 14 days before, at least 2.
create or replace function public.ludus_active(p_ludus uuid, p_at timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select greatest(2, count(distinct m.user_id))::int
  from ludus_members m join workout_sessions s on s.user_id = m.user_id
  where m.ludus_id = p_ludus and s.finished_at is not null and s.set_count >= 3
    and s.started_at >= p_at - interval '14 days' and s.started_at < p_at;
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
  select a, d, round(a / greatest(2, attacker_active), 1),
         round(d / greatest(2, defender_active) * (1 + 0.05 * defender_palisade), 1)
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
  if (select count(*) from ludus_members where ludus_id = mine) < 2 then raise exception 'Your ludus needs 2 members to fight'; end if;
  if (select count(*) from ludus_members where ludus_id = p_defender) < 2 then raise exception 'They need 2 members to fight'; end if;
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
