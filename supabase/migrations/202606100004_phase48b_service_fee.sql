alter table public.expenses add column if not exists subtotal_amount numeric(14,2);
alter table public.expenses add column if not exists fee_percent numeric(7,4) not null default 0;
alter table public.expenses add column if not exists fee_amount numeric(14,2) not null default 0;
alter table public.expenses add column if not exists fee_label text;

update public.expenses
set subtotal_amount = coalesce(subtotal_amount, amount),
    fee_percent = coalesce(fee_percent, 0),
    fee_amount = coalesce(fee_amount, 0)
where subtotal_amount is null
   or fee_percent is null
   or fee_amount is null;

alter table public.expense_splits add column if not exists subtotal_amount_owed numeric(14,2);
alter table public.expense_splits add column if not exists fee_amount_owed numeric(14,2);

update public.expense_splits
set subtotal_amount_owed = coalesce(subtotal_amount_owed, amount_owed),
    fee_amount_owed = coalesce(fee_amount_owed, 0)
where subtotal_amount_owed is null
   or fee_amount_owed is null;

drop function if exists public.create_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb);
drop function if exists public.update_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb);

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

grant execute on function public.create_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb, numeric, numeric, text) to authenticated;
grant execute on function public.update_expense_with_splits(uuid, text, numeric, public.currency_code, numeric, numeric, uuid, date, text, jsonb, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';
