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
  status text not null default 'active' check (status in ('active', 'closing', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
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
  subtotal_amount numeric(14,2),
  fee_percent numeric(7,4) not null default 0,
  fee_amount numeric(14,2) not null default 0,
  fee_label text,
  currency public.currency_code not null,
  exchange_rate_to_base numeric(18,8) not null check (exchange_rate_to_base > 0),
  converted_amount numeric(14,2) not null check (converted_amount > 0),
  paid_by_member_id uuid not null references public.members(id),
  expense_date date not null,
  notes text not null default '',
  created_by_member_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_member_id uuid references public.members(id),
  delete_reason text
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id),
  amount_owed numeric(14,2) not null check (amount_owed >= 0),
  subtotal_amount_owed numeric(14,2),
  fee_amount_owed numeric(14,2),
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

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member_id uuid not null references public.members(id),
  to_member_id uuid not null references public.members(id),
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  status text not null default 'paid' check (status in ('pending', 'paid', 'voided')),
  created_by_member_id uuid not null references public.members(id),
  paid_confirmed_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  voided_by_member_id uuid references public.members(id),
  void_reason text
);

create table if not exists public.trip_closure_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.members(id),
  approved_at timestamptz not null default now(),
  unique (trip_id, member_id)
);

alter table public.trips add column if not exists id uuid default gen_random_uuid();
alter table public.trips add column if not exists name text;
alter table public.trips add column if not exists base_currency public.currency_code;
alter table public.trips add column if not exists invite_code text;
alter table public.trips add column if not exists status text not null default 'active';
alter table public.trips add column if not exists created_at timestamptz not null default now();
alter table public.trips add column if not exists closed_at timestamptz;

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
alter table public.expenses add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists deleted_by_member_id uuid references public.members(id);
alter table public.expenses add column if not exists delete_reason text;
alter table public.expenses add column if not exists subtotal_amount numeric(14,2);
alter table public.expenses add column if not exists fee_percent numeric(7,4) not null default 0;
alter table public.expenses add column if not exists fee_amount numeric(14,2) not null default 0;
alter table public.expenses add column if not exists fee_label text;

alter table public.expense_splits add column if not exists id uuid default gen_random_uuid();
alter table public.expense_splits add column if not exists expense_id uuid references public.expenses(id) on delete cascade;
alter table public.expense_splits add column if not exists member_id uuid references public.members(id);
alter table public.expense_splits add column if not exists amount_owed numeric(14,2);
alter table public.expense_splits add column if not exists subtotal_amount_owed numeric(14,2);
alter table public.expense_splits add column if not exists fee_amount_owed numeric(14,2);

update public.expenses
set subtotal_amount = coalesce(subtotal_amount, amount),
    fee_percent = coalesce(fee_percent, 0),
    fee_amount = coalesce(fee_amount, 0)
where subtotal_amount is null
   or fee_percent is null
   or fee_amount is null;

update public.expense_splits
set subtotal_amount_owed = coalesce(subtotal_amount_owed, amount_owed),
    fee_amount_owed = coalesce(fee_amount_owed, 0)
where subtotal_amount_owed is null
   or fee_amount_owed is null;

alter table public.exchange_rates add column if not exists id uuid default gen_random_uuid();
alter table public.exchange_rates add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.exchange_rates add column if not exists from_currency public.currency_code;
alter table public.exchange_rates add column if not exists to_currency public.currency_code;
alter table public.exchange_rates add column if not exists rate numeric(18,8);
alter table public.exchange_rates add column if not exists updated_by_member_id uuid references public.members(id);
alter table public.exchange_rates add column if not exists updated_at timestamptz not null default now();

