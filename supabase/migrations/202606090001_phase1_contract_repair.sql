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
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  display_currency text check (display_currency in ('AED', 'CNY', 'KZT')),
  access_token text not null unique,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  removed_at timestamptz
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  exchange_rate_to_base numeric(18,8) not null check (exchange_rate_to_base > 0),
  converted_amount numeric(14,2) not null check (converted_amount > 0),
  paid_by_member_id uuid not null references public.members(id),
  expense_date date not null,
  notes text not null default '',
  created_by_member_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id),
  amount_owed numeric(14,2) not null check (amount_owed >= 0),
  unique (expense_id, member_id)
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_currency public.currency_code not null,
  to_currency public.currency_code not null,
  rate numeric(18,8) not null check (rate > 0),
  updated_by_member_id uuid not null references public.members(id),
  updated_at timestamptz not null default now(),
  unique (trip_id, from_currency, to_currency),
  check (from_currency <> to_currency)
);

alter table public.trips add column if not exists id uuid default gen_random_uuid();
alter table public.trips add column if not exists name text;
alter table public.trips add column if not exists base_currency public.currency_code;
alter table public.trips add column if not exists invite_code text;
alter table public.trips add column if not exists created_at timestamptz not null default now();

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%base_currency%'
  loop
    execute format('alter table public.trips drop constraint if exists %I', constraint_record.conname);
  end loop;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.members'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%role%'
        or pg_get_constraintdef(oid) ilike '%status%'
      )
  loop
    execute format('alter table public.members drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

update public.trips
set base_currency = 'CNY'
where base_currency is null
   or upper(base_currency::text) not in ('AED', 'CNY', 'KZT');

alter table public.trips alter column base_currency drop default;

alter table public.trips
  alter column base_currency type public.currency_code
  using upper(base_currency::text)::public.currency_code;

alter table public.trips alter column base_currency set not null;

alter table public.members add column if not exists id uuid default gen_random_uuid();
alter table public.members add column if not exists trip_id uuid;
alter table public.members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.members add column if not exists display_name text;
alter table public.members add column if not exists role public.member_role not null default 'member';
alter table public.members add column if not exists status public.member_status not null default 'pending';
alter table public.members add column if not exists display_currency text check (display_currency in ('AED', 'CNY', 'KZT'));
alter table public.members add column if not exists access_token text;
alter table public.members add column if not exists created_at timestamptz not null default now();
alter table public.members add column if not exists approved_at timestamptz;
alter table public.members add column if not exists removed_at timestamptz;

alter table public.expenses add column if not exists id uuid default gen_random_uuid();
alter table public.expenses add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.expenses add column if not exists title text;
alter table public.expenses add column if not exists amount numeric(14,2);
alter table public.expenses add column if not exists currency public.currency_code;
alter table public.expenses add column if not exists exchange_rate_to_base numeric(18,8);
alter table public.expenses add column if not exists converted_amount numeric(14,2);
alter table public.expenses add column if not exists paid_by_member_id uuid references public.members(id);
alter table public.expenses add column if not exists expense_date date;
alter table public.expenses add column if not exists notes text not null default '';
alter table public.expenses add column if not exists created_by_member_id uuid references public.members(id);
alter table public.expenses add column if not exists created_at timestamptz not null default now();
alter table public.expenses add column if not exists updated_at timestamptz not null default now();

alter table public.expense_splits add column if not exists id uuid default gen_random_uuid();
alter table public.expense_splits add column if not exists expense_id uuid references public.expenses(id) on delete cascade;
alter table public.expense_splits add column if not exists member_id uuid references public.members(id);
alter table public.expense_splits add column if not exists amount_owed numeric(14,2);

alter table public.exchange_rates add column if not exists id uuid default gen_random_uuid();
alter table public.exchange_rates add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.exchange_rates add column if not exists from_currency public.currency_code;
alter table public.exchange_rates add column if not exists to_currency public.currency_code;
alter table public.exchange_rates add column if not exists rate numeric(18,8);
alter table public.exchange_rates add column if not exists updated_by_member_id uuid references public.members(id);
alter table public.exchange_rates add column if not exists updated_at timestamptz not null default now();

update public.members
set role = 'member'
where role is null
   or lower(role::text) not in ('admin', 'member');

update public.members
set status = 'pending'
where status is null
   or lower(status::text) not in ('pending', 'approved', 'rejected', 'removed');

alter table public.members alter column role drop default;
alter table public.members alter column status drop default;

alter table public.members
  alter column role type public.member_role
  using lower(role::text)::public.member_role;

alter table public.members
  alter column status type public.member_status
  using lower(status::text)::public.member_status;

alter table public.members alter column role set default 'member';
alter table public.members alter column status set default 'pending';

create or replace function public.generate_member_access_token()
returns text
language sql
volatile
as $$
  select md5(clock_timestamp()::text || random()::text || txid_current()::text)
      || md5(random()::text || clock_timestamp()::text || txid_current()::text);
$$;

update public.members
set access_token = public.generate_member_access_token()
where access_token is null;

alter table public.members alter column access_token set default public.generate_member_access_token();
alter table public.members alter column access_token set not null;

create unique index if not exists trips_invite_code_idx on public.trips (invite_code);
create unique index if not exists members_access_token_unique_idx on public.members (access_token);
create unique index if not exists members_trip_user_id_unique_idx
  on public.members (trip_id, user_id)
  where user_id is not null;
create unique index if not exists members_trip_display_name_lower_idx
  on public.members (trip_id, lower(trim(display_name)))
  where status <> 'removed';
create index if not exists members_trip_idx on public.members (trip_id);
create index if not exists members_access_token_idx on public.members (access_token);
create index if not exists expenses_trip_idx on public.expenses (trip_id);
create index if not exists expenses_paid_by_member_idx on public.expenses (paid_by_member_id);
create index if not exists expenses_created_by_member_idx on public.expenses (created_by_member_id);
create index if not exists expense_splits_expense_idx on public.expense_splits (expense_id);
create index if not exists expense_splits_member_idx on public.expense_splits (member_id);
create unique index if not exists expense_splits_expense_member_unique_idx
  on public.expense_splits (expense_id, member_id);
create unique index if not exists exchange_rates_trip_pair_unique_idx
  on public.exchange_rates (trip_id, from_currency, to_currency);
create index if not exists exchange_rates_trip_idx on public.exchange_rates (trip_id);
create index if not exists exchange_rates_updated_by_member_idx on public.exchange_rates (updated_by_member_id);

alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.exchange_rates enable row level security;

drop function if exists public.create_trip_with_admin(text, text, text);
drop function if exists public.restore_trip_access(text);
drop function if exists public.get_trip_access_by_token(text);

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

create or replace function public.load_auth_workspace(member_id_input uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_member public.members;
  current_trip public.trips;
  trip_members jsonb := '[]'::jsonb;
  trip_expenses jsonb := '[]'::jsonb;
  trip_splits jsonb := '[]'::jsonb;
  trip_exchange_rates jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  if member_id_input is not null then
    select *
    into current_member
    from public.members
    where id = member_id_input
      and user_id = current_user_id;
  else
    select *
    into current_member
    from public.members
    where user_id = current_user_id
    order by created_at desc
    limit 1;
  end if;

  if current_member.id is null then
    return jsonb_build_object(
      'trip', null,
      'member', null,
      'members', '[]'::jsonb,
      'expenses', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'exchangeRates', '[]'::jsonb
    );
  end if;

  if current_member.status <> 'approved' then
    return jsonb_build_object(
      'trip', null,
      'member', to_jsonb(current_member) - 'access_token',
      'members', '[]'::jsonb,
      'expenses', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'exchangeRates', '[]'::jsonb
    );
  end if;

  select *
  into current_trip
  from public.trips
  where id = current_member.trip_id;

  if current_member.role = 'admin' then
    select coalesce(jsonb_agg(to_jsonb(m) - 'access_token' order by m.created_at asc), '[]'::jsonb)
    into trip_members
    from public.members m
    where m.trip_id = current_member.trip_id;
  else
    select coalesce(jsonb_agg(to_jsonb(m) - 'access_token' order by m.created_at asc), '[]'::jsonb)
    into trip_members
    from public.members m
    where m.trip_id = current_member.trip_id
      and (m.status = 'approved' or m.id = current_member.id);
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.expense_date desc, e.created_at desc), '[]'::jsonb)
  into trip_expenses
  from public.expenses e
  where e.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)
  into trip_splits
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.from_currency, r.to_currency), '[]'::jsonb)
  into trip_exchange_rates
  from public.exchange_rates r
  where r.trip_id = current_member.trip_id;

  return jsonb_build_object(
    'trip', to_jsonb(current_trip),
    'member', to_jsonb(current_member) - 'access_token',
    'members', trip_members,
    'expenses', trip_expenses,
    'splits', trip_splits,
    'exchangeRates', trip_exchange_rates
  );
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
  current_user_id uuid := auth.uid();
  new_trip public.trips;
  new_member public.members;
  candidate_code text;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  if char_length(trim(coalesce(trip_name, ''))) = 0 then
    raise exception 'Trip name is required';
  end if;

  if char_length(trim(coalesce(display_name, ''))) = 0 then
    raise exception 'Display name is required';
  end if;

  loop
    candidate_code := public.generate_invite_code();
    exit when not exists (select 1 from public.trips where invite_code = candidate_code);
  end loop;

  insert into public.trips (name, base_currency, invite_code)
  values (trim(trip_name), base_currency, candidate_code)
  returning * into new_trip;

  insert into public.members (trip_id, user_id, display_name, role, status, access_token, approved_at)
  values (new_trip.id, current_user_id, trim(display_name), 'admin', 'approved', public.generate_member_access_token(), now())
  returning * into new_member;

  return public.load_auth_workspace(new_member.id);
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
  current_user_id uuid := auth.uid();
  found_trip public.trips;
  existing_member public.members;
  existing_name_member public.members;
  new_member public.members;
  requested_display_name text;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  requested_display_name := trim(coalesce(display_name, ''));

  if char_length(trim(coalesce(invite_code_input, ''))) = 0 then
    raise exception 'Invite code is required';
  end if;

  if char_length(requested_display_name) = 0 then
    raise exception 'Display name is required';
  end if;

  select *
  into found_trip
  from public.trips
  where invite_code = upper(trim(invite_code_input));

  if found_trip.id is null then
    raise exception 'Trip not found';
  end if;

  select *
  into existing_member
  from public.members m
  where m.trip_id = found_trip.id
    and m.user_id = current_user_id
  limit 1;

  if existing_member.id is not null then
    return public.load_auth_workspace(existing_member.id);
  end if;

  select *
  into existing_name_member
  from public.members m
  where m.trip_id = found_trip.id
    and lower(trim(m.display_name)) = lower(requested_display_name)
    and m.status <> 'removed'
  limit 1;

  if existing_name_member.id is not null then
    raise exception 'Display name already used in this trip. Use another name or ask the admin to remove or reapprove the previous member.';
  end if;

  begin
    insert into public.members (trip_id, user_id, display_name, role, status, access_token)
    values (found_trip.id, current_user_id, requested_display_name, 'member', 'pending', public.generate_member_access_token())
    returning * into new_member;
  exception
    when unique_violation then
      raise exception 'Display name already used in this trip. Use another name or ask the admin to remove or reapprove the previous member.';
  end;

  return public.load_auth_workspace(new_member.id);
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
  trip_members jsonb := '[]'::jsonb;
  trip_expenses jsonb := '[]'::jsonb;
  trip_splits jsonb := '[]'::jsonb;
  trip_exchange_rates jsonb := '[]'::jsonb;
