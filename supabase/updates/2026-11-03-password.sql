-- Run in the SQL editor after 2026-11-03-admin.sql (safe to run again): a forgotten password.
-- With a recovery code the user sets a new password on the sign-in screen. Without one they
-- send a request from there; the admin sets a temporary password (Admin → Users), which the
-- app asks them to replace right after signing in. No email anywhere.

create extension if not exists pgcrypto with schema extensions;

-- Same shape as the hashes Supabase Auth writes itself (bcrypt).
create or replace function public.set_account_password(p_user uuid, p_password text) returns void
language sql security definer set search_path = public, extensions as $$
  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
  where id = p_user;
$$;
-- Only the functions below may call it.
revoke all on function public.set_account_password(uuid, text) from public, anon, authenticated;

-- 16 characters from an alphabet without look-alikes (no 0/O, 1/I): 80 random bits.
create or replace function public.random_code(p_length int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(p_length);
  code text := '';
begin
  for i in 0 .. p_length - 1 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- What the user typed, as it was stored: letters and digits only, upper case.
create or replace function public.normalize_code(p_code text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ───────────── Recovery codes ─────────────
-- Only a hash is kept; the code itself is shown to the user once.
create table if not exists public.recovery_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;  -- no policies: functions only

create or replace function public.has_recovery_code() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from recovery_codes where user_id = auth.uid());
$$;

-- A new code for the signed-in user (the old one stops working). Shown as XXXX-XXXX-XXXX-XXXX.
create or replace function public.new_recovery_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  code := random_code(16);
  insert into recovery_codes (user_id, code_hash) values (auth.uid(), crypt(code, gen_salt('bf', 10)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4) || '-' || substr(code, 13, 4);
end;
$$;

-- Failed tries per username, so a code cannot be guessed (10 an hour).
create table if not exists public.password_attempts (
  username text not null,
  at timestamptz not null default now()
);
create index if not exists password_attempts_username on public.password_attempts(username, at);
alter table public.password_attempts enable row level security;  -- no policies: functions only

-- Signed out, from the sign-in screen. Returns 'ok', 'wrong', 'limit' or 'short' (an error would
-- also undo the failed try being counted). The code is used up; the app offers a new one.
create or replace function public.reset_password_with_code(p_username text, p_code text, p_password text)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uname text := lower(trim(coalesce(p_username, '')));
  uid uuid;
  stored text;
begin
  if length(coalesce(p_password, '')) < 8 then return 'short'; end if;
  if (select count(*) from password_attempts where username = uname and at > now() - interval '1 hour') >= 10 then
    return 'limit';
  end if;
  select p.id, r.code_hash into uid, stored
  from profiles p join recovery_codes r on r.user_id = p.id
  where p.username = uname;
  if uid is null or stored <> crypt(normalize_code(p_code), stored) then
    insert into password_attempts (username) values (uname);
    return 'wrong';
  end if;
  perform set_account_password(uid, p_password);
  delete from recovery_codes where user_id = uid;
  delete from password_attempts where username = uname;
  delete from password_resets where user_id = uid;
  return 'ok';
end;
$$;

-- ───────────── Without a code: ask the admin ─────────────
create table if not exists public.password_help (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  user_id uuid references public.profiles(id) on delete cascade,  -- null: no such username
  contact text not null check (length(contact) between 3 and 200),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.password_help enable row level security;  -- no policies: functions only

-- Signed out. Says 'ok' whether or not the username exists, so it cannot be used to find accounts.
create or replace function public.request_password_help(p_username text, p_contact text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  uname text := lower(trim(coalesce(p_username, '')));
  how text := trim(coalesce(p_contact, ''));
begin
  if length(uname) < 3 or length(how) < 3 then return 'short'; end if;
  if (select count(*) from password_help where username = uname and created_at > now() - interval '1 day') >= 3
     or (select count(*) from password_help where created_at > now() - interval '1 day') >= 100 then
    return 'limit';
  end if;
  insert into password_help (username, user_id, contact)
  values (uname, (select id from profiles where username = uname), left(how, 200));
  return 'ok';
end;
$$;

-- ───────────── Temporary passwords ─────────────
-- A row here: the admin set a temporary password, the user must choose their own after signing in.
create table if not exists public.password_resets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.password_resets enable row level security;
drop policy if exists "password resets own" on public.password_resets;
create policy "password resets own" on public.password_resets for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "password resets done" on public.password_resets;
create policy "password resets done" on public.password_resets for delete to authenticated
  using (user_id = auth.uid());

-- ───────────── For the admin ─────────────
create or replace function public.admin_password_help()
returns table (id uuid, username text, user_id uuid, display_name text, contact text,
               created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select h.id, h.username, h.user_id, p.display_name, h.contact, h.created_at
  from password_help h left join profiles p on p.id = h.user_id
  where h.handled_at is null
  order by h.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_password_help_done(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update password_help set handled_at = now() where id = p_id;
end;
$$;

create or replace function public.admin_find_users(p_query text)
returns table (id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  q text := lower(trim(coalesce(p_query, '')));
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.created_at
  from profiles p
  where q <> '' and (p.username like '%' || q || '%' or lower(p.display_name) like '%' || q || '%')
  order by p.username = q desc, p.username
  limit 20;
end;
$$;

-- Returns the temporary password, to give to the user. Their open requests are marked handled.
create or replace function public.admin_reset_password(p_user uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  temp_password text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No such user'; end if;
  temp_password := lower(random_code(10));
  perform set_account_password(p_user, temp_password);
  insert into password_resets (user_id) values (p_user)
  on conflict (user_id) do update set created_at = now();
  update password_help set handled_at = now() where user_id = p_user and handled_at is null;
  return temp_password;
end;
$$;