alter table public.settlements add column if not exists id uuid default gen_random_uuid();
alter table public.settlements add column if not exists trip_id uuid references public.trips(id) on delete cascade;
alter table public.settlements add column if not exists from_member_id uuid references public.members(id);
alter table public.settlements add column if not exists to_member_id uuid references public.members(id);
alter table public.settlements add column if not exists amount numeric(14,2);
alter table public.settlements add column if not exists currency public.currency_code;
alter table public.settlements add column if not exists status text not null default 'paid';
alter table public.settlements add column if not exists created_by_member_id uuid references public.members(id);
alter table public.settlements add column if not exists paid_confirmed_by_member_id uuid references public.members(id);
alter table public.settlements add column if not exists created_at timestamptz not null default now();
alter table public.settlements add column if not exists paid_at timestamptz;
alter table public.settlements add column if not exists voided_at timestamptz;
alter table public.settlements add column if not exists voided_by_member_id uuid references public.members(id);
alter table public.settlements add column if not exists void_reason text;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.settlements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%paid%'
  loop
    execute format('alter table public.settlements drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.settlements
  add constraint settlements_status_check
  check (status in ('pending', 'paid', 'voided'));

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
create index if not exists expenses_active_trip_idx on public.expenses (trip_id, created_at) where deleted_at is null;
create index if not exists expense_splits_expense_idx on public.expense_splits (expense_id);
create index if not exists expense_splits_member_idx on public.expense_splits (member_id);
create unique index if not exists expense_splits_expense_member_unique_idx
  on public.expense_splits (expense_id, member_id);
create unique index if not exists exchange_rates_trip_pair_unique_idx
  on public.exchange_rates (trip_id, from_currency, to_currency);
create index if not exists exchange_rates_trip_idx on public.exchange_rates (trip_id);
create index if not exists exchange_rates_updated_by_member_idx on public.exchange_rates (updated_by_member_id);
create index if not exists settlements_trip_idx on public.settlements (trip_id);
create index if not exists settlements_from_member_idx on public.settlements (from_member_id);
create index if not exists settlements_to_member_idx on public.settlements (to_member_id);
create index if not exists settlements_confirmed_by_member_idx on public.settlements (paid_confirmed_by_member_id);
create index if not exists settlements_recent_paid_lookup_idx
  on public.settlements (trip_id, from_member_id, to_member_id, currency, status, created_at desc);
create index if not exists settlements_paid_after_expense_guard_idx
  on public.settlements (trip_id, status, paid_at, created_at);
create index if not exists trip_closure_votes_trip_idx on public.trip_closure_votes (trip_id);
create index if not exists trip_closure_votes_member_idx on public.trip_closure_votes (member_id);

alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.settlements enable row level security;
alter table public.trip_closure_votes enable row level security;

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
  trip_settlements jsonb := '[]'::jsonb;
  closure_votes jsonb := '[]'::jsonb;
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
      'settlements', '[]'::jsonb,
      'exchangeRates', '[]'::jsonb,
      'closureVotes', '[]'::jsonb
    );
  end if;

  if current_member.status <> 'approved' then
    return jsonb_build_object(
      'trip', null,
      'member', to_jsonb(current_member) - 'access_token',
      'members', '[]'::jsonb,
      'expenses', '[]'::jsonb,
      'splits', '[]'::jsonb,
      'settlements', '[]'::jsonb,
      'exchangeRates', '[]'::jsonb,
      'closureVotes', '[]'::jsonb
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
  where e.trip_id = current_member.trip_id
    and e.deleted_at is null;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)
  into trip_splits
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.trip_id = current_member.trip_id
    and e.deleted_at is null;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.from_currency, r.to_currency), '[]'::jsonb)
  into trip_exchange_rates
  from public.exchange_rates r
  where r.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
  into trip_settlements
  from public.settlements s
  where s.trip_id = current_member.trip_id;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.approved_at asc), '[]'::jsonb)
  into closure_votes
  from public.trip_closure_votes v
  where v.trip_id = current_member.trip_id;

  return jsonb_build_object(
    'trip', to_jsonb(current_trip),
    'member', to_jsonb(current_member) - 'access_token',
    'members', trip_members,
    'expenses', trip_expenses,
    'splits', trip_splits,
    'settlements', trip_settlements,
    'exchangeRates', trip_exchange_rates,
    'closureVotes', closure_votes
  );
end;
$$;

create or replace function public.list_my_workspaces()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id,
    'trip_id', t.id,
    'trip_name', t.name,
    'base_currency', t.base_currency,
    'trip_status', t.status,
    'closed_at', t.closed_at,
    'display_name', m.display_name,
    'role', m.role,
    'status', m.status,
    'display_currency', m.display_currency,
    'created_at', m.created_at,
    'approved_at', m.approved_at,
    'removed_at', m.removed_at
  ) order by m.created_at desc), '[]'::jsonb)
  from public.members m
  join public.trips t on t.id = m.trip_id
  where m.user_id = auth.uid();
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
  splits_input jsonb,
  subtotal_amount_input numeric default null,
  fee_percent_input numeric default 0,
  fee_label_input text default null
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
  split_subtotal_total numeric;
  split_fee_total numeric;
  effective_exchange_rate numeric;
  canonical_subtotal numeric(14,2);
  canonical_fee_percent numeric(7,4);
  canonical_fee_amount numeric(14,2);
  canonical_amount numeric(14,2);
  canonical_converted_subtotal numeric(14,2);
  canonical_converted_fee numeric(14,2);
  canonical_converted_amount numeric(14,2);
  has_fee boolean;
