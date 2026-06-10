import { Currency, ExchangeRate, Expense, ExpenseSplit, Member, Settlement, Trip } from '../types';
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
}

export interface WorkspaceSummary {
  member_id: string;
  trip_id: string;
  trip_name: string;
  base_currency: Currency;
  display_name: string;
  role: Member['role'];
  status: Member['status'];
  display_currency: Currency | null;
  created_at: string;
  approved_at?: string;
  removed_at?: string;
}

type Row = Record<string, any>;

export const DUPLICATE_DISPLAY_NAME_MESSAGE =
  'Display name already used in this trip. Use another name or ask the admin to remove or reapprove the previous member.';

export const INVALID_MEMBER_SESSION_MESSAGE = 'Member session not found';

function mapTrip(row: Row): Trip {
  return {
    id: row.id,
    name: row.name,
    base_currency: row.base_currency,
    invite_code: row.invite_code,
    created_at: row.created_at,
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
    currency: row.currency,
    exchange_rate_to_base: Number(row.exchange_rate_to_base),
    converted_amount: Number(row.converted_amount),
    paid_by_member_id: row.paid_by_member_id,
    expense_date: row.expense_date,
    notes: row.notes ?? '',
    created_by_member_id: row.created_by_member_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapExpenseSplit(row: Row): ExpenseSplit {
  return {
    id: row.id,
    expense_id: row.expense_id,
    member_id: row.member_id,
    amount_owed: Number(row.amount_owed),
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
    display_currency: row.display_currency ? toCurrency(row.display_currency) : null,
    created_at: row.created_at,
    approved_at: row.approved_at ?? undefined,
    removed_at: row.removed_at ?? undefined,
  };
}

function unwrapJsonObject(data: unknown, rpcName: string): Row {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${rpcName} did not return an object.`);
  }

  return data as Row;
}

function mapWorkspace(row: Row): PhaseOneWorkspace {
  const workspace = {
    trip: mapNullableTrip(row.trip),
    currentMember: row.member ? mapMember(row.member) : null,
    members: Array.isArray(row.members) ? row.members.map(mapMember) : [],
    expenses: Array.isArray(row.expenses) ? row.expenses.map(mapExpense) : [],
    splits: Array.isArray(row.splits) ? row.splits.map(mapExpenseSplit) : [],
    settlements: Array.isArray(row.settlements) ? row.settlements.map(mapSettlement) : [],
    exchangeRates: Array.isArray(row.exchangeRates) ? row.exchangeRates.map(mapExchangeRate) : [],
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

    if (
      row.code === '23505' ||
      rawMessage.includes('members_trip_display_name_lower_idx') ||
      rawMessage.toLowerCase().includes('duplicate key')
    ) {
      throw new Error(DUPLICATE_DISPLAY_NAME_MESSAGE);
    }

    const messageParts = [
      row.message,
    ].filter(Boolean);

    if (messageParts.length > 0) {
      throw new Error(messageParts.join(' '));
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
  splitsList: { member_id: string; amount_owed: number }[]
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
  splitsList: { member_id: string; amount_owed: number }[]
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
