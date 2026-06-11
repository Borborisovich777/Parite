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

grant execute on function public.regenerate_trip_invite_code(uuid) to authenticated;
grant execute on function public.update_trip_name(uuid, text) to authenticated;

notify pgrst, 'reload schema';
