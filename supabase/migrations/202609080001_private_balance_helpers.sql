-- These SECURITY DEFINER helpers bypass RLS and accept arbitrary member/trip
-- IDs. Only other owner-executed database functions should call them; none is
-- part of the frontend RPC surface. Removing PUBLIC as well as explicit browser
-- grants closes anonymous and authenticated direct calls without changing the
-- owning role's ability to use the helpers during leave/close/remove operations.
begin;

revoke execute on function public.member_open_balance(uuid)
  from public, anon, authenticated;
revoke execute on function public.trip_approved_members_settled(uuid)
  from public, anon, authenticated;
revoke execute on function public.trip_approved_admin_count(uuid)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