begin
  select *
  into current_member
  from public.members
  where access_token = access_token_input;

  if current_member.id is null then
    raise exception 'Member session not found';
  end if;

  if current_member.status <> 'approved' then
    return jsonb_build_object(
      'trip', null,
      'member', to_jsonb(current_member),
      'members', '[]'::jsonb,
      'expenses', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'exchangeRates', '[]'::jsonb
    );
  end if;

  select *
  into current_trip
  from public.trips
  where id = current_member.trip_id;

  if current_member.role = 'admin' then
    select coalesce(jsonb_agg(to_jsonb(m) - 'access_token' order by m.created_at asc), '[]'::jsonb)
    into trip_members
    from public.members m
    where m.trip_id = current_member.trip_id;
  else
    select coalesce(jsonb_agg(to_jsonb(m) - 'access_token' order by m.created_at asc), '[]'::jsonb)
    into trip_members
    from public.members m
    where m.trip_id = current_member.trip_id
      and (m.status = 'approved' or m.id = current_member.id);
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.expense_date desc, e.created_at desc), '[]'::jsonb)
  into trip_expenses
  from public.expenses e
  where e.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)
  into trip_splits
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.from_currency, r.to_currency), '[]'::jsonb)
  into trip_exchange_rates
  from public.exchange_rates r
  where r.trip_id = current_member.trip_id;

  return jsonb_build_object(
    'trip', to_jsonb(current_trip),
    'member', to_jsonb(current_member),
    'members', trip_members,
    'expenses', trip_expenses,
    'splits', trip_splits,
    'exchangeRates', trip_exchange_rates
  );
