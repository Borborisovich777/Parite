create extension if not exists pgcrypto;

do $$ begin
  create type public.currency_code as enum ('AED', 'CNY', 'KZT');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_role as enum ('admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_status as enum ('pending', 'approved', 'rejected', 'removed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  base_currency public.currency_code not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  access_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  removed_at timestamptz
);

create unique index if not exists members_trip_display_name_lower_idx
  on public.members (trip_id, lower(trim(display_name)))
  where status <> 'removed';

create index if not exists members_trip_idx on public.members (trip_id);
create index if not exists members_access_token_idx on public.members (access_token);

alter table public.trips enable row level security;
alter table public.members enable row level security;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.create_trip_with_admin(
  trip_name text,
  base_currency public.currency_code,
  display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trip public.trips;
  new_member public.members;
  candidate_code text;
begin
  loop
    candidate_code := public.generate_invite_code();
    exit when not exists (select 1 from public.trips where invite_code = candidate_code);
  end loop;

  insert into public.trips (name, base_currency, invite_code)
  values (trim(trip_name), base_currency, candidate_code)
  returning * into new_trip;

  insert into public.members (trip_id, display_name, role, status, approved_at)
  values (new_trip.id, trim(display_name), 'admin', 'approved', now())
  returning * into new_member;

  return jsonb_build_object(
    'trip', to_jsonb(new_trip),
    'member', to_jsonb(new_member)
  );
end;
$$;

create or replace function public.request_join_by_invite(
  invite_code_input text,
  display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found_trip public.trips;
  new_member public.members;
begin
  select *
  into found_trip
  from public.trips
  where invite_code = upper(trim(invite_code_input));

  if found_trip.id is null then
    raise exception 'Trip not found';
  end if;

  insert into public.members (trip_id, display_name, role, status)
  values (found_trip.id, trim(display_name), 'member', 'pending')
  returning * into new_member;

  return jsonb_build_object(
    'trip', to_jsonb(found_trip),
    'member', to_jsonb(new_member)
  );
end;
$$;

create or replace function public.load_member_session(access_token_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.members;
  current_trip public.trips;
  trip_members jsonb;
begin
  select *
  into current_member
  from public.members
  where access_token = access_token_input;

  if current_member.id is null then
    raise exception 'Member session not found';
  end if;

  select *
  into current_trip
  from public.trips
  where id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
  into trip_members
  from public.members m
  where m.trip_id = current_member.trip_id;

  return jsonb_build_object(
    'trip', to_jsonb(current_trip),
    'member', to_jsonb(current_member),
    'members', trip_members
  );
end;
$$;

create or replace function public.is_admin_token(admin_access_token_input text, target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where access_token = admin_access_token_input
      and trip_id = target_trip_id
      and role = 'admin'
      and status = 'approved'
  )
$$;

create or replace function public.approve_member(
  admin_access_token_input text,
  member_id_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
begin
  select * into target_member from public.members where id = member_id_input;
  if target_member.id is null then
    raise exception 'Member not found';
  end if;
  if not public.is_admin_token(admin_access_token_input, target_member.trip_id) then
    raise exception 'Admin access required';
  end if;

  update public.members
  set status = 'approved',
      approved_at = coalesce(approved_at, now()),
      removed_at = null
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member);
end;
$$;

create or replace function public.reject_member(
  admin_access_token_input text,
  member_id_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
begin
  select * into target_member from public.members where id = member_id_input;
  if target_member.id is null then
    raise exception 'Member not found';
  end if;
  if not public.is_admin_token(admin_access_token_input, target_member.trip_id) then
    raise exception 'Admin access required';
  end if;

  update public.members
  set status = 'rejected'
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member);
end;
$$;

create or replace function public.remove_member(
  admin_access_token_input text,
  member_id_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  admin_member public.members;
begin
  select * into target_member from public.members where id = member_id_input;
  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  select *
  into admin_member
  from public.members
  where access_token = admin_access_token_input
    and trip_id = target_member.trip_id
    and role = 'admin'
    and status = 'approved';

  if admin_member.id is null then
    raise exception 'Admin access required';
  end if;
  if admin_member.id = target_member.id then
    raise exception 'Admins cannot remove themselves';
  end if;

  update public.members
  set status = 'removed',
      removed_at = now()
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member);
end;
$$;

grant execute on function public.create_trip_with_admin(text, public.currency_code, text) to anon, authenticated;
grant execute on function public.request_join_by_invite(text, text) to anon, authenticated;
grant execute on function public.load_member_session(text) to anon, authenticated;
grant execute on function public.approve_member(text, uuid) to anon, authenticated;
grant execute on function public.reject_member(text, uuid) to anon, authenticated;
grant execute on function public.remove_member(text, uuid) to anon, authenticated;
