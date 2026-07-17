import { Currency, ExchangeRate, Expense, ExpenseFeeInput, ExpenseSplit, ExpenseSplitInput, Member, Settlement, Trip, TripClosureVote, TripStatus } from '../types';
import { toCurrency } from './exchangeRates';
import { requireSupabase } from './supabase';

export interface PhaseOneWorkspace {
  trip: Trip | null;
  currentMember: Member | null;
  members: Member[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  exchangeRates: ExchangeRate[];
  closureVotes: TripClosureVote[];
}

export interface WorkspaceSummary {
  member_id: string;
  trip_id: string;
  trip_name: string;
  base_currency: Currency;
  display_name: string;
  role: Member['role'];
  status: Member['status'];
  trip_status?: TripStatus;
  display_currency: Currency | null;
  created_at: string;
  approved_at?: string;
  removed_at?: string;
  closed_at?: string;
}

type Row = Record<string, any>;

export const DUPLICATE_DISPLAY_NAME_MESSAGE =
  'Display name already used in this group. Use another name or ask the admin to remove or reapprove the previous member.';

export const INVALID_MEMBER_SESSION_MESSAGE = 'Member session not found';
export const SETTLEMENT_EXPENSE_GUARD_MESSAGE =
  'This expense was created before a paid settlement. Void the related settlement before changing it.';
export const TRIP_CLOSING_READONLY_MESSAGE =
  'This group is being closed. Cancel the close request before making changes.';
export const TRIP_CLOSED_READONLY_MESSAGE = 'This group is closed and read-only.';

function useGroupTerminology(message: string): string {
  return message
    .replace(/\bTrips\b/g, 'Groups')
    .replace(/\btrips\b/g, 'groups')
    .replace(/\bTrip\b/g, 'Group')
    .replace(/\btrip\b/g, 'group');
}

function mapTrip(row: Row): Trip {
  return {
    id: row.id,
    name: row.name,
    base_currency: row.base_currency,
    invite_code: row.invite_code,
    status: row.status ?? 'active',
    created_at: row.created_at,
    closed_at: row.closed_at ?? undefined,
  };
}

function mapNullableTrip(row: unknown): Trip | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }

  return mapTrip(row as Row);
}

function mapMember(row: Row): Member {
  return {
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.user_id ?? undefined,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    display_currency: row.display_currency ? toCurrency(row.display_currency) : null,
    access_token: row.access_token,
    created_at: row.created_at,
    approved_at: row.approved_at ?? undefined,
    removed_at: row.removed_at ?? undefined,
  };
}

function mapExpense(row: Row): Expense {
  return {
    id: row.id,
    trip_id: row.trip_id,
    title: row.title,
    amount: Number(row.amount),
    subtotal_amount: row.subtotal_amount === null || row.subtotal_amount === undefined ? undefined : Number(row.subtotal_amount),
    fee_percent: row.fee_percent === null || row.fee_percent === undefined ? undefined : Number(row.fee_percent),
    fee_amount: row.fee_amount === null || row.fee_amount === undefined ? undefined : Number(row.fee_amount),
    fee_label: row.fee_label ?? null,
    currency: row.currency,
    exchange_rate_to_base: Number(row.exchange_rate_to_base),
    converted_amount: Number(row.converted_amount),
    paid_by_member_id: row.paid_by_member_id,
    expense_date: row.expense_date,
    notes: row.notes ?? '',
    created_by_member_id: row.created_by_member_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? undefined,
    deleted_by_member_id: row.deleted_by_member_id ?? undefined,
    delete_reason: row.delete_reason ?? undefined,
  };
}

function mapExpenseSplit(row: Row): ExpenseSplit {
  return {
    id: row.id,
    expense_id: row.expense_id,
    member_id: row.member_id,
    amount_owed: Number(row.amount_owed),
    subtotal_amount_owed: row.subtotal_amount_owed === null || row.subtotal_amount_owed === undefined
      ? undefined
      : Number(row.subtotal_amount_owed),
    fee_amount_owed: row.fee_amount_owed === null || row.fee_amount_owed === undefined
      ? undefined
      : Number(row.fee_amount_owed),
  };
}