end;
$$;

create or replace function public.claim_legacy_member(access_token_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  legacy_member public.members;
  user_member public.members;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  if char_length(trim(coalesce(access_token_input, ''))) = 0 then
    raise exception 'Legacy access token is required';
  end if;

  select *
  into legacy_member
  from public.members
  where access_token = access_token_input;

  if legacy_member.id is null then
    raise exception 'Legacy member not found';
  end if;

  if legacy_member.user_id = current_user_id then
    return public.load_auth_workspace(legacy_member.id);
  end if;

  if legacy_member.user_id is not null and legacy_member.user_id <> current_user_id then
    raise exception 'This member is already linked to another account';
  end if;

  select *
  into user_member
  from public.members
  where trip_id = legacy_member.trip_id
    and user_id = current_user_id
  limit 1;

  if user_member.id is not null then
    return public.load_auth_workspace(user_member.id);
  end if;

  update public.members
  set user_id = current_user_id
  where id = legacy_member.id
  returning * into legacy_member;

  return public.load_auth_workspace(legacy_member.id);
end;
$$;

create or replace function public.is_admin_user(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where user_id = auth.uid()
      and trip_id = target_trip_id
      and role = 'admin'
      and status = 'approved'
  )
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

  return to_jsonb(target_member) - 'access_token';
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
  set status = 'rejected',
      removed_at = null
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member) - 'access_token';
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

  return to_jsonb(target_member) - 'access_token';
