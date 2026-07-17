import { ExchangeRate, Expense, ExpenseSplit, Member, Settlement, Trip } from '../types';
import { calculateOpenMemberBalances } from './calculations';
import { convertBaseToDisplayAmount, getMemberDisplayCurrency } from './exchangeRates';

type CsvValue = string | number | null | undefined;

interface ExportContext {
  trip: Trip;
  currentMember: Member;
  members: Member[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  exchangeRates: ExchangeRate[];
}

export function escapeCsvValue(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  return [
    headers.map(escapeCsvValue).join(','),
    ...rows.map(row => row.map(escapeCsvValue).join(',')),
  ].join('\r\n');
}

export function slugifyFilenamePart(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'group';
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function localDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function exportFilename(trip: Trip, exportType: 'expenses' | 'balances' | 'settlements'): string {
  return `parite-${slugifyFilenamePart(trip.name)}-${exportType}-${localDateStamp()}.csv`;
}

function money(value: number | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return amount.toFixed(2);
}

function findMemberName(memberMap: Map<string, Member>, memberId: string | undefined): string {
  if (!memberId) return '';
  return memberMap.get(memberId)?.display_name ?? memberId;
}

function formatSplitAmounts(
  splits: ExpenseSplit[],
  memberMap: Map<string, Member>,
  baseCurrency: string,
  field: 'amount_owed' | 'subtotal_amount_owed' | 'fee_amount_owed'
): string {
  return splits
    .map(split => {
      const fallback = field === 'amount_owed' ? split.amount_owed : field === 'subtotal_amount_owed' ? split.amount_owed : 0;
      const value = split[field] ?? fallback;
      return `${findMemberName(memberMap, split.member_id)}: ${money(value)} ${baseCurrency}`;
    })
    .join('; ');
}

export function exportExpensesCsv(context: ExportContext): void {
  const { trip, members, expenses, splits } = context;
  const memberMap = new Map(members.map(member => [member.id, member]));
  const activeExpenses = expenses.filter(expense => !expense.deleted_at);
  const headers = [
    'expense_id',
    'date',
    'title',
    'payer',
    'original_subtotal_amount',
    'fee_percent',
    'fee_amount',
    'fee_label',
    'original_final_amount',
    'original_currency',
    'exchange_rate_to_base',
    'converted_amount_base',
    'base_currency',
    'participants',
    'split_amounts_base',
    'split_subtotal_amounts_base',
    'split_fee_amounts_base',
    'notes',
    'created_by',
    'created_at',
    'updated_at',
  ];

  const rows = activeExpenses.map(expense => {
    const expenseSplits = splits.filter(split => split.expense_id === expense.id);
    const participants = expenseSplits
      .map(split => findMemberName(memberMap, split.member_id))
      .join('; ');
    const subtotalAmount = expense.subtotal_amount ?? expense.amount;
    const feePercent = expense.fee_percent ?? 0;
    const feeAmount = expense.fee_amount ?? 0;

    return [
      expense.id,
      expense.expense_date,
      expense.title,
      findMemberName(memberMap, expense.paid_by_member_id),
      money(subtotalAmount),
      money(feePercent),
      money(feeAmount),
      feeAmount > 0 ? expense.fee_label ?? 'Service fee' : '',
      money(expense.amount),
      expense.currency,
      String(expense.exchange_rate_to_base),
      money(expense.converted_amount),
      trip.base_currency,
      participants,
      formatSplitAmounts(expenseSplits, memberMap, trip.base_currency, 'amount_owed'),
      formatSplitAmounts(expenseSplits, memberMap, trip.base_currency, 'subtotal_amount_owed'),
      formatSplitAmounts(expenseSplits, memberMap, trip.base_currency, 'fee_amount_owed'),
      expense.notes ?? '',
      findMemberName(memberMap, expense.created_by_member_id),
      expense.created_at,
      expense.updated_at,
    ];
  });

  downloadCsv(exportFilename(trip, 'expenses'), buildCsv(headers, rows));
}

function getBalanceExportMembers(members: Member[], expenses: Expense[], splits: ExpenseSplit[], settlements: Settlement[]): Member[] {
  const referencedMemberIds = new Set<string>();

  for (const member of members) {
    if (member.status === 'approved') referencedMemberIds.add(member.id);
  }

  for (const expense of expenses) {
    referencedMemberIds.add(expense.paid_by_member_id);
    referencedMemberIds.add(expense.created_by_member_id);
  }

  for (const split of splits) {
    referencedMemberIds.add(split.member_id);
  }

  for (const settlement of settlements) {
    referencedMemberIds.add(settlement.from_member_id);
    referencedMemberIds.add(settlement.to_member_id);
    if (settlement.paid_confirmed_by_member_id) referencedMemberIds.add(settlement.paid_confirmed_by_member_id);
    if (settlement.voided_by_member_id) referencedMemberIds.add(settlement.voided_by_member_id);
  }

  return members.filter(member => referencedMemberIds.has(member.id));
}

export function exportBalancesCsv(context: ExportContext): void {
  const { trip, currentMember, members, expenses, splits, settlements, exchangeRates } = context;
  const activeExpenses = expenses.filter(expense => !expense.deleted_at);
  const activeExpenseIds = new Set(activeExpenses.map(expense => expense.id));
  const activeSplits = splits.filter(split => activeExpenseIds.has(split.expense_id));
  const exportMembers = getBalanceExportMembers(members, activeExpenses, activeSplits, settlements);
  const balances = calculateOpenMemberBalances(activeExpenses, activeSplits, settlements, exportMembers);
  const balanceByMemberId = new Map(balances.map(balance => [balance.member_id, balance]));
  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
  const paidSettlements = settlements.filter(settlement => settlement.status === 'paid');
  const headers = [
    'member_id',
    'member',
    'role',
    'status',
    'total_paid_expenses_base',
    'total_owed_expense_splits_base',
    'paid_settlements_sent_base',
    'paid_settlements_received_base',
    'open_balance_base',
    'base_currency',
    'display_balance',
    'display_currency',
  ];

  const rows = exportMembers.map(member => {
    const balance = balanceByMemberId.get(member.id);
    const paidSent = paidSettlements
      .filter(settlement => settlement.from_member_id === member.id)
      .reduce((sum, settlement) => sum + settlement.amount, 0);
    const paidReceived = paidSettlements
      .filter(settlement => settlement.to_member_id === member.id)
      .reduce((sum, settlement) => sum + settlement.amount, 0);
    const displayBalance = displayCurrency === trip.base_currency
      ? balance?.net_balance ?? 0
      : convertBaseToDisplayAmount(balance?.net_balance ?? 0, trip.base_currency, displayCurrency, exchangeRates, trip.id);

    return [
      member.id,
      member.display_name,
      member.role,
      member.status,
      money(balance?.total_paid ?? 0),
      money(balance?.total_owed ?? 0),
      money(paidSent),
      money(paidReceived),
      money(balance?.net_balance ?? 0),
      trip.base_currency,
      displayBalance === null ? '' : money(displayBalance),
      displayBalance === null ? '' : displayCurrency,
    ];
  });

  downloadCsv(exportFilename(trip, 'balances'), buildCsv(headers, rows));
}

export function exportSettlementsCsv(context: ExportContext): void {
  const { trip, members, settlements } = context;
  const memberMap = new Map(members.map(member => [member.id, member]));
  const settlementHistory = settlements.filter(settlement =>
    settlement.status === 'paid' || settlement.status === 'voided'
  );
  const headers = [
    'settlement_id',
    'status',
    'paid_at',
    'voided_at',
    'from_member',
    'to_member',
    'amount_base',
    'base_currency',
    'confirmed_by',
    'voided_by',
    'void_reason',
    'created_at',
  ];

  const rows = settlementHistory.map(settlement => [
    settlement.id,
    settlement.status,
    settlement.paid_at ?? '',
    settlement.voided_at ?? '',
    findMemberName(memberMap, settlement.from_member_id),
    findMemberName(memberMap, settlement.to_member_id),
    money(settlement.amount),
    settlement.currency || trip.base_currency,
    findMemberName(memberMap, settlement.paid_confirmed_by_member_id),
    findMemberName(memberMap, settlement.voided_by_member_id),
    settlement.void_reason ?? '',
    settlement.created_at,
  ]);

  downloadCsv(exportFilename(trip, 'settlements'), buildCsv(headers, rows));
}
