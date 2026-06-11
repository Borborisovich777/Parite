alter table public.trips add column if not exists status text not null default 'active';
alter table public.trips add column if not exists closed_at timestamptz;

update public.trips
set status = 'active'
where status is null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%active%'
  loop
    execute format('alter table public.trips drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.trips
  add constraint trips_status_check
  check (status in ('active', 'closing', 'closed'));

create table if not exists public.trip_closure_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.members(id),
  approved_at timestamptz not null default now(),
  unique (trip_id, member_id)
);

create index if not exists trip_closure_votes_trip_idx on public.trip_closure_votes (trip_id);
create index if not exists trip_closure_votes_member_idx on public.trip_closure_votes (member_id);

alter table public.trip_closure_votes enable row level security;

create or replace function public.member_open_balance(member_id_input uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(
    coalesce((
      select sum(e.converted_amount)
      from public.expenses e
      where e.paid_by_member_id = member_id_input
        and e.deleted_at is null
    ), 0)
    - coalesce((
      select sum(s.amount_owed)
      from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
      where s.member_id = member_id_input
        and e.deleted_at is null
    ), 0)
    + coalesce((
      select sum(st.amount)
      from public.settlements st
      where st.from_member_id = member_id_input
        and st.status = 'paid'
    ), 0)
    - coalesce((
      select sum(st.amount)
      from public.settlements st
      where st.to_member_id = member_id_input
        and st.status = 'paid'
    ), 0),
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
  target_trip public.trips;
  target_trip_id uuid;
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

  if found_trip.status = 'closing' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
  end if;

  if found_trip.status = 'closed' then
    raise exception 'This trip is closed.';
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

create or replace function public.approve_member(member_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  target_trip public.trips;
begin
  select * into target_member from public.members where id = member_id_input;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  select * into target_trip from public.trips where id = target_member.trip_id;

  if target_trip.status <> 'active' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
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
  target_trip public.trips;
begin
  select * into target_member from public.members where id = member_id_input;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  select * into target_trip from public.trips where id = target_member.trip_id;

  if target_trip.status <> 'active' then
    raise exception 'This trip is being closed. Cancel the close request before changing members.';
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

  if admin_member.id = target_member.id then
    raise exception 'Admins cannot remove themselves';
  end if;

  if target_member.status = 'approved' and abs(public.member_open_balance(target_member.id)) > 0.01 then
    raise exception 'That member still has an open balance. Settle up before removing them.';
  end if;

  if target_member.role = 'admin'
    and target_member.status = 'approved'
    and public.trip_approved_admin_count(target_member.trip_id) <= 1 then
    raise exception 'This trip needs at least one admin. Promote another member before removing this admin.';
  end if;

  update public.members
  set status = 'removed',
      removed_at = now()
  where id = member_id_input
  returning * into target_member;

  return to_jsonb(target_member) - 'access_token';
end;
$$;

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

grant execute on function public.member_open_balance(uuid) to authenticated;
grant execute on function public.trip_approved_members_settled(uuid) to authenticated;
grant execute on function public.trip_approved_admin_count(uuid) to authenticated;
grant execute on function public.load_auth_workspace(uuid) to authenticated;
grant execute on function public.list_my_workspaces() to authenticated;
grant execute on function public.request_join_by_invite(text, text) to authenticated;
grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.reject_member(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;
grant execute on function public.leave_trip(uuid) to authenticated;
grant execute on function public.start_trip_closure(uuid) to authenticated;
grant execute on function public.approve_trip_closure(uuid) to authenticated;
grant execute on function public.cancel_trip_closure(uuid) to authenticated;

notify pgrst, 'reload schema';
