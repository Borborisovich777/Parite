create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member_id uuid not null references public.members(id),
  to_member_id uuid not null references public.members(id),
  amount numeric(14,2) not null check (amount > 0),
  currency public.currency_code not null,
  status text not null default 'paid' check (status in ('pending', 'paid')),
  created_by_member_id uuid not null references public.members(id),
  paid_confirmed_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

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

create index if not exists settlements_trip_idx on public.settlements (trip_id);
create index if not exists settlements_from_member_idx on public.settlements (from_member_id);
create index if not exists settlements_to_member_idx on public.settlements (to_member_id);
create index if not exists settlements_confirmed_by_member_idx on public.settlements (paid_confirmed_by_member_id);
create index if not exists settlements_recent_paid_lookup_idx
  on public.settlements (trip_id, from_member_id, to_member_id, currency, status, created_at desc);

alter table public.settlements enable row level security;

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
      'settlements', '[]'::jsonb,
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

  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
  into trip_settlements
  from public.settlements s
  where s.trip_id = current_member.trip_id;

  return jsonb_build_object(
    'trip', to_jsonb(current_trip),
    'member', to_jsonb(current_member) - 'access_token',
    'members', trip_members,
    'expenses', trip_expenses,
    'splits', trip_splits,
    'settlements', trip_settlements,
    'exchangeRates', trip_exchange_rates
  );
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

grant execute on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
