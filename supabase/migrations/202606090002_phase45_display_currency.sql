alter table public.members
add column if not exists display_currency text
check (display_currency in ('AED', 'CNY', 'KZT'));

create or replace function public.update_member_display_currency(
  member_id_input uuid,
  display_currency_input text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.members;
  normalized_currency text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  normalized_currency := nullif(upper(trim(coalesce(display_currency_input, ''))), '');

  if normalized_currency is not null
     and normalized_currency not in ('AED', 'CNY', 'KZT') then
    raise exception 'Invalid display currency';
  end if;

  select *
  into target_member
  from public.members
  where id = member_id_input
    and user_id = auth.uid();

  if target_member.id is null then
    raise exception 'You can only update your own display currency for this trip';
  end if;

  update public.members
  set display_currency = normalized_currency
  where id = member_id_input
    and user_id = auth.uid()
  returning * into target_member;

  return public.load_auth_workspace(target_member.id);
end;
$$;

grant execute on function public.update_member_display_currency(uuid, text) to authenticated;

notify pgrst, 'reload schema';