end;
$$;

create or replace function public.approve_member(member_id_input uuid)
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

  if not public.is_admin_user(target_member.trip_id) then
    raise exception 'Admin access required';
  end if;

  update public.members
  set status = 'approved',
      approved_at = coalesce(approved_at, now()),
      removed_at = null
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member) - 'access_token';
end;
$$;

create or replace function public.reject_member(member_id_input uuid)
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

  if not public.is_admin_user(target_member.trip_id) then
    raise exception 'Admin access required';
  end if;

  update public.members
  set status = 'rejected',
      removed_at = null
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member) - 'access_token';
end;
$$;

create or replace function public.remove_member(member_id_input uuid)
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
  where user_id = auth.uid()
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

  return to_jsonb(target_member) - 'access_token';
end;
$$;

create or replace function public.update_exchange_rate(
  trip_id_input uuid,
  from_currency_input public.currency_code,
  to_currency_input public.currency_code,
  rate_input numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_member public.members;
begin
  select *
  into admin_member
  from public.members
  where user_id = auth.uid()
    and trip_id = trip_id_input
    and role = 'admin'
    and status = 'approved';

  if admin_member.id is null then
    raise exception 'Admin access required';
  end if;

  if from_currency_input = to_currency_input then
    raise exception 'Exchange-rate currencies must be different';
  end if;

  if rate_input is null or rate_input <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  insert into public.exchange_rates (
    trip_id,
    from_currency,
    to_currency,
    rate,
    updated_by_member_id,
    updated_at
  )
  values (
    trip_id_input,
    from_currency_input,
    to_currency_input,
    rate_input,
    admin_member.id,
    now()
  )
  on conflict (trip_id, from_currency, to_currency)
  do update set
    rate = excluded.rate,
    updated_by_member_id = excluded.updated_by_member_id,
    updated_at = now();

  return public.load_auth_workspace(admin_member.id);
end;
$$;

create or replace function public.update_member_display_currency(
  member_id_input uuid,
  display_currency_input text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  normalized_currency text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  normalized_currency := nullif(upper(trim(coalesce(display_currency_input, ''))), '');

  if normalized_currency is not null
     and normalized_currency not in ('AED', 'CNY', 'KZT') then
    raise exception 'Invalid display currency';
  end if;

  select *
  into target_member
  from public.members
  where id = member_id_input
    and user_id = auth.uid();

  if target_member.id is null then
    raise exception 'You can only update your own display currency for this trip';
  end if;

  update public.members
  set display_currency = normalized_currency
  where id = member_id_input
    and user_id = auth.uid()
  returning * into target_member;

  return public.load_auth_workspace(target_member.id);
end;
$$;

create or replace function public.create_expense_with_splits(
  trip_id_input uuid,
  title_input text,
  amount_input numeric,
  currency_input public.currency_code,
  exchange_rate_to_base_input numeric,
  converted_amount_input numeric,
  paid_by_member_id_input uuid,
  expense_date_input date,
  notes_input text,
  splits_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.members;
  target_trip public.trips;
  new_expense public.expenses;
  split_count integer;
  distinct_split_count integer;
  split_total numeric;
  effective_exchange_rate numeric;
  effective_converted_amount numeric;
begin
  select *
  into target_trip
  from public.trips
  where id = trip_id_input;

  if target_trip.id is null then
    raise exception 'Trip not found';
  end if;

  select *
  into current_member
  from public.members
  where user_id = auth.uid()
    and trip_id = trip_id_input
    and status = 'approved';

  if current_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  if char_length(trim(coalesce(title_input, ''))) = 0 then
    raise exception 'Expense title is required';
  end if;

  if amount_input <= 0 or exchange_rate_to_base_input <= 0 or converted_amount_input <= 0 then
    raise exception 'Expense amounts must be greater than zero';
  end if;

  if currency_input = target_trip.base_currency then
    effective_exchange_rate := 1;
  else
    effective_exchange_rate := exchange_rate_to_base_input;
  end if;

  effective_converted_amount := round(amount_input * effective_exchange_rate, 2);

  if abs(effective_converted_amount - converted_amount_input) > 0.01 then
    raise exception 'Converted amount must match amount times exchange rate';
  end if;

  if not exists (
    select 1 from public.members
    where id = paid_by_member_id_input
      and trip_id = trip_id_input
      and status = 'approved'
  ) then
    raise exception 'Payer must be an approved trip member';
  end if;

  if splits_input is null or jsonb_typeof(splits_input) <> 'array' then
    raise exception 'Expense splits are required';
  end if;

  select count(*), count(distinct split.member_id), coalesce(sum(split.amount_owed), 0)
  into split_count, distinct_split_count, split_total
  from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric);

  if split_count = 0 then
    raise exception 'At least one split participant is required';
  end if;

  if split_count <> distinct_split_count then
    raise exception 'Split participants must be unique';
  end if;

  if abs(split_total - effective_converted_amount) > 0.01 then
    raise exception 'Split total must match the converted expense amount';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric)
    where split.amount_owed < 0
       or not exists (
         select 1
         from public.members m
         where m.id = split.member_id
           and m.trip_id = trip_id_input
           and m.status = 'approved'
       )
  ) then
    raise exception 'All split participants must be approved trip members';
  end if;

  insert into public.expenses (
    trip_id,
    title,
    amount,
    currency,
    exchange_rate_to_base,
    converted_amount,
    paid_by_member_id,
    expense_date,
    notes,
    created_by_member_id
  )
  values (
    trip_id_input,
    trim(title_input),
    amount_input,
    currency_input,
    effective_exchange_rate,
    effective_converted_amount,
    paid_by_member_id_input,
    expense_date_input,
    coalesce(notes_input, ''),
    current_member.id
  )
  returning * into new_expense;

  insert into public.expense_splits (expense_id, member_id, amount_owed)
  select new_expense.id, split.member_id, split.amount_owed
  from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric);

  return public.load_auth_workspace(current_member.id);