begin
  select * into target_trip from public.trips where id = trip_id_input;

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

  canonical_subtotal := round(coalesce(subtotal_amount_input, amount_input), 2);
  canonical_fee_percent := round(coalesce(fee_percent_input, 0), 4);

  if canonical_subtotal <= 0 then
    raise exception 'Expense subtotal must be greater than zero';
  end if;

  if canonical_fee_percent < 0 or canonical_fee_percent > 100 then
    raise exception 'Service fee must be between 0 and 100 percent';
  end if;

  if exchange_rate_to_base_input <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if currency_input = target_trip.base_currency then
    effective_exchange_rate := 1;
  else
    effective_exchange_rate := exchange_rate_to_base_input;
  end if;

  canonical_fee_amount := round(canonical_subtotal * canonical_fee_percent / 100, 2);
  canonical_amount := round(canonical_subtotal + canonical_fee_amount, 2);
  canonical_converted_subtotal := round(canonical_subtotal * effective_exchange_rate, 2);
  canonical_converted_amount := round(canonical_amount * effective_exchange_rate, 2);
  canonical_converted_fee := canonical_converted_amount - canonical_converted_subtotal;
  has_fee := canonical_fee_percent > 0 or canonical_fee_amount > 0;

  if amount_input <= 0 or converted_amount_input <= 0 then
    raise exception 'Expense amounts must be greater than zero';
  end if;

  if abs(canonical_amount - amount_input) > 0.01 then
    raise exception 'Expense total must match subtotal plus service fee';
  end if;

  if abs(canonical_converted_amount - converted_amount_input) > 0.01 then
    raise exception 'Converted amount must match the server-calculated expense total';
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

  select count(*),
         count(distinct split.member_id),
         coalesce(sum(split.amount_owed), 0),
         coalesce(sum(split.subtotal_amount_owed), 0),
         coalesce(sum(split.fee_amount_owed), 0)
  into split_count, distinct_split_count, split_total, split_subtotal_total, split_fee_total
  from jsonb_to_recordset(splits_input) as split(
    member_id uuid,
    amount_owed numeric,
    subtotal_amount_owed numeric,
    fee_amount_owed numeric
  );

  if split_count = 0 then
    raise exception 'At least one split participant is required';
  end if;

  if split_count <> distinct_split_count then
    raise exception 'Split participants must be unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(splits_input) as split(
      member_id uuid,
      amount_owed numeric,
      subtotal_amount_owed numeric,
      fee_amount_owed numeric
    )
    where split.amount_owed < 0
       or split.amount_owed is null
       or (has_fee and (split.subtotal_amount_owed is null or split.fee_amount_owed is null))
       or (has_fee and abs((split.subtotal_amount_owed + split.fee_amount_owed) - split.amount_owed) > 0.01)
       or not exists (
         select 1
         from public.members m
         where m.id = split.member_id
           and m.trip_id = trip_id_input
           and m.status = 'approved'
       )
  ) then
    raise exception 'All split participants must be approved trip members with valid service fee split amounts';
  end if;

  if abs(split_total - canonical_converted_amount) > 0.01 then
    raise exception 'Split total must match the converted expense amount';
  end if;

  if has_fee and abs(split_subtotal_total - canonical_converted_subtotal) > 0.01 then
    raise exception 'Split subtotals must match the converted expense subtotal';
  end if;

  if has_fee and abs(split_fee_total - canonical_converted_fee) > 0.01 then
    raise exception 'Split service fees must match the converted expense service fee';
  end if;

  insert into public.expenses (
    trip_id,
    title,
    amount,
    subtotal_amount,
    fee_percent,
    fee_amount,
    fee_label,
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
    canonical_amount,
    canonical_subtotal,
    canonical_fee_percent,
    canonical_fee_amount,
    case when has_fee then nullif(trim(coalesce(fee_label_input, 'Service fee')), '') else null end,
    currency_input,
    effective_exchange_rate,
    canonical_converted_amount,
    paid_by_member_id_input,
    expense_date_input,
    coalesce(notes_input, ''),
    current_member.id
  )
  returning * into new_expense;

  insert into public.expense_splits (expense_id, member_id, amount_owed, subtotal_amount_owed, fee_amount_owed)
  select new_expense.id,
         split.member_id,
         split.amount_owed,
         case when has_fee then split.subtotal_amount_owed else coalesce(split.subtotal_amount_owed, split.amount_owed) end,
         case when has_fee then split.fee_amount_owed else coalesce(split.fee_amount_owed, 0) end
  from jsonb_to_recordset(splits_input) as split(
    member_id uuid,
    amount_owed numeric,
    subtotal_amount_owed numeric,
    fee_amount_owed numeric
  );

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
  splits_input jsonb,
  subtotal_amount_input numeric default null,
  fee_percent_input numeric default 0,
  fee_label_input text default null
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
  split_subtotal_total numeric;
  split_fee_total numeric;
  effective_exchange_rate numeric;
  canonical_subtotal numeric(14,2);
  canonical_fee_percent numeric(7,4);
  canonical_fee_amount numeric(14,2);
  canonical_amount numeric(14,2);
  canonical_converted_subtotal numeric(14,2);
  canonical_converted_fee numeric(14,2);
  canonical_converted_amount numeric(14,2);
  has_fee boolean;
