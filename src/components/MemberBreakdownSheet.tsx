import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Receipt, Scale, Wallet, X } from 'lucide-react';
import { ExchangeRate, Expense, ExpenseSplit, Member, Settlement, Trip } from '../types';
import { calculateOpenMemberBalances } from '../lib/calculations';
import { formatDisplayMoney, formatMoney, getMemberDisplayCurrency } from '../lib/exchangeRates';
import {
  getMemberPaidExpenseSlices,
  getMemberRelevantExpenses,
  getMemberServiceFeeShare,
  getMemberSettlementTotals,
  getMemberShareExpenseSlices,
  getMemberTotalPaid,
  getMemberTotalShare,
  MemberExpenseInsight,
} from '../lib/memberInsights';
import { SpendingDonutChart, type SpendingDonutSlice } from './SpendingDonutChart';
import { MemberAvatar } from './MemberAvatar';
import { ExpenseIcon } from './ExpenseIcon';
import {
  EXPENSE_VISUAL_CATEGORIES,
  readExpenseVisualPreference,
  resolveExpenseVisual,
  type ExpenseVisualCategoryId,
  type ExpenseVisualId,
} from '../lib/expenseVisuals';

type ChartMode = 'paid' | 'share';
type ExpenseListMode = 'paid' | 'shared';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const CATEGORY_CHART_VISUAL_IDS = {
  'food-drink': 'groceries',
  transport: 'taxi',
  'stay-home': 'hotel',
  shopping: 'shopping',
  fun: 'events',
  care: 'healthcare',
  'life-other': 'miscellaneous',
} as const satisfies Record<ExpenseVisualCategoryId, ExpenseVisualId>;

interface MemberBreakdownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  currentMember: Member;
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  exchangeRates: ExchangeRate[];
}