end;
$$;

create or replace function public.update_expense_with_splits(
  expense_id_input uuid,
  title_input text,
  amount_input numeric,
  currency_input public.currency_code,
  exchange_rate_to_base_input numeric,
  converted_amount_input numeric,
  paid_by_member_id_input uuid,
  expense_date_input date,
  notes_input text,
  splits_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.members;
  target_expense public.expenses;
  target_trip public.trips;
  split_count integer;
  distinct_split_count integer;
  split_total numeric;
  effective_exchange_rate numeric;
  effective_converted_amount numeric;
begin
  select * into target_expense from public.expenses where id = expense_id_input;

  if target_expense.id is null then
    raise exception 'Expense not found';
  end if;

  select *
  into target_trip
  from public.trips
  where id = target_expense.trip_id;

  if target_trip.id is null then
    raise exception 'Trip not found';
  end if;

  select *
  into current_member
  from public.members
  where user_id = auth.uid()
    and trip_id = target_expense.trip_id
    and status = 'approved';

  if current_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  if target_expense.created_by_member_id <> current_member.id
    and current_member.role <> 'admin' then
    raise exception 'Only the expense creator or trip admin can update this expense';
  end if;

  if char_length(trim(coalesce(title_input, ''))) = 0 then
    raise exception 'Expense title is required';
  end if;

  if amount_input <= 0 or exchange_rate_to_base_input <= 0 or converted_amount_input <= 0 then
    raise exception 'Expense amounts must be greater than zero';
  end if;

  if currency_input = target_trip.base_currency then
    effective_exchange_rate := 1;
  else
    effective_exchange_rate := exchange_rate_to_base_input;
  end if;

  effective_converted_amount := round(amount_input * effective_exchange_rate, 2);

  if abs(effective_converted_amount - converted_amount_input) > 0.01 then
    raise exception 'Converted amount must match amount times exchange rate';
  end if;

  if not exists (
    select 1 from public.members
    where id = paid_by_member_id_input
      and trip_id = target_expense.trip_id
      and status = 'approved'
  ) then
    raise exception 'Payer must be an approved trip member';
  end if;

  if splits_input is null or jsonb_typeof(splits_input) <> 'array' then
    raise exception 'Expense splits are required';
  end if;

  select count(*), count(distinct split.member_id), coalesce(sum(split.amount_owed), 0)
  into split_count, distinct_split_count, split_total
  from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric);

  if split_count = 0 then
    raise exception 'At least one split participant is required';
  end if;

  if split_count <> distinct_split_count then
    raise exception 'Split participants must be unique';
  end if;

  if abs(split_total - effective_converted_amount) > 0.01 then
    raise exception 'Split total must match the converted expense amount';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric)
    where split.amount_owed < 0
       or not exists (
         select 1
         from public.members m
         where m.id = split.member_id
           and m.trip_id = target_expense.trip_id
           and m.status = 'approved'
       )
  ) then
    raise exception 'All split participants must be approved trip members';
  end if;

  update public.expenses
  set title = trim(title_input),
      amount = amount_input,
      currency = currency_input,
      exchange_rate_to_base = effective_exchange_rate,
      converted_amount = effective_converted_amount,
      paid_by_member_id = paid_by_member_id_input,
      expense_date = expense_date_input,
      notes = coalesce(notes_input, ''),
      updated_at = now()
  where id = expense_id_input;

  delete from public.expense_splits where expense_id = expense_id_input;

  insert into public.expense_splits (expense_id, member_id, amount_owed)
  select expense_id_input, split.member_id, split.amount_owed
  from jsonb_to_recordset(splits_input) as split(member_id uuid, amount_owed numeric);

  return public.load_auth_workspace(current_member.id);
