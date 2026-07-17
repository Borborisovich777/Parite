-- Keep canceled settlements from protecting expenses against deletion.
-- Historical rows may have been stamped with voided_at before their status was
-- updated, so normalize that safe-to-identify legacy state first.
update public.settlements settlement
set status = 'voided',
    void_reason = coalesce(settlement.void_reason, 'Recovered from a recorded cancellation.')
from public.trips trip
where settlement.trip_id = trip.id
  and trip.status <> 'closed'
  and settlement.status = 'paid'
  and settlement.voided_at is not null;

create or replace function public.delete_expense(expense_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member public.members;
  target_expense public.expenses;
  blocker_count integer := 0;
  blocker_ids uuid[] := array[]::uuid[];
begin
  select * into target_expense from public.expenses where id = expense_id_input;

  if target_expense.id is null then
    raise exception 'Expense not found';
  end if;

  if target_expense.deleted_at is not null then
    raise exception 'Expense has already been deleted';
  end if;

  select *
  into current_member
  from public.members
  where user_id = auth.uid()
    and trip_id = target_expense.trip_id
    and status = 'approved';

  if current_member.id is null then
    raise exception 'Approved group member access required';
  end if;

  if target_expense.created_by_member_id <> current_member.id
    and current_member.role <> 'admin' then
    raise exception 'Only the expense creator or group admin can delete this expense';
  end if;

  select count(*)::integer,
         coalesce(array_agg(settlement.id order by coalesce(settlement.paid_at, settlement.created_at)), array[]::uuid[])
  into blocker_count, blocker_ids
  from public.settlements settlement
  where settlement.trip_id = target_expense.trip_id
    and settlement.status = 'paid'
    and settlement.voided_at is null
    and coalesce(settlement.paid_at, settlement.created_at) >= target_expense.created_at;

  if blocker_count > 0 then
    raise exception using
      message = format(
        'This expense is protected by %s remaining paid settlement(s). Void them in settlement history before deleting it.',
        blocker_count
      ),
      detail = array_to_string(blocker_ids, ',');
  end if;

  update public.expenses
  set deleted_at = now(),
      deleted_by_member_id = current_member.id,
      delete_reason = 'Deleted by expense owner or group admin.',
      updated_at = now()
  where id = expense_id_input;

  return public.load_auth_workspace(current_member.id);
end;
$$;

grant execute on function public.delete_expense(uuid) to authenticated;

notify pgrst, 'reload schema';
