alter table public.expenses add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists deleted_by_member_id uuid references public.members(id);
alter table public.expenses add column if not exists delete_reason text;

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

create index if not exists expenses_active_trip_idx
  on public.expenses (trip_id, created_at)
  where deleted_at is null;

create index if not exists settlements_paid_after_expense_guard_idx
  on public.settlements (trip_id, status, paid_at, created_at);

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

  if target_expense.deleted_at is not null then
    raise exception 'Expense has already been deleted';
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

grant execute on function public.load_auth_workspace(uuid) to authenticated;
grant execute on function public.update_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.void_settlement(uuid, text) to authenticated;

notify pgrst, 'reload schema';
