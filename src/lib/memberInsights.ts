import { Expense, ExpenseSplit, Settlement } from '../types';

export interface MemberChartSlice {
  label: string;
  amount: number;
  expenseId?: string;
}

export interface MemberExpenseInsight {
  expense: Expense;
  split?: ExpenseSplit;
}

export interface MemberSettlementTotals {
  sent: number;
  received: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const safeAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const getActiveExpenses = (expenses: Expense[]) => expenses.filter(expense => !expense.deleted_at);

const getActiveExpenseIdSet = (expenses: Expense[]) => new Set(getActiveExpenses(expenses).map(expense => expense.id));

export function getMemberTotalPaid(memberId: string, expenses: Expense[]): number {
  return roundMoney(getActiveExpenses(expenses)
    .filter(expense => expense.paid_by_member_id === memberId)
    .reduce((sum, expense) => sum + safeAmount(expense.converted_amount), 0));
}

export function getMemberTotalShare(memberId: string, expenses: Expense[], splits: ExpenseSplit[]): number {
  const activeExpenseIds = getActiveExpenseIdSet(expenses);

  return roundMoney(splits
    .filter(split => split.member_id === memberId && activeExpenseIds.has(split.expense_id))
    .reduce((sum, split) => sum + safeAmount(split.amount_owed), 0));
}

export function getMemberServiceFeeShare(memberId: string, expenses: Expense[], splits: ExpenseSplit[]): number {
  const activeExpenseIds = getActiveExpenseIdSet(expenses);

  return roundMoney(splits
    .filter(split => split.member_id === memberId && activeExpenseIds.has(split.expense_id))
    .reduce((sum, split) => sum + safeAmount(split.fee_amount_owed), 0));
}

export function getMemberSettlementTotals(memberId: string, settlements: Settlement[]): MemberSettlementTotals {
  const paidSettlements = settlements.filter(settlement => settlement.status === 'paid');

  return {
    sent: roundMoney(paidSettlements
      .filter(settlement => settlement.from_member_id === memberId)
      .reduce((sum, settlement) => sum + safeAmount(settlement.amount), 0)),
    received: roundMoney(paidSettlements
      .filter(settlement => settlement.to_member_id === memberId)
      .reduce((sum, settlement) => sum + safeAmount(settlement.amount), 0)),
  };
}

export function getMemberPaidExpenseSlices(memberId: string, expenses: Expense[]): MemberChartSlice[] {
  return getActiveExpenses(expenses)
    .filter(expense => expense.paid_by_member_id === memberId)
    .map(expense => ({
      label: expense.title || 'Untitled expense',
      amount: roundMoney(safeAmount(expense.converted_amount)),
      expenseId: expense.id,
    }))
    .filter(slice => slice.amount > 0);
}

export function getMemberShareExpenseSlices(
  memberId: string,
  expenses: Expense[],
  splits: ExpenseSplit[]
): MemberChartSlice[] {
  const activeExpenseMap = new Map(getActiveExpenses(expenses).map(expense => [expense.id, expense]));

  return splits
    .filter(split => split.member_id === memberId && activeExpenseMap.has(split.expense_id))
    .map(split => {
      const expense = activeExpenseMap.get(split.expense_id);
      return {
        label: expense?.title || 'Untitled expense',
        amount: roundMoney(safeAmount(split.amount_owed)),
        expenseId: split.expense_id,
      };
    })
    .filter(slice => slice.amount > 0);
}

export function buildTopSlices(slices: MemberChartSlice[], maxSlices = 5): MemberChartSlice[] {
  const sortedSlices = slices
    .map(slice => ({
      ...slice,
      amount: roundMoney(safeAmount(slice.amount)),
    }))
    .filter(slice => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (sortedSlices.length <= maxSlices) {
    return sortedSlices;
  }

  const topSlices = sortedSlices.slice(0, maxSlices);
  const otherAmount = roundMoney(sortedSlices.slice(maxSlices).reduce((sum, slice) => sum + slice.amount, 0));

  return otherAmount > 0
    ? [...topSlices, { label: 'Other', amount: otherAmount }]
    : topSlices;
}

export function getMemberRelevantExpenses(
  memberId: string,
  expenses: Expense[],
  splits: ExpenseSplit[]
): { paid: MemberExpenseInsight[]; shared: MemberExpenseInsight[] } {
  const activeExpenses = getActiveExpenses(expenses);
  const splitMap = new Map<string, ExpenseSplit>();

  splits.forEach(split => {
    if (split.member_id === memberId) {
      splitMap.set(split.expense_id, split);
    }
  });

  const paid = activeExpenses
    .filter(expense => expense.paid_by_member_id === memberId)
    .map(expense => ({
      expense,
      split: splitMap.get(expense.id),
    }));

  const shared = activeExpenses
    .filter(expense => splitMap.has(expense.id))
    .map(expense => ({
      expense,
      split: splitMap.get(expense.id),
    }));

  const byNewestDate = (a: MemberExpenseInsight, b: MemberExpenseInsight) => {
    const dateDiff = new Date(b.expense.expense_date).getTime() - new Date(a.expense.expense_date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.expense.created_at).getTime() - new Date(a.expense.created_at).getTime();
  };

  return {
    paid: paid.sort(byNewestDate),
    shared: shared.sort(byNewestDate),
  };
}