begin
  select * into target_expense from public.expenses where id = expense_id_input;

  if target_expense.id is null then
    raise exception 'Expense not found';
  end if;

  if target_expense.deleted_at is not null then
    raise exception 'Expense has already been deleted';
  end if;

  select * into target_trip from public.trips where id = target_expense.trip_id;

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

  if exists (
    select 1
    from public.settlements settlement
    where settlement.trip_id = target_expense.trip_id
      and settlement.status = 'paid'
      and coalesce(settlement.paid_at, settlement.created_at) >= target_expense.created_at
  ) then
    raise exception 'This expense was created before a paid settlement. Void the related settlement before changing it.';
  end if;

  if char_length(trim(coalesce(title_input, ''))) = 0 then
    raise exception 'Expense title is required';
  end if;

  canonical_subtotal := round(coalesce(subtotal_amount_input, amount_input), 2);
  canonical_fee_percent := round(coalesce(fee_percent_input, 0), 4);

  if canonical_subtotal <= 0 then
    raise exception 'Expense subtotal must be greater than zero';
  end if;

  if canonical_fee_percent < 0 or canonical_fee_percent > 100 then
    raise exception 'Service fee must be between 0 and 100 percent';
  end if;

  if exchange_rate_to_base_input <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if currency_input = target_trip.base_currency then
    effective_exchange_rate := 1;
  else
    effective_exchange_rate := exchange_rate_to_base_input;
  end if;

  canonical_fee_amount := round(canonical_subtotal * canonical_fee_percent / 100, 2);
  canonical_amount := round(canonical_subtotal + canonical_fee_amount, 2);
  canonical_converted_subtotal := round(canonical_subtotal * effective_exchange_rate, 2);
  canonical_converted_amount := round(canonical_amount * effective_exchange_rate, 2);
  canonical_converted_fee := canonical_converted_amount - canonical_converted_subtotal;
  has_fee := canonical_fee_percent > 0 or canonical_fee_amount > 0;

  if amount_input <= 0 or converted_amount_input <= 0 then
    raise exception 'Expense amounts must be greater than zero';
  end if;

  if abs(canonical_amount - amount_input) > 0.01 then
    raise exception 'Expense total must match subtotal plus service fee';
  end if;

  if abs(canonical_converted_amount - converted_amount_input) > 0.01 then
    raise exception 'Converted amount must match the server-calculated expense total';
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

  select count(*),
         count(distinct split.member_id),
         coalesce(sum(split.amount_owed), 0),
         coalesce(sum(split.subtotal_amount_owed), 0),
         coalesce(sum(split.fee_amount_owed), 0)
  into split_count, distinct_split_count, split_total, split_subtotal_total, split_fee_total
  from jsonb_to_recordset(splits_input) as split(
    member_id uuid,
    amount_owed numeric,
    subtotal_amount_owed numeric,
    fee_amount_owed numeric
  );

  if split_count = 0 then
    raise exception 'At least one split participant is required';
  end if;

  if split_count <> distinct_split_count then
    raise exception 'Split participants must be unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(splits_input) as split(
      member_id uuid,
      amount_owed numeric,
      subtotal_amount_owed numeric,
      fee_amount_owed numeric
    )
    where split.amount_owed < 0
       or split.amount_owed is null
       or (has_fee and (split.subtotal_amount_owed is null or split.fee_amount_owed is null))
       or (has_fee and abs((split.subtotal_amount_owed + split.fee_amount_owed) - split.amount_owed) > 0.01)
       or not exists (
         select 1
         from public.members m
         where m.id = split.member_id
           and m.trip_id = target_expense.trip_id
           and m.status = 'approved'
       )
  ) then
    raise exception 'All split participants must be approved trip members with valid service fee split amounts';
  end if;

  if abs(split_total - canonical_converted_amount) > 0.01 then
    raise exception 'Split total must match the converted expense amount';
  end if;

  if has_fee and abs(split_subtotal_total - canonical_converted_subtotal) > 0.01 then
    raise exception 'Split subtotals must match the converted expense subtotal';
  end if;

  if has_fee and abs(split_fee_total - canonical_converted_fee) > 0.01 then
    raise exception 'Split service fees must match the converted expense service fee';
  end if;

  update public.expenses
  set title = trim(title_input),
      amount = canonical_amount,
      subtotal_amount = canonical_subtotal,
      fee_percent = canonical_fee_percent,
      fee_amount = canonical_fee_amount,
      fee_label = case when has_fee then nullif(trim(coalesce(fee_label_input, 'Service fee')), '') else null end,
      currency = currency_input,
      exchange_rate_to_base = effective_exchange_rate,
      converted_amount = canonical_converted_amount,
      paid_by_member_id = paid_by_member_id_input,
      expense_date = expense_date_input,
      notes = coalesce(notes_input, ''),
      updated_at = now()
  where id = expense_id_input;

  delete from public.expense_splits where expense_id = expense_id_input;

  insert into public.expense_splits (expense_id, member_id, amount_owed, subtotal_amount_owed, fee_amount_owed)
  select expense_id_input,
         split.member_id,
         split.amount_owed,
         case when has_fee then split.subtotal_amount_owed else coalesce(split.subtotal_amount_owed, split.amount_owed) end,
         case when has_fee then split.fee_amount_owed else coalesce(split.fee_amount_owed, 0) end
  from jsonb_to_recordset(splits_input) as split(
    member_id uuid,
    amount_owed numeric,
    subtotal_amount_owed numeric,
    fee_amount_owed numeric
  );

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

  if target_expense.deleted_at is not null then
    raise exception 'Expense has already been deleted';
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

  if exists (
    select 1
    from public.settlements settlement
    where settlement.trip_id = target_expense.trip_id
      and settlement.status = 'paid'
      and coalesce(settlement.paid_at, settlement.created_at) >= target_expense.created_at
  ) then
    raise exception 'This expense was created before a paid settlement. Void the related settlement before changing it.';
  end if;

  update public.expenses
  set deleted_at = now(),
      deleted_by_member_id = current_member.id,
      delete_reason = 'Deleted by expense owner or trip admin.',
      updated_at = now()
  where id = expense_id_input;

  return public.load_auth_workspace(current_member.id);