function mapExchangeRate(row: Row): ExchangeRate {
  return {
    id: row.id,
    trip_id: row.trip_id,
    from_currency: toCurrency(row.from_currency),
    to_currency: toCurrency(row.to_currency),
    rate: Number(row.rate),
    updated_by_member_id: row.updated_by_member_id,
    updated_at: row.updated_at,
  };
}

function mapSettlement(row: Row): Settlement {
  return {
    id: row.id,
    trip_id: row.trip_id,
    from_member_id: row.from_member_id,
    to_member_id: row.to_member_id,
    amount: Number(row.amount),
    currency: toCurrency(row.currency),
    status: row.status,
    created_by_member_id: row.created_by_member_id ?? undefined,
    paid_confirmed_by_member_id: row.paid_confirmed_by_member_id ?? undefined,
    created_at: row.created_at,
    paid_at: row.paid_at ?? undefined,
    voided_at: row.voided_at ?? undefined,
    voided_by_member_id: row.voided_by_member_id ?? undefined,
    void_reason: row.void_reason ?? undefined,
  };
}

function mapClosureVote(row: Row): TripClosureVote {
  return {
    id: row.id,
    trip_id: row.trip_id,
    member_id: row.member_id,
    approved_at: row.approved_at,
  };
}

function mapWorkspaceSummary(row: Row): WorkspaceSummary {
  return {
    member_id: row.member_id,
    trip_id: row.trip_id,
    trip_name: row.trip_name,
    base_currency: toCurrency(row.base_currency),
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    trip_status: row.trip_status ?? row.tripStatus ?? 'active',
    display_currency: row.display_currency ? toCurrency(row.display_currency) : null,
    created_at: row.created_at,
    approved_at: row.approved_at ?? undefined,
    removed_at: row.removed_at ?? undefined,
    closed_at: row.closed_at ?? undefined,
  };
}

