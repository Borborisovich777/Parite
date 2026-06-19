import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Receipt, Scale, Wallet, X } from 'lucide-react';
import { ExchangeRate, Expense, ExpenseSplit, Member, Settlement, Trip } from '../types';
import { calculateOpenMemberBalances } from '../lib/calculations';
import { formatDisplayMoney, formatMoney, getMemberDisplayCurrency } from '../lib/exchangeRates';
import {
  buildTopSlices,
  getMemberPaidExpenseSlices,
  getMemberRelevantExpenses,
  getMemberServiceFeeShare,
  getMemberSettlementTotals,
  getMemberShareExpenseSlices,
  getMemberTotalPaid,
  getMemberTotalShare,
  MemberExpenseInsight,
} from '../lib/memberInsights';
import { SpendingDonutChart } from './SpendingDonutChart';

type ChartMode = 'paid' | 'share';
type ExpenseListMode = 'paid' | 'shared';

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
  const [chartMode, setChartMode] = useState<ChartMode>('paid');
  const [expenseListMode, setExpenseListMode] = useState<ExpenseListMode>('paid');
  const baseCurrency = trip.base_currency;
  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);

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

  const chartSlices = useMemo(() => {
    if (!member) return [];
    const slices = chartMode === 'paid'
      ? getMemberPaidExpenseSlices(member.id, expenses)
      : getMemberShareExpenseSlices(member.id, expenses, splits);

    return buildTopSlices(slices, 5);
  }, [chartMode, expenses, member, splits]);

  const relevantExpenses = useMemo(() => {
    if (!member) return { paid: [], shared: [] };
    return getMemberRelevantExpenses(member.id, expenses, splits);
  }, [expenses, member, splits]);

  if (!isOpen || !member || !memberMetrics) return null;

  const memberName = member.display_name;
  const memberInitial = memberName.charAt(0).toUpperCase();
  const paidExpenseCount = relevantExpenses.paid.length;
  const sharedExpenseCount = relevantExpenses.shared.length;
  const listItems = expenseListMode === 'paid' ? relevantExpenses.paid : relevantExpenses.shared;
  const listEmptyText = expenseListMode === 'paid'
    ? 'This member has not paid for any expenses yet.'
    : 'This member has no shared expense splits yet.';
  const chartEmptyText = 'No spending data yet.';

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
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">{expense.title}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Paid by {findMemberName(expense.paid_by_member_id)} · {new Date(expense.expense_date).toLocaleDateString()}
            </p>
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
    <div className="fixed inset-0 z-[60] flex max-w-md mx-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close member breakdown"
        onClick={onClose}
      />

      <section className="relative z-10 mt-auto flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-slate-800 bg-[#121418] shadow-2xl animate-slide-up">
        <div className="border-b border-slate-800 px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/15 text-base font-bold uppercase text-indigo-200">
              {memberInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Member breakdown
              </p>
              <h2 className="truncate text-lg font-bold text-white font-display">
                {memberName}{member.id === currentMember.id ? ' (You)' : ''}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close member breakdown"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
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

          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-[#1a1d23] p-1">
              <button
                type="button"
                onClick={() => setChartMode('paid')}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  chartMode === 'paid' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Paid by them
              </button>
              <button
                type="button"
                onClick={() => setChartMode('share')}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  chartMode === 'share' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Their share
              </button>
            </div>

            <SpendingDonutChart
              slices={chartSlices}
              currency={baseCurrency}
              emptyLabel={chartEmptyText}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-100">Expenses</h3>
              <span className="text-[10px] font-mono text-slate-500">
                {paidExpenseCount} paid · {sharedExpenseCount} shared
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-[#1a1d23] p-1">
              <button
                type="button"
                onClick={() => setExpenseListMode('paid')}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  expenseListMode === 'paid' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setExpenseListMode('shared')}
                className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                  expenseListMode === 'shared' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Shared
              </button>
            </div>

            {listItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-[#1a1d23] px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-400">{listEmptyText}</p>
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
