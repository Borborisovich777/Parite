-- Date/description/notes corrections must not recalculate financial snapshots or
-- replace split records. Keep the existing settlement and closed-group guards.
create or replace function public.update_expense_metadata(
  expense_id_input uuid, title_input text, expense_date_input date, notes_input text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  target_expense public.expenses;
  current_member public.members;
begin
  select * into target_expense from public.expenses where id = expense_id_input for update;
  if target_expense.id is null or target_expense.deleted_at is not null then
    raise exception 'Expense not found';
  end if;
  select * into current_member from public.members
    where user_id = auth.uid() and trip_id = target_expense.trip_id and status = 'approved';
  if current_member.id is null then raise exception 'Approved trip member access required'; end if;
  if target_expense.created_by_member_id <> current_member.id and current_member.role <> 'admin' then
    raise exception 'Only the expense creator or trip admin can update this expense';
  end if;
  if not exists (select 1 from public.trips where id = target_expense.trip_id and status = 'active') then
    raise exception 'This group is read-only';
  end if;
  if exists (select 1 from public.settlements where trip_id = target_expense.trip_id
    and status = 'paid' and coalesce(paid_at, created_at) >= target_expense.created_at) then
    raise exception 'This expense was created before a paid settlement. Void the related settlement before changing it.';
  end if;
  if char_length(trim(coalesce(title_input, ''))) = 0 then raise exception 'Expense title is required'; end if;
  if expense_date_input is null then raise exception 'Expense date is required'; end if;
  update public.expenses set title = trim(title_input), expense_date = expense_date_input,
    notes = coalesce(notes_input, ''), updated_at = now() where id = expense_id_input;
  return public.load_auth_workspace(current_member.id);
end;
$$;
revoke all on function public.update_expense_metadata(uuid, text, date, text) from public, anon;
grant execute on function public.update_expense_metadata(uuid, text, date, text) to authenticated;
notify pgrst, 'reload schema';
