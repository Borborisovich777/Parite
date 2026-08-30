-- Durable, metadata-only receipt scan quotas.
-- These tables intentionally contain no image, receipt text, extracted fields,
-- filenames, trip IDs, or provider response data.

create table if not exists public.receipt_scan_user_monthly_usage (
  month_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_count integer not null default 0 check (scan_count >= 0),
  primary key (month_start, user_id)
);

create table if not exists public.receipt_scan_global_monthly_usage (
  month_start date primary key,
  scan_count integer not null default 0 check (scan_count >= 0)
);

alter table public.receipt_scan_user_monthly_usage enable row level security;
alter table public.receipt_scan_global_monthly_usage enable row level security;

comment on table public.receipt_scan_user_monthly_usage is
  'Metadata-only monthly receipt scan counters. Never store receipt or image data here.';
comment on table public.receipt_scan_global_monthly_usage is
  'Metadata-only global receipt scan counter used to preserve Azure F0 headroom.';

create or replace function public.reserve_receipt_scan(user_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  user_limit constant integer := 10;
  global_limit constant integer := 450;
  usage_month date := date_trunc('month', now() at time zone 'UTC')::date;
  reset_at text := to_char(
    date_trunc('month', now() at time zone 'UTC') + interval '1 month',
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  );
  user_used integer;
  global_used integer;
begin
  if user_id_input is null or not exists (
    select 1
    from public.account_access a
    where a.user_id = user_id_input
      and a.status = 'approved'
  ) then
    raise exception 'Approved account required';
  end if;

  -- Every reservation takes locks in the same user-then-global order. Calls for
  -- one user serialize on that user's row; all allowed calls then serialize on
  -- the small global counter so neither limit can be exceeded concurrently.
  insert into public.receipt_scan_user_monthly_usage (month_start, user_id)
  values (usage_month, user_id_input)
  on conflict (month_start, user_id) do nothing;

  select usage.scan_count
  into user_used
  from public.receipt_scan_user_monthly_usage usage
  where usage.month_start = usage_month
    and usage.user_id = user_id_input
  for update;

  if user_used >= user_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'user_limit',
      'limit', user_limit,
      'used', user_used,
      'remaining', 0,
      'reset_at', reset_at
    );
  end if;

  insert into public.receipt_scan_global_monthly_usage (month_start)
  values (usage_month)
  on conflict (month_start) do nothing;

  select usage.scan_count
  into global_used
  from public.receipt_scan_global_monthly_usage usage
  where usage.month_start = usage_month
  for update;

  if global_used >= global_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global_limit',
      'limit', user_limit,
      'used', user_used,
      'remaining', greatest(0, user_limit - user_used),
      'reset_at', reset_at
    );
  end if;

  update public.receipt_scan_user_monthly_usage
  set scan_count = scan_count + 1
  where month_start = usage_month
    and user_id = user_id_input
  returning scan_count into user_used;

  update public.receipt_scan_global_monthly_usage
  set scan_count = scan_count + 1
  where month_start = usage_month;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'limit', user_limit,
    'used', user_used,
    'remaining', user_limit - user_used,
    'reset_at', reset_at
  );
end;
$$;

create or replace function public.get_my_receipt_scan_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  user_limit constant integer := 10;
  global_limit constant integer := 450;
  usage_month date := date_trunc('month', now() at time zone 'UTC')::date;
  reset_at text := to_char(
    date_trunc('month', now() at time zone 'UTC') + interval '1 month',
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  );
  user_used integer;
  global_used integer;
  unavailable_reason text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  perform public.assert_account_approved();

  select coalesce((
    select usage.scan_count
    from public.receipt_scan_user_monthly_usage usage
    where usage.month_start = usage_month
      and usage.user_id = auth.uid()
  ), 0)
  into user_used;

  select coalesce((
    select usage.scan_count
    from public.receipt_scan_global_monthly_usage usage
    where usage.month_start = usage_month
  ), 0)
  into global_used;

  unavailable_reason := case
    when user_used >= user_limit then 'user_limit'
    when global_used >= global_limit then 'global_limit'
    else null
  end;

  return jsonb_build_object(
    'available', unavailable_reason is null,
    'reason', unavailable_reason,
    'limit', user_limit,
    'used', user_used,
    'remaining', greatest(0, user_limit - user_used),
    'reset_at', reset_at
  );
end;
$$;

revoke all on table public.receipt_scan_user_monthly_usage from public, anon, authenticated;
revoke all on table public.receipt_scan_global_monthly_usage from public, anon, authenticated;
revoke all on function public.reserve_receipt_scan(uuid) from public, anon, authenticated;
revoke all on function public.get_my_receipt_scan_quota() from public, anon;

grant execute on function public.reserve_receipt_scan(uuid) to service_role;
grant execute on function public.get_my_receipt_scan_quota() to authenticated;

notify pgrst, 'reload schema';