function unwrapJsonObject(data: unknown, rpcName: string): Row {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${rpcName} did not return an object.`);
  }

  return data as Row;
}

function mapWorkspace(row: Row): PhaseOneWorkspace {
  const expenses = Array.isArray(row.expenses)
    ? row.expenses.map(mapExpense).filter(expense => !expense.deleted_at)
    : [];
  const activeExpenseIds = new Set(expenses.map(expense => expense.id));

  const workspace = {
    trip: mapNullableTrip(row.trip),
    currentMember: row.member ? mapMember(row.member) : null,
    members: Array.isArray(row.members) ? row.members.map(mapMember) : [],
    expenses,
    splits: Array.isArray(row.splits)
      ? row.splits.map(mapExpenseSplit).filter(split => activeExpenseIds.has(split.expense_id))
      : [],
    settlements: Array.isArray(row.settlements) ? row.settlements.map(mapSettlement) : [],
    exchangeRates: Array.isArray(row.exchangeRates) ? row.exchangeRates.map(mapExchangeRate) : [],
    closureVotes: Array.isArray(row.closureVotes) ? row.closureVotes.map(mapClosureVote) : [],
  };

  return workspace;
}

function mapWorkspaceForRpc(row: Row, source: string): PhaseOneWorkspace {
  void source;
  return mapWorkspace(row);
}

function throwSupabaseError(error: unknown): never {
  if (error && typeof error === 'object') {
    const row = error as Row;
    const rawMessage = [
      row.message,
      row.details,
      row.hint,
      row.code,
    ].filter(Boolean).join(' ');
    const normalizedMessage = rawMessage.toLowerCase();

    if (
      row.code === '23505' ||
      rawMessage.includes('members_trip_display_name_lower_idx') ||
      normalizedMessage.includes('duplicate key')
    ) {
      throw new Error(DUPLICATE_DISPLAY_NAME_MESSAGE);
    }

    if (
      rawMessage.includes(SETTLEMENT_EXPENSE_GUARD_MESSAGE) ||
      normalizedMessage.includes('void the related settlement')
    ) {
      throw new Error(SETTLEMENT_EXPENSE_GUARD_MESSAGE);
    }

    if (normalizedMessage.includes('this trip is being closed')) {
      throw new Error(TRIP_CLOSING_READONLY_MESSAGE);
    }

    if (normalizedMessage.includes('this trip is closed')) {
      throw new Error(TRIP_CLOSED_READONLY_MESSAGE);
    }

    const friendlyMessages = [
      'You still have an open balance. Settle up before leaving this trip.',
      'That member still has an open balance. Settle up before removing them.',
      'This trip needs at least one admin. Promote another member before leaving.',
      'This trip needs at least one admin. Promote another member before removing this admin.',
      'This trip needs at least one admin.',
      'Only admins can change admin roles.',
      'You cannot remove your own admin role.',
      'Admin roles cannot be changed while this trip is closing or closed.',
      'This trip cannot be closed until everyone is settled.',
      'Only approved admins can manage this trip.',
      'Only approved trip members can perform this action.',
      'The receiver or a trip admin can confirm this settlement.',
      'Only the receiver or a trip admin can void this settlement.',
      'Trip name is required.',
      'Invalid display currency.',
      'Invalid invite code.',
      'Invite code not found.',
      'Exchange rate must be greater than zero.',
      'Service fee must be between 0 and 100 percent.',
      'Split amounts must match the converted expense total.',
    ];

    const friendlyMatch = friendlyMessages.find(message =>
      normalizedMessage.includes(message.toLowerCase())
    );
    if (friendlyMatch) {
      throw new Error(useGroupTerminology(friendlyMatch));
    }

    const messageParts = [
      row.message,
    ].filter(Boolean);

    if (messageParts.length > 0) {
      throw new Error(useGroupTerminology(messageParts.join(' ')));
    }
  }

  throw new Error('Supabase request failed.');
}

export async function createTripWithAdmin(
  name: string,
  baseCurrency: Currency,
  displayName: string
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_trip_with_admin', {
    trip_name: name,
    base_currency: baseCurrency,
    display_name: displayName,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'create_trip_with_admin');
  return mapWorkspaceForRpc(row, 'create_trip_with_admin');
}

export async function requestJoinByInvite(
  inviteCode: string,
  displayName: string
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('request_join_by_invite', {
    invite_code_input: inviteCode,
    display_name: displayName,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'request_join_by_invite');
  return mapWorkspaceForRpc(row, 'request_join_by_invite');
}

export async function loadAuthWorkspace(memberId?: string | null): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_auth_workspace', {
    member_id_input: memberId ?? null,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'load_auth_workspace');
  return mapWorkspaceForRpc(row, 'load_auth_workspace');
}

export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('list_my_workspaces');

  if (error) throwSupabaseError(error);

  return Array.isArray(data) ? data.map(mapWorkspaceSummary) : [];
}

export async function claimLegacyMember(accessToken: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('claim_legacy_member', {
    access_token_input: accessToken,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'claim_legacy_member');
  return mapWorkspaceForRpc(row, 'claim_legacy_member');
}

export async function loadMemberSession(accessToken: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_member_session', {
    access_token_input: accessToken,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'load_member_session');
  return mapWorkspaceForRpc(row, 'load_member_session');
}

export async function approveMember(memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('approve_member', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);
}

export async function rejectMember(memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('reject_member', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);
}

export async function removeMember(memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('remove_member', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);
}

export async function promoteMemberToAdmin(memberId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('promote_member_to_admin', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);
}

export async function demoteAdmin(memberId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('demote_admin', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'demote_admin');
  return mapWorkspaceForRpc(row, 'demote_admin');
}

export async function leaveTrip(memberId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('leave_trip', {
    member_id_input: memberId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'leave_trip');
  return mapWorkspaceForRpc(row, 'leave_trip');
}

export async function startTripClosure(tripId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('start_trip_closure', {
    trip_id_input: tripId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'start_trip_closure');
  return mapWorkspaceForRpc(row, 'start_trip_closure');
}

export async function approveTripClosure(tripId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('approve_trip_closure', {
    trip_id_input: tripId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'approve_trip_closure');
  return mapWorkspaceForRpc(row, 'approve_trip_closure');
}

export async function cancelTripClosure(tripId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('cancel_trip_closure', {
    trip_id_input: tripId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'cancel_trip_closure');
  return mapWorkspaceForRpc(row, 'cancel_trip_closure');
}

export async function regenerateTripInviteCode(tripId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('regenerate_trip_invite_code', {
    trip_id_input: tripId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'regenerate_trip_invite_code');
  return mapWorkspaceForRpc(row, 'regenerate_trip_invite_code');
}

export async function updateTripName(
  tripId: string,
  name: string
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_trip_name', {
    trip_id_input: tripId,
    name_input: name,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'update_trip_name');
  return mapWorkspaceForRpc(row, 'update_trip_name');
}

export async function updateExchangeRate(
  tripId: string,
  fromCurrency: Currency,
  toCurrency: Currency,
  rate: number
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_exchange_rate', {
    trip_id_input: tripId,
    from_currency_input: fromCurrency,
    to_currency_input: toCurrency,
    rate_input: rate,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'update_exchange_rate');
  return mapWorkspaceForRpc(row, 'update_exchange_rate');
}

export async function updateMemberDisplayCurrency(
  memberId: string,
  displayCurrency: Currency | null
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_member_display_currency', {
    member_id_input: memberId,
    display_currency_input: displayCurrency,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'update_member_display_currency');
  return mapWorkspaceForRpc(row, 'update_member_display_currency');
}

export async function createExpenseWithSplits(
  tripId: string,
  title: string,
  amount: number,
  currency: Currency,
  exchangeRate: number,
  convertedAmount: number,
  paidByMemberId: string,
  expenseDate: string,
  notes: string,
  splitsList: ExpenseSplitInput[],
  feeInput?: ExpenseFeeInput | null
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_expense_with_splits', {
    trip_id_input: tripId,
    title_input: title,
    amount_input: amount,
    currency_input: currency,
    exchange_rate_to_base_input: exchangeRate,
    converted_amount_input: convertedAmount,
    paid_by_member_id_input: paidByMemberId,
    expense_date_input: expenseDate,
    notes_input: notes,
    splits_input: splitsList,
    subtotal_amount_input: feeInput?.subtotal_amount ?? null,
    fee_percent_input: feeInput?.fee_percent ?? null,
    fee_label_input: feeInput?.fee_label ?? null,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'create_expense_with_splits');
  return mapWorkspaceForRpc(row, 'create_expense_with_splits');
}

export async function updateExpenseWithSplits(
  expenseId: string,
  title: string,
  amount: number,
  currency: Currency,
  exchangeRate: number,
  convertedAmount: number,
  paidByMemberId: string,
  expenseDate: string,
  notes: string,
  splitsList: ExpenseSplitInput[],
  feeInput?: ExpenseFeeInput | null
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_expense_with_splits', {
    expense_id_input: expenseId,
    title_input: title,
    amount_input: amount,
    currency_input: currency,
    exchange_rate_to_base_input: exchangeRate,
    converted_amount_input: convertedAmount,
    paid_by_member_id_input: paidByMemberId,
    expense_date_input: expenseDate,
    notes_input: notes,
    splits_input: splitsList,
    subtotal_amount_input: feeInput?.subtotal_amount ?? null,
    fee_percent_input: feeInput?.fee_percent ?? null,
    fee_label_input: feeInput?.fee_label ?? null,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'update_expense_with_splits');
  return mapWorkspaceForRpc(row, 'update_expense_with_splits');
}

export async function deleteExpense(expenseId: string): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_expense', {
    expense_id_input: expenseId,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'delete_expense');
  return mapWorkspaceForRpc(row, 'delete_expense');
}

export async function markSettlementPaid(
  tripId: string,
  fromMemberId: string,
  toMemberId: string,
  amount: number
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('mark_settlement_paid', {
    trip_id_input: tripId,
    from_member_id_input: fromMemberId,
    to_member_id_input: toMemberId,
    amount_input: amount,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'mark_settlement_paid');
  return mapWorkspaceForRpc(row, 'mark_settlement_paid');
}

export async function voidSettlement(
  settlementId: string,
  reason: string
): Promise<PhaseOneWorkspace> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('void_settlement', {
    settlement_id_input: settlementId,
    reason_input: reason,
  });

  if (error) throwSupabaseError(error);

  const row = unwrapJsonObject(data, 'void_settlement');
  return mapWorkspaceForRpc(row, 'void_settlement');
}
