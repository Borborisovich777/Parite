import React, { useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  ReceiptText,
  Scale,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  ExchangeRate,
  Expense,
  ExpenseSplit,
  Member,
  Settlement,
  Trip,
} from '../types';
import {
  calculateOpenMemberBalances,
  calculateSettlementRecommendations,
} from '../lib/calculations';
import {
  formatDisplayMoney,
  getMemberDisplayCurrency,
} from '../lib/exchangeRates';
import { ExpenseIcon } from './ExpenseIcon';

export interface OverviewTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  exchangeRates?: ExchangeRate[];
  members: Member[];
  pendingRequestsCount: number;
  isReadOnly?: boolean;
  onAddExpense: () => void;
  onReviewBalances: () => void;
  onManageMembers: () => void;
  onOpenExpense: (expenseId: string) => void;
}

const formatActivityDate = (dateKey: string) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (dateKey === toDateKey(today)) return 'Today';
  if (dateKey === toDateKey(yesterday)) return 'Yesterday';

  const parsedDate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return dateKey;

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: parsedDate.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  settlements,
  exchangeRates = [],
  members,
  pendingRequestsCount,
  isReadOnly = false,
  onAddExpense,
  onReviewBalances,
  onManageMembers,
  onOpenExpense,
}) => {
  const approvedMembers = useMemo(
    () => members.filter(member => member.status === 'approved'),
    [members],
  );
  const balances = useMemo(
    () => calculateOpenMemberBalances(expenses, splits, settlements, approvedMembers),
    [approvedMembers, expenses, settlements, splits],
  );
  const recommendations = useMemo(
    () => calculateSettlementRecommendations(balances, settlements, trip.base_currency),
    [balances, settlements, trip.base_currency],
  );
  const currentMemberRecommendations = useMemo(
    () => recommendations.filter(recommendation => (
      recommendation.from_member_id === currentMember.id
      || recommendation.to_member_id === currentMember.id
    )),
    [currentMember.id, recommendations],
  );
  const recentExpenses = useMemo(
    () => [...expenses]
      .sort((left, right) => {
        const dateDifference = right.expense_date.localeCompare(left.expense_date);
        if (dateDifference !== 0) return dateDifference;
        return right.created_at.localeCompare(left.created_at);
      })
      .slice(0, 4),
    [expenses],
  );

  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
  const currentBalance = balances.find(balance => balance.member_id === currentMember.id);
  const currentNetBalance = currentBalance?.net_balance ?? 0;
  const isOwed = currentNetBalance > 0.01;
  const doesOwe = currentNetBalance < -0.01;
  const balanceDisplay = formatDisplayMoney(
    Math.abs(currentNetBalance),
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id,
  );
  const groupSpend = expenses.reduce((sum, expense) => sum + expense.converted_amount, 0);
  const groupSpendDisplay = formatDisplayMoney(
    groupSpend,
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id,
  );
  const firstRecommendation = currentMemberRecommendations[0] ?? null;
  const firstRecommendationDisplay = firstRecommendation
    ? formatDisplayMoney(
      firstRecommendation.amount,
      trip.base_currency,
      displayCurrency,
      exchangeRates,
      trip.id,
    )
    : null;
  const safePendingRequestsCount = Math.max(0, pendingRequestsCount);
  const attentionCount = currentMemberRecommendations.length + safePendingRequestsCount;
  const balanceLabel = isOwed ? 'You are owed' : doesOwe ? 'You owe' : 'You are settled up';
  const primaryActionIsReview = isOwed || doesOwe || isReadOnly;
  const balanceTone = isOwed
    ? 'text-[var(--color-positive)]'
    : doesOwe
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text)]';

  const recommendationCopy = firstRecommendation
    ? firstRecommendation.from_member_id === currentMember.id
      ? `You pay ${firstRecommendation.to_display_name}`
      : `${firstRecommendation.from_display_name} pays you`
    : '';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-24 pt-5 animate-fade-in md:px-6 md:pb-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <section className="header-wash order-1 rounded-3xl border border-[var(--color-border)] p-5 shadow-[var(--shadow-card)] md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
                Your position
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
                Overview
              </h2>
            </div>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${balanceTone}`}>
              {isOwed || doesOwe ? <Wallet className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
          </div>

          <p className={`mt-6 text-xs font-bold ${balanceTone}`}>{balanceLabel}</p>
          <p className={`mt-1 font-mono text-3xl font-bold tracking-tight tabular-nums ${balanceTone}`}>
            {balanceDisplay.primary}
          </p>
          {balanceDisplay.secondary && (
            <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">
              {balanceDisplay.secondary}
            </p>
          )}
          {balanceDisplay.helper && (
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              {balanceDisplay.helper}
            </p>
          )}

          <button
            type="button"
            id="btn-overview-primary-action"
            onClick={primaryActionIsReview ? onReviewBalances : onAddExpense}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] accent-glow cursor-pointer"
          >
            {primaryActionIsReview ? <Scale className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {primaryActionIsReview ? 'Review balances' : 'Add an expense'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="parite-card order-3 p-4 md:p-5 lg:order-2" aria-labelledby="overview-quick-actions-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
                Shortcuts
              </p>
              <h3 id="overview-quick-actions-title" className="mt-1 font-display text-lg font-bold text-[var(--color-text)]">
                Quick actions
              </h3>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {!isReadOnly && primaryActionIsReview && (
              <button
                type="button"
                id="btn-overview-add-expense"
                onClick={onAddExpense}
                className="flex min-h-12 items-center gap-3 rounded-2xl bg-[var(--color-positive)] px-4 text-left text-[#fff] cursor-pointer"
              >
                <Plus className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold">Add expense</span>
                  <span className="mt-0.5 block text-[10px] opacity-80">
                    Record a shared cost
                  </span>
                </span>
              </button>
            )}
            {!primaryActionIsReview && (
              <button
                type="button"
                id="btn-overview-review-balances"
                onClick={onReviewBalances}
                className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 text-left text-[var(--color-text)] cursor-pointer"
              >
                <Scale className="h-5 w-5 shrink-0 text-[var(--color-positive)]" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold">Balances</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">Review transfers</span>
                </span>
              </button>
            )}
            <button
              type="button"
              id="btn-overview-manage-members"
              onClick={onManageMembers}
              className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 text-left text-[var(--color-text)] cursor-pointer"
            >
              <UserPlus className="h-5 w-5 shrink-0 text-[var(--color-positive)]" />
              <span className="min-w-0">
                <span className="block text-xs font-bold">Members</span>
                <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">Manage or invite</span>
              </span>
            </button>
          </div>
        </section>

      <section className="parite-card order-2 p-4 md:p-5 lg:order-3 lg:col-span-2" aria-labelledby="overview-attention-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
              Next steps
            </p>
            <h3 id="overview-attention-title" className="mt-1 font-display text-lg font-bold text-[var(--color-text)]">
              Needs attention
            </h3>
          </div>
          <span className={`flex min-h-7 min-w-7 items-center justify-center rounded-full px-2 font-mono text-[10px] font-bold ${
            attentionCount > 0
              ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]'
              : 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]'
          }`}>
            {attentionCount}
          </span>
        </div>

        {attentionCount === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--color-positive-soft)] px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-positive)]" />
            <div>
              <p className="text-xs font-bold text-[var(--color-positive)]">Nothing waiting on you</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                You have no personal transfers or member requests to review.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {firstRecommendation && firstRecommendationDisplay && (
              <button
                type="button"
                id="btn-overview-next-transfer"
                onClick={onReviewBalances}
                className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-left cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    Next transfer · {currentMemberRecommendations.length}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-[var(--color-text)]">
                    {recommendationCopy}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-bold text-[var(--color-text)] tabular-nums">
                    {firstRecommendationDisplay.primary}
                  </span>
                  <ArrowRight className="ml-auto mt-1 h-4 w-4 text-[var(--color-positive)]" />
                </span>
              </button>
            )}

            {safePendingRequestsCount > 0 && (
              <button
                type="button"
                id="btn-overview-pending-requests"
                onClick={onManageMembers}
                className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-left cursor-pointer"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-positive)] shadow-sm">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--color-text)]">
                      Member {safePendingRequestsCount === 1 ? 'request' : 'requests'}
                    </span>
                    <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
                      Waiting for review
                    </span>
                  </span>
                </span>
                <span className="flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-negative)] px-2 font-mono text-[10px] font-bold text-[#fff]">
                  {safePendingRequestsCount}
                </span>
              </button>
            )}
          </div>
        )}
      </section>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
        <section className="parite-card overflow-hidden" aria-labelledby="overview-recent-title">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 md:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
                Expenses
              </p>
              <h3 id="overview-recent-title" className="mt-1 font-display text-lg font-bold text-[var(--color-text)]">
                Recent activity
              </h3>
            </div>
            {expenses.length > 4 && (
              <span className="text-[10px] font-medium text-[var(--color-muted)]">
                Latest 4
              </span>
            )}
          </div>

          {recentExpenses.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface-soft)] text-[var(--color-positive)]">
                <ReceiptText className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-[var(--color-text)]">No expenses yet</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {isReadOnly
                  ? trip.status === 'closing'
                    ? 'No expenses were recorded before closeout began.'
                    : 'This group closed without recorded expenses.'
                  : 'Add the first shared expense to get started.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {recentExpenses.map(expense => {
                const payer = members.find(member => member.id === expense.paid_by_member_id);
                const expenseDisplay = formatDisplayMoney(
                  expense.converted_amount,
                  trip.base_currency,
                  displayCurrency,
                  exchangeRates,
                  trip.id,
                );

                return (
                  <button
                    type="button"
                    key={expense.id}
                    id={`btn-overview-expense-${expense.id}`}
                    onClick={() => onOpenExpense(expense.id)}
                    className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-soft)] cursor-pointer md:px-5"
                  >
                    <ExpenseIcon title={expense.title} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--color-text)]">
                        {expense.title}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
                        <Clock3 className="h-3 w-3 shrink-0" />
                        {formatActivityDate(expense.expense_date)}
                        <span aria-hidden="true">·</span>
                        Paid by {payer?.id === currentMember.id ? 'you' : payer?.display_name ?? 'a member'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-xs font-bold text-[var(--color-text)] tabular-nums">
                        {expenseDisplay.primary}
                      </span>
                      {expense.currency !== trip.base_currency && (
                        <span className="mt-1 block font-mono text-[9px] text-[var(--color-muted)]">
                          {expense.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {expense.currency}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="parite-card p-4 md:p-5" aria-labelledby="overview-group-pulse-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
                Group pulse
              </p>
              <h3 id="overview-group-pulse-title" className="mt-1 font-display text-lg font-bold text-[var(--color-text)]">
                Total group spend
              </h3>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
              <ReceiptText className="h-5 w-5" />
            </span>
          </div>

          <p className="mt-5 font-mono text-2xl font-bold text-[var(--color-text)] tabular-nums">
            {groupSpendDisplay.primary}
          </p>
          {groupSpendDisplay.secondary && (
            <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">
              {groupSpendDisplay.secondary}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[var(--color-surface-soft)] px-3 py-3">
              <p className="font-mono text-lg font-bold text-[var(--color-text)]">{expenses.length}</p>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                {expenses.length === 1 ? 'expense' : 'expenses'}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-soft)] px-3 py-3">
              <p className="font-mono text-lg font-bold text-[var(--color-text)]">{approvedMembers.length}</p>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                {approvedMembers.length === 1 ? 'active member' : 'active members'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