export const MemberBreakdownSheet: React.FC<MemberBreakdownSheetProps> = ({
  isOpen,
  onClose,
  member,
  currentMember,
  trip,
  members,
  expenses,
  splits,
  settlements,
  exchangeRates,
}) => {
  const headingId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [chartMode, setChartMode] = useState<ChartMode>('paid');
  const [expenseListMode, setExpenseListMode] = useState<ExpenseListMode>('paid');
  const [selectedCategoryId, setSelectedCategoryId] = useState<ExpenseVisualCategoryId | null>(null);
  const baseCurrency = trip.base_currency;
  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const memberMetrics = useMemo(() => {
    if (!member) return null;

    const openBalance = calculateOpenMemberBalances(expenses, splits, settlements, [member])
      .find(balance => balance.member_id === member.id)?.net_balance ?? 0;

    return {
      totalPaid: getMemberTotalPaid(member.id, expenses),
      totalShare: getMemberTotalShare(member.id, expenses, splits),
      serviceFeeShare: getMemberServiceFeeShare(member.id, expenses, splits),
      settlements: getMemberSettlementTotals(member.id, settlements),
      openBalance,
    };
  }, [expenses, member, settlements, splits]);

  const relevantExpenses = useMemo(() => {
    if (!member) return { paid: [], shared: [] };
    return getMemberRelevantExpenses(member.id, expenses, splits);
  }, [expenses, member, splits]);

  const chartSlices = useMemo<SpendingDonutSlice[]>(() => {
    if (!member) return [];

    const sourceSlices = chartMode === 'paid'
      ? getMemberPaidExpenseSlices(member.id, expenses)
      : getMemberShareExpenseSlices(member.id, expenses, splits);
    const expenseById = new Map<string, Expense>(
      expenses.map(expense => [expense.id, expense]),
    );
    const categoryTotals = new Map<ExpenseVisualCategoryId, {
      amount: number;
      expenseIds: Set<string>;
    }>();

    sourceSlices.forEach(slice => {
      if (!slice.expenseId) return;
      const expense = expenseById.get(slice.expenseId);
      if (!expense) return;

      const visual = resolveExpenseVisual(
        expense.title,
        readExpenseVisualPreference(trip.id, expense.title),
      );
      const current = categoryTotals.get(visual.categoryId) ?? {
        amount: 0,
        expenseIds: new Set<string>(),
      };
      current.amount += slice.amount;
      current.expenseIds.add(expense.id);
      categoryTotals.set(visual.categoryId, current);
    });

    return EXPENSE_VISUAL_CATEGORIES.flatMap(category => {
      const total = categoryTotals.get(category.id);
      if (!total || total.amount <= 0) return [];

      return [{
        id: category.id,
        label: category.label,
        amount: Math.round(total.amount * 100) / 100,
        expenseCount: total.expenseIds.size,
        color: category.palette.foreground,
        surface: category.palette.surface,
        visualId: CATEGORY_CHART_VISUAL_IDS[category.id],
      }];
    });
  }, [chartMode, expenses, isOpen, member, splits, trip.id]);

  useEffect(() => {
    setSelectedCategoryId(null);
  }, [isOpen, member?.id]);

  useEffect(() => {
    if (!isOpen || !member) return;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableCandidates = Array.from(
        dialog.querySelectorAll(focusableSelector),
      ) as HTMLElement[];
      const focusableElements = focusableCandidates.filter(element => (
        !element.hasAttribute('disabled')
        && element.getAttribute('aria-hidden') !== 'true'
        && element.getClientRects().length > 0
        && window.getComputedStyle(element).visibility !== 'hidden'
      ));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;

      const isVisibleFocusTarget = (element: HTMLElement | null): element is HTMLElement => Boolean(
        element
        && element !== document.body
        && element.isConnected
        && element.getClientRects().length > 0
        && window.getComputedStyle(element).visibility !== 'hidden',
      );
      const previousFocus = previouslyFocusedElementRef.current;
      previouslyFocusedElementRef.current = null;

      if (isVisibleFocusTarget(previousFocus)) {
        previousFocus.focus();
        return;
      }

      const fallbackFocus = [
        document.getElementById(`balance-row-${member.id}`),
        document.getElementById(`btn-view-spending-${member.id}`),
        document.getElementById('nav-tab-balances'),
        document.getElementById('nav-tab-balances-desktop'),
        document.getElementById('nav-tab-balances-rail'),
        document.getElementById('nav-tab-members'),
        document.getElementById('nav-tab-members-desktop'),
        document.getElementById('nav-tab-members-rail'),
      ].find(isVisibleFocusTarget);
      fallbackFocus?.focus();
    };
  }, [isOpen, member?.id]);

  if (!isOpen || !member || !memberMetrics) return null;

  const memberName = member.display_name;
  const paidExpenseCount = relevantExpenses.paid.length;
  const sharedExpenseCount = relevantExpenses.shared.length;
  const unfilteredListItems = expenseListMode === 'paid' ? relevantExpenses.paid : relevantExpenses.shared;
  const getExpenseCategoryId = (expense: Expense): ExpenseVisualCategoryId => resolveExpenseVisual(
    expense.title,
    readExpenseVisualPreference(trip.id, expense.title),
  ).categoryId;
  const listItems = selectedCategoryId
    ? unfilteredListItems.filter(item => getExpenseCategoryId(item.expense) === selectedCategoryId)
    : unfilteredListItems;
  const selectedCategory = selectedCategoryId
    ? EXPENSE_VISUAL_CATEGORIES.find(category => category.id === selectedCategoryId) ?? null
    : null;
  const listEmptyText = expenseListMode === 'paid'
    ? 'This member has not paid for any expenses yet.'
    : 'This member has no shared expense splits yet.';
  const chartEmptyText = 'No spending data yet.';

  const handleCategorySelection = (sliceId: string | null) => {
    setSelectedCategoryId(sliceId as ExpenseVisualCategoryId | null);
    setExpenseListMode(chartMode === 'paid' ? 'paid' : 'shared');
  };

  const handleExpenseListModeChange = (nextMode: ExpenseListMode) => {
    setExpenseListMode(nextMode);
    setChartMode(nextMode === 'paid' ? 'paid' : 'share');
    setSelectedCategoryId(null);
  };

  const findMemberName = (memberId: string) =>
    members.find(item => item.id === memberId)?.display_name ?? 'Removed member';

  const displayEquivalent = (amount: number) => {
    if (displayCurrency === baseCurrency) return null;
    return formatDisplayMoney(amount, baseCurrency, displayCurrency, exchangeRates, trip.id);
  };

  const MetricCard = ({
    label,
    amount,
    icon,
    tone = 'text-slate-100',
  }: {
    label: string;
    amount: number;
    icon: React.ReactNode;
    tone?: string;
  }) => {
    const display = displayEquivalent(amount);

    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1a1d23] p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#121418] text-indigo-300">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <p className={`mt-2 font-mono text-sm font-bold ${tone}`}>
          {formatMoney(amount, baseCurrency)}
        </p>
        {display && display.converted && (
          <p className="mt-1 text-[10px] font-mono text-slate-500">{display.primary}</p>
        )}
        {display?.helper && (
          <p className="mt-1 text-[10px] text-slate-500">{display.helper}</p>
        )}
      </div>
    );
  };

  const ExpenseRow: React.FC<{ item: MemberExpenseInsight }> = ({ item }) => {
    const { expense, split } = item;
    const shareAmount = split?.amount_owed ?? 0;
    const feeShare = split?.fee_amount_owed ?? 0;
    const hasServiceFee = (expense.fee_percent ?? 0) > 0 || feeShare > 0;

    return (
      <div className="rounded-2xl border border-slate-800 bg-[#1a1d23] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ExpenseIcon
              title={expense.title}
              visualId={readExpenseVisualPreference(trip.id, expense.title)}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-100">{expense.title}</p>
              <p className="mt-1 truncate text-[10px] text-slate-500">
                Paid by {findMemberName(expense.paid_by_member_id)} · {new Date(expense.expense_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-right text-[10px] font-mono text-slate-400">
            {formatMoney(expense.amount, expense.currency)}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-[#121418] px-3 py-2">
            <p className="text-slate-500">Total base</p>
            <p className="mt-1 font-mono font-bold text-slate-100">{formatMoney(expense.converted_amount, baseCurrency)}</p>
          </div>
          <div className="rounded-xl bg-[#121418] px-3 py-2">
            <p className="text-slate-500">{memberName}'s share</p>
            <p className="mt-1 font-mono font-bold text-slate-100">
              {split ? formatMoney(shareAmount, baseCurrency) : '--'}
            </p>
          </div>
        </div>

        {hasServiceFee && (
          <p className="mt-2 text-[10px] text-slate-500">
            Includes {expense.fee_percent ?? 0}% service fee
            {split ? ` · Fee share: ${formatMoney(feeShare, baseCurrency)}` : ''}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close member breakdown"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-slate-800 bg-[#121418] shadow-2xl animate-slide-up md:max-w-4xl md:rounded-[28px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar member={member} size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Member breakdown
              </p>
              <h2 id={headingId} className="truncate text-lg font-bold text-white font-display">
                {memberName}{member.id === currentMember.id ? ' (You)' : ''}
              </h2>
              <p id={descriptionId} className="sr-only">
                Review this member's balances, settlements, and expense activity.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close member breakdown"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <MetricCard label="Paid" amount={memberMetrics.totalPaid} icon={<Wallet className="w-4 h-4" />} />
            <MetricCard label="Share" amount={memberMetrics.totalShare} icon={<Scale className="w-4 h-4" />} />
            <MetricCard
              label="Open balance"
              amount={memberMetrics.openBalance}
              icon={<Receipt className="w-4 h-4" />}
              tone={memberMetrics.openBalance > 0.01 ? 'text-emerald-300' : memberMetrics.openBalance < -0.01 ? 'text-rose-300' : 'text-slate-100'}
            />
            <MetricCard label="Fee share" amount={memberMetrics.serviceFeeShare} icon={<Receipt className="w-4 h-4" />} />
          </div>

          <section className="rounded-2xl border border-slate-800 bg-[#1a1d23] p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
              Paid settlements
            </p>
            {memberMetrics.settlements.sent === 0 && memberMetrics.settlements.received === 0 ? (
              <p className="text-xs text-slate-500">No settlements recorded for this member.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#121418] px-3 py-2">
                  <p className="flex items-center gap-1 text-[10px] text-slate-500">
                    <ArrowUpRight className="w-3 h-3 text-rose-300" />
                    Sent
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-100">
                    {formatMoney(memberMetrics.settlements.sent, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#121418] px-3 py-2">
                  <p className="flex items-center gap-1 text-[10px] text-slate-500">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-300" />
                    Received
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-100">
                    {formatMoney(memberMetrics.settlements.received, baseCurrency)}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <SpendingDonutChart
              slices={chartSlices}
              currency={baseCurrency}
              emptyLabel={chartEmptyText}
              selectedSliceId={selectedCategoryId}
              onSelectSlice={handleCategorySelection}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0" aria-live="polite">
                <h3 className="truncate text-sm font-bold text-slate-100">
                  {selectedCategory ? `${selectedCategory.label} expenses` : 'Expenses'}
                </h3>
                <span className="text-[10px] font-mono text-slate-500">
                  {selectedCategory ? `${listItems.length} shown · ` : ''}{paidExpenseCount} paid · {sharedExpenseCount} shared
                </span>
              </div>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className="min-h-9 cursor-pointer rounded-full border px-3 text-[10px] font-bold"
                  style={{
                    backgroundColor: selectedCategory.palette.surface,
                    borderColor: selectedCategory.palette.border,
                    color: selectedCategory.palette.foreground,
                  }}
                  aria-label={`Clear ${selectedCategory.label} category filter`}
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-[#1a1d23] p-1">
              <button
                type="button"
                onClick={() => handleExpenseListModeChange('paid')}
                aria-pressed={expenseListMode === 'paid'}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  expenseListMode === 'paid' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => handleExpenseListModeChange('shared')}
                aria-pressed={expenseListMode === 'shared'}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  expenseListMode === 'shared' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Shared
              </button>
            </div>

            {listItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-[#1a1d23] px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  {selectedCategory
                    ? `No ${selectedCategory.label.toLocaleLowerCase()} expenses in this view.`
                    : listEmptyText}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {listItems.map(item => (
                  <ExpenseRow key={`${expenseListMode}-${item.expense.id}`} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};
