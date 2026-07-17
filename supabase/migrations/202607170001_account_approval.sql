-- Platform-level account approval.
-- Existing accounts remain approved; the earliest existing account becomes the
-- platform admin. After this migration, new accounts require manual approval.

create table if not exists public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.account_access enable row level security;

-- Keep existing users working. The first account is the initial platform admin.
insert into public.account_access (user_id, email, role, status, created_at, approved_at)
select
  ranked.id,
  ranked.email,
  case when ranked.account_number = 1 then 'admin' else 'user' end,
  'approved',
  ranked.created_at,
  now()
from (
  select
    u.id,
    coalesce(u.email, 'unknown-' || u.id::text || '@invalid.local') as email,
    u.created_at,
    row_number() over (order by u.created_at asc, u.id asc) as account_number
  from auth.users u
) ranked
on conflict (user_id) do nothing;

create or replace function public.handle_new_account_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_account boolean;
begin
  -- Serialize the empty-database bootstrap so only one initial admin is created.
  perform pg_advisory_xact_lock(hashtext('parite.account_access.initial_admin'));

  select not exists(select 1 from public.account_access)
  into is_first_account;

  insert into public.account_access (
    user_id,
    email,
    role,
    status,
    created_at,
    approved_at
  ) values (
    new.id,
    coalesce(new.email, 'unknown-' || new.id::text || '@invalid.local'),
    case when is_first_account then 'admin' else 'user' end,
    case when is_first_account then 'approved' else 'pending' end,
    new.created_at,
    case when is_first_account then now() else null end
  )
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account_access on auth.users;
create trigger on_auth_user_created_account_access
after insert on auth.users
for each row execute function public.handle_new_account_access();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_access a
    where a.user_id = auth.uid()
      and a.role = 'admin'
      and a.status = 'approved'
  );
$$;

create or replace function public.assert_account_approved()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if not exists (
    select 1
    from public.account_access a
    where a.user_id = auth.uid()
      and a.status = 'approved'
  ) then
    raise exception 'Your account is waiting for admin approval.';
  end if;
end;
$$;

create or replace function public.get_my_account_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select to_jsonb(a)
  into result
  from public.account_access a
  where a.user_id = auth.uid();

  if result is null then
    raise exception 'Account approval record is missing. Contact an administrator.';
  end if;

  return result;
end;
$$;

create or replace function public.list_pending_account_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can review new accounts.';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at asc), '[]'::jsonb)
    from public.account_access a
    where a.status = 'pending'
      and a.role = 'user'
  );
end;
$$;

create or replace function public.approve_account(user_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can approve accounts.';
  end if;

  update public.account_access
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  where user_id = user_id_input
    and role = 'user';

  if not found then
    raise exception 'Account request not found.';
  end if;
end;
$$;

create or replace function public.reject_account(user_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can reject accounts.';
  end if;

  update public.account_access
  set status = 'rejected',
      approved_at = null,
      approved_by = auth.uid(),
      updated_at = now()
  where user_id = user_id_input
    and role = 'user';

  if not found then
    raise exception 'Account request not found.';
  end if;
end;
$$;

-- Security-definer RPCs are the application's data API. This trigger provides a
-- central server-side guard for every authenticated write, including future RPCs.
create or replace function public.enforce_approved_account_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    perform public.assert_account_approved();
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trips',
    'members',
    'expenses',
    'expense_splits',
    'exchange_rates',
    'settlements',
    'trip_closure_votes'
  ]
  loop
    execute format(
      'drop trigger if exists enforce_approved_account_write on public.%I',
      table_name
    );
    execute format(
      'create trigger enforce_approved_account_write before insert or update or delete on public.%I for each row execute function public.enforce_approved_account_write()',
      table_name
    );
  end loop;
end;
$$;

revoke all on table public.account_access from anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.assert_account_approved() from public, anon;
revoke all on function public.get_my_account_access() from public, anon;
revoke all on function public.list_pending_account_access() from public, anon;
revoke all on function public.approve_account(uuid) from public, anon;
revoke all on function public.reject_account(uuid) from public, anon;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.assert_account_approved() to authenticated;
grant execute on function public.get_my_account_access() to authenticated;
grant execute on function public.list_pending_account_access() to authenticated;
grant execute on function public.approve_account(uuid) to authenticated;
grant execute on function public.reject_account(uuid) to authenticated;

notify pgrst, 'reload schema';