end;
$$;

create or replace function public.mark_settlement_paid(
  trip_id_input uuid,
  from_member_id_input uuid,
  to_member_id_input uuid,
  amount_input numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_trip public.trips;
  caller_member public.members;
  from_member public.members;
  to_member public.members;
  normalized_amount numeric(14,2);
  existing_settlement public.settlements;
  lock_key text;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  if amount_input is null or amount_input::text = 'NaN' or amount_input <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;

  if from_member_id_input = to_member_id_input then
    raise exception 'Settlement payer and receiver must be different members';
  end if;

  normalized_amount := round(amount_input, 2);

  if normalized_amount <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;

  select *
  into current_trip
  from public.trips
  where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  select *
  into caller_member
  from public.members
  where user_id = current_user_id
    and trip_id = trip_id_input
    and status = 'approved';

  if caller_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  if caller_member.role <> 'admin' and caller_member.id <> to_member_id_input then
    raise exception 'Only the receiver or a trip admin can confirm this settlement';
  end if;

  select *
  into from_member
  from public.members
  where id = from_member_id_input
    and trip_id = trip_id_input;

  if from_member.id is null then
    raise exception 'Settlement payer is not a member of this trip';
  end if;

  select *
  into to_member
  from public.members
  where id = to_member_id_input
    and trip_id = trip_id_input;

  if to_member.id is null then
    raise exception 'Settlement receiver is not a member of this trip';
  end if;

  lock_key := concat_ws(
    ':',
    trip_id_input::text,
    from_member_id_input::text,
    to_member_id_input::text,
    normalized_amount::text,
    current_trip.base_currency::text
  );

  perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

  select *
  into existing_settlement
  from public.settlements
  where trip_id = trip_id_input
    and from_member_id = from_member_id_input
    and to_member_id = to_member_id_input
    and amount = normalized_amount
    and currency = current_trip.base_currency
    and status = 'paid'
    and created_at >= now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if existing_settlement.id is not null then
    return public.load_auth_workspace(caller_member.id);
  end if;

  insert into public.settlements (
    trip_id,
    from_member_id,
    to_member_id,
    amount,
    currency,
    status,
    created_by_member_id,
    paid_confirmed_by_member_id,
    paid_at
  )
  values (
    trip_id_input,
    from_member_id_input,
    to_member_id_input,
    normalized_amount,
    current_trip.base_currency,
    'paid',
    caller_member.id,
    caller_member.id,
    now()
  );

  return public.load_auth_workspace(caller_member.id);
end;
$$;

create or replace function public.void_settlement(
  settlement_id_input uuid,
  reason_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  caller_member public.members;
  target_settlement public.settlements;
  normalized_reason text;
begin
  if current_user_id is null then
    raise exception 'Sign in required';
  end if;

  select *
  into target_settlement
  from public.settlements
  where id = settlement_id_input;

  if target_settlement.id is null then
    raise exception 'Settlement not found';
  end if;

  select *
  into caller_member
  from public.members
  where user_id = current_user_id
    and trip_id = target_settlement.trip_id
    and status = 'approved';

  if caller_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  if caller_member.role <> 'admin' and caller_member.id <> target_settlement.to_member_id then
    raise exception 'Only the receiver or a trip admin can void this settlement';
  end if;

  if target_settlement.status = 'voided' then
    return public.load_auth_workspace(caller_member.id);
  end if;

  if target_settlement.status <> 'paid' then
    raise exception 'Only paid settlements can be voided';
  end if;

  normalized_reason := nullif(trim(coalesce(reason_input, '')), '');

  update public.settlements
  set status = 'voided',
      voided_at = now(),
      voided_by_member_id = caller_member.id,
      void_reason = coalesce(normalized_reason, 'Voided by receiver or trip admin.')
  where id = settlement_id_input;

  return public.load_auth_workspace(caller_member.id);
end;
$$;

create or replace function public.member_open_balance(member_id_input uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(
    coalesce((select sum(e.converted_amount) from public.expenses e where e.paid_by_member_id = member_id_input and e.deleted_at is null), 0)
    - coalesce((select sum(s.amount_owed) from public.expense_splits s join public.expenses e on e.id = s.expense_id where s.member_id = member_id_input and e.deleted_at is null), 0)
    + coalesce((select sum(st.amount) from public.settlements st where st.from_member_id = member_id_input and st.status = 'paid'), 0)
    - coalesce((select sum(st.amount) from public.settlements st where st.to_member_id = member_id_input and st.status = 'paid'), 0),
    2
  );
$$;

create or replace function public.trip_approved_members_settled(trip_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.members m
    where m.trip_id = trip_id_input
      and m.status = 'approved'
      and abs(public.member_open_balance(m.id)) > 0.01
  );
$$;

create or replace function public.trip_approved_admin_count(trip_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.members m
  where m.trip_id = trip_id_input
    and m.status = 'approved'
    and m.role = 'admin';
$$;

create or replace function public.prevent_member_change_unless_trip_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trip public.trips;
begin
  if TG_OP = 'UPDATE'
    and new.trip_id is not distinct from old.trip_id
    and new.status is not distinct from old.status
    and new.role is not distinct from old.role then
    return new;
  end if;

  select * into target_trip from public.trips where id = new.trip_id;

  if target_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
  end if;

  if target_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

  return new;
end;
$$;

drop trigger if exists members_trip_lifecycle_guard on public.members;
create trigger members_trip_lifecycle_guard
before insert or update on public.members
for each row
execute function public.prevent_member_change_unless_trip_active();

create or replace function public.prevent_expense_change_unless_trip_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trip_id uuid;
  target_trip public.trips;
begin
  if TG_OP = 'DELETE' then
    target_trip_id := old.trip_id;
  else
    target_trip_id := new.trip_id;
  end if;

  select * into target_trip from public.trips where id = target_trip_id;

  if target_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing expenses.';
  end if;

  if target_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_trip_lifecycle_guard on public.expenses;
create trigger expenses_trip_lifecycle_guard
before insert or update or delete on public.expenses
for each row
execute function public.prevent_expense_change_unless_trip_active();

create or replace function public.prevent_exchange_rate_change_unless_trip_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trip public.trips;
begin
  select * into target_trip from public.trips where id = new.trip_id;

  if target_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing exchange rates.';
  end if;

  if target_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

  return new;
end;
$$;

drop trigger if exists exchange_rates_trip_lifecycle_guard on public.exchange_rates;
create trigger exchange_rates_trip_lifecycle_guard
before insert or update on public.exchange_rates
for each row
execute function public.prevent_exchange_rate_change_unless_trip_active();

create or replace function public.prevent_settlement_change_when_trip_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trip_id uuid;
  target_trip public.trips;
begin
  if TG_OP = 'DELETE' then
    target_trip_id := old.trip_id;
  else
    target_trip_id := new.trip_id;
  end if;

  select * into target_trip from public.trips where id = target_trip_id;

  if target_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists settlements_trip_lifecycle_guard on public.settlements;
create trigger settlements_trip_lifecycle_guard
before insert or update or delete on public.settlements
for each row
execute function public.prevent_settlement_change_when_trip_closed();

create or replace function public.promote_member_to_admin(member_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  target_trip public.trips;
  admin_member public.members;
begin
  select * into target_member from public.members where id = member_id_input;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  select * into target_trip from public.trips where id = target_member.trip_id;

  if target_trip.status <> 'active' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
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

  if target_member.status <> 'approved' then
    raise exception 'Only approved members can be promoted to admin';
  end if;

  update public.members
  set role = 'admin'
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member) - 'access_token';
end;
$$;

create or replace function public.demote_admin(member_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  target_trip public.trips;
  admin_member public.members;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into target_member from public.members where id = member_id_input;

  if target_member.id is null
    or target_member.status <> 'approved'
    or target_member.role <> 'admin' then
    raise exception 'Only approved admins can be demoted.';
  end if;

  select * into target_trip from public.trips where id = target_member.trip_id;

  if target_trip.status <> 'active' then
    raise exception 'Admin roles cannot be changed while this trip is closing or closed.';
  end if;

  select *
  into admin_member
  from public.members
  where user_id = auth.uid()
    and trip_id = target_member.trip_id
    and role = 'admin'
    and status = 'approved';

  if admin_member.id is null then
    raise exception 'Only admins can change admin roles.';
  end if;

  if admin_member.id = target_member.id then
    raise exception 'You cannot remove your own admin role.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.trip_id = target_member.trip_id
      and m.status = 'approved'
      and m.role = 'admin'
      and m.id <> target_member.id
  ) then
    raise exception 'This trip needs at least one admin.';
  end if;

  update public.members
  set role = 'member'
  where id = member_id_input
  returning * into target_member;

  return public.load_auth_workspace(admin_member.id);
end;
$$;

create or replace function public.leave_trip(member_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  target_trip public.trips;
begin
  select *
  into target_member
  from public.members
  where id = member_id_input
    and user_id = auth.uid();

  if target_member.id is null then
    raise exception 'You can only leave your own trip membership';
  end if;

  if target_member.status <> 'approved' then
    raise exception 'Only approved members can leave a trip';
  end if;

  select * into target_trip from public.trips where id = target_member.trip_id;

  if target_trip.status <> 'active' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
  end if;

  if abs(public.member_open_balance(target_member.id)) > 0.01 then
    raise exception 'You still have an open balance. Settle up before leaving this trip.';
  end if;

  if target_member.role = 'admin'
    and public.trip_approved_admin_count(target_member.trip_id) <= 1 then
    raise exception 'This trip needs at least one admin. Promote another member before leaving.';
  end if;

  update public.members
  set status = 'removed',
      removed_at = now()
  where id = member_id_input;

  return jsonb_build_object(
    'trip', null,
    'member', to_jsonb(target_member) - 'access_token',
    'members', '[]'::jsonb,
    'expenses', '[]'::jsonb,
    'splits', '[]'::jsonb,
    'settlements', '[]'::jsonb,
    'exchangeRates', '[]'::jsonb,
    'closureVotes', '[]'::jsonb
  );
end;
$$;

create or replace function public.start_trip_closure(trip_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips;
  admin_member public.members;
begin
  select * into current_trip from public.trips where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  if current_trip.status <> 'active' then
    raise exception 'Trip close request can only be started for an active trip';
  end if;

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

  if not public.trip_approved_members_settled(trip_id_input) then
    raise exception 'This trip cannot be closed until everyone is settled.';
  end if;

  update public.trips
  set status = 'closing',
      closed_at = null
  where id = trip_id_input;

  delete from public.trip_closure_votes where trip_id = trip_id_input;

  insert into public.trip_closure_votes (trip_id, member_id, approved_at)
  values (trip_id_input, admin_member.id, now())
  on conflict (trip_id, member_id)
  do update set approved_at = excluded.approved_at;

  return public.load_auth_workspace(admin_member.id);
end;
$$;

create or replace function public.approve_trip_closure(trip_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips;
  caller_member public.members;
  approved_count integer;
  vote_count integer;
begin
  select * into current_trip from public.trips where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  if current_trip.status <> 'closing' then
    raise exception 'Trip is not waiting for close approval';
  end if;

  select *
  into caller_member
  from public.members
  where user_id = auth.uid()
    and trip_id = trip_id_input
    and status = 'approved';

  if caller_member.id is null then
    raise exception 'Approved trip member access required';
  end if;

  insert into public.trip_closure_votes (trip_id, member_id, approved_at)
  values (trip_id_input, caller_member.id, now())
  on conflict (trip_id, member_id)
  do update set approved_at = excluded.approved_at;

  if not public.trip_approved_members_settled(trip_id_input) then
    raise exception 'This trip cannot be closed until everyone is settled.';
  end if;

  select count(distinct m.id)
  into approved_count
  from public.members m
  where m.trip_id = trip_id_input
    and m.status = 'approved';

  select count(distinct v.member_id)
  into vote_count
  from public.trip_closure_votes v
  join public.members m on m.id = v.member_id
  where v.trip_id = trip_id_input
    and m.trip_id = trip_id_input
    and m.status = 'approved';

  if approved_count = vote_count then
    update public.trips
    set status = 'closed',
        closed_at = now()
    where id = trip_id_input;
  end if;

  return public.load_auth_workspace(caller_member.id);
end;
$$;

create or replace function public.cancel_trip_closure(trip_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips;
  admin_member public.members;
begin
  select * into current_trip from public.trips where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  if current_trip.status <> 'closing' then
    raise exception 'Trip is not waiting for close approval';
  end if;

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

  update public.trips
  set status = 'active',
      closed_at = null
  where id = trip_id_input;

  delete from public.trip_closure_votes where trip_id = trip_id_input;

  return public.load_auth_workspace(admin_member.id);
end;
$$;

create or replace function public.regenerate_trip_invite_code(trip_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips;
  admin_member public.members;
  candidate_code text;
begin
  select * into current_trip from public.trips where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  if current_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing settings.';
  end if;

  if current_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

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

  loop
    candidate_code := public.generate_invite_code();
    exit when not exists (
      select 1
      from public.trips
      where invite_code = candidate_code
        and id <> trip_id_input
    );
  end loop;

  update public.trips
  set invite_code = candidate_code
  where id = trip_id_input;

  return public.load_auth_workspace(admin_member.id);
end;
$$;

create or replace function public.update_trip_name(
  trip_id_input uuid,
  name_input text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_trip public.trips;
  admin_member public.members;
  normalized_name text;
begin
  normalized_name := trim(coalesce(name_input, ''));

  if char_length(normalized_name) = 0 then
    raise exception 'Trip name is required';
  end if;

  select * into current_trip from public.trips where id = trip_id_input;

  if current_trip.id is null then
    raise exception 'Trip not found';
  end if;

  if current_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing settings.';
  end if;

  if current_trip.status = 'closed' then
    raise exception 'This trip is closed.';
  end if;

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

  update public.trips
  set name = normalized_name
  where id = trip_id_input;

  return public.load_auth_workspace(admin_member.id);
end;
$$;

grant execute on function public.create_trip_with_admin(text, public.currency_code, text) to anon, authenticated;
grant execute on function public.request_join_by_invite(text, text) to anon, authenticated;
grant execute on function public.load_member_session(text) to anon, authenticated;
grant execute on function public.approve_member(text, uuid) to anon, authenticated;
grant execute on function public.reject_member(text, uuid) to anon, authenticated;
grant execute on function public.remove_member(text, uuid) to anon, authenticated;
grant execute on function public.load_auth_workspace(uuid) to authenticated;
grant execute on function public.list_my_workspaces() to authenticated;
grant execute on function public.claim_legacy_member(text) to authenticated;
grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.reject_member(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.update_exchange_rate(uuid, public.currency_code, public.currency_code, numeric) to authenticated;
grant execute on function public.update_member_display_currency(uuid, text) to authenticated;
grant execute on function public.create_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb, numeric, numeric, text) to authenticated;
grant execute on function public.update_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb, numeric, numeric, text) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.void_settlement(uuid, text) to authenticated;
grant execute on function public.member_open_balance(uuid) to authenticated;
grant execute on function public.trip_approved_members_settled(uuid) to authenticated;
grant execute on function public.trip_approved_admin_count(uuid) to authenticated;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;
grant execute on function public.demote_admin(uuid) to authenticated;
grant execute on function public.leave_trip(uuid) to authenticated;
grant execute on function public.start_trip_closure(uuid) to authenticated;
grant execute on function public.approve_trip_closure(uuid) to authenticated;
grant execute on function public.cancel_trip_closure(uuid) to authenticated;
grant execute on function public.regenerate_trip_invite_code(uuid) to authenticated;
grant execute on function public.update_trip_name(uuid, text) to authenticated;
