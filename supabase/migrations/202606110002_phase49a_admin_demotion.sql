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

grant execute on function public.demote_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
