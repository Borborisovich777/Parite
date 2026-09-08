-- Run after migrations in an isolated test database as the function owner.
-- No application records are read or changed.
begin;
do $$
declare
  signature text;
  browser_role text;
begin
  foreach signature in array array[
    'public.member_open_balance(uuid)',
    'public.trip_approved_members_settled(uuid)',
    'public.trip_approved_admin_count(uuid)'
  ] loop
    foreach browser_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(browser_role, signature, 'execute') then
        raise exception '% must not execute %', browser_role, signature;
      end if;
    end loop;
    if not has_function_privilege(current_user, signature, 'execute') then
      raise exception 'Function owner must still execute %', signature;
    end if;
  end loop;
end;
$$;
rollback;