end;
$$;

create or replace function public.delete_expense(expense_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.members;
  target_expense public.expenses;
begin
  select * into target_expense from public.expenses where id = expense_id_input;

  if target_expense.id is null then
    raise exception 'Expense not found';
  end if;

  select *
  into current_member
  from public.members
  where user_id = auth.uid()
    and trip_id = target_expense.trip_id
    and status = 'approved';

  if current_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  if target_expense.created_by_member_id <> current_member.id
    and current_member.role <> 'admin' then
    raise exception 'Only the expense creator or trip admin can delete this expense';
  end if;

  delete from public.expenses where id = expense_id_input;

  return public.load_auth_workspace(current_member.id);
end;
$$;

grant execute on function public.create_trip_with_admin(text, public.currency_code, text) to anon, authenticated;
grant execute on function public.request_join_by_invite(text, text) to anon, authenticated;
grant execute on function public.load_member_session(text) to anon, authenticated;
grant execute on function public.approve_member(text, uuid) to anon, authenticated;
grant execute on function public.reject_member(text, uuid) to anon, authenticated;
grant execute on function public.remove_member(text, uuid) to anon, authenticated;
grant execute on function public.load_auth_workspace(uuid) to authenticated;
grant execute on function public.claim_legacy_member(text) to authenticated;
grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.reject_member(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.update_exchange_rate(uuid, public.currency_code, public.currency_code, numeric) to authenticated;
grant execute on function public.update_member_display_currency(uuid, text) to authenticated;
grant execute on function public.create_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb) to authenticated;
grant execute on function public.update_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
