import React from 'react';
import { Trip, Member, Expense, ExpenseSplit, ExchangeRate } from '../types';
import { calculateMemberBalances } from '../lib/calculations';
import { formatDisplayMoney, getMemberDisplayCurrency } from '../lib/exchangeRates';
import { ArrowRight, Plus, Receipt, Wallet } from 'lucide-react';

interface DashboardTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  exchangeRates?: ExchangeRate[];
  members: Member[];
  onAddExpenseClick: () => void;
  onViewExpense: (expenseId: string) => void;
  onChangeTab: (tab: 'dashboard' | 'expenses' | 'balances' | 'members') => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  exchangeRates = [],
  members,
  onAddExpenseClick,
  onViewExpense,
  onChangeTab,
}) => {
  const approvedMembers = members.filter(m => m.status === 'approved');
  const totalSpending = expenses.reduce((sum, expense) => sum + expense.converted_amount, 0);
  const balances = calculateMemberBalances(expenses, splits, approvedMembers);
  const currentUserBalance = balances.find(balance => balance.member_id === currentMember.id);
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
    .slice(0, 4);

  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
  const userBalanceDisplay = formatDisplayMoney(
    currentUserBalance?.net_balance ?? 0,
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id
  );
  const totalSpendingDisplay = formatDisplayMoney(
    totalSpending,
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id
  );

  const balanceLabel = !currentUserBalance || Math.abs(currentUserBalance.net_balance) <= 0.01
    ? 'Settled up'
    : currentUserBalance.net_balance > 0
    ? 'You are owed'
    : 'You owe';

  return (
    <div className="flex flex-col gap-5 pb-24 animate-fade-in px-4 pt-4">
      <button
        type="button"
        id="btn-add-expense-quick"
        onClick={onAddExpenseClick}
        className="w-full bg-[var(--color-positive)] active:scale-[0.98] text-slate-950 py-4 px-4 rounded-2xl font-bold shadow-lg transition-all text-sm flex items-center justify-center gap-2 cursor-pointer accent-glow"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>Add expense</span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChangeTab('balances')}
          className="bg-[#1a1d23] border border-slate-800/80 p-4 rounded-2xl text-left cursor-pointer hover:border-indigo-500/35 transition-colors"
        >
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
            <span>Your balance</span>
          </div>
          <p
            id="user-net-balance"
            className={`text-xl font-bold font-display leading-none ${
              currentUserBalance && currentUserBalance.net_balance > 0.01
                ? 'text-emerald-400'
                : currentUserBalance && currentUserBalance.net_balance < -0.01
                ? 'text-rose-300'
                : 'text-slate-300'
            }`}
          >
            {currentUserBalance && currentUserBalance.net_balance > 0 ? '+' : ''}
            {userBalanceDisplay.primary}
          </p>
          {userBalanceDisplay.secondary && (
            <p className="text-[10px] text-slate-500 mt-1 font-mono">{userBalanceDisplay.secondary}</p>
          )}
          {userBalanceDisplay.helper && (
            <p className="text-[10px] text-slate-500 mt-1">{userBalanceDisplay.helper}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-2">{balanceLabel}</p>
        </button>

        <div className="bg-[#1a1d23] border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </span>
            <span>Total spent</span>
          </div>
          <p className="text-xl font-bold font-display text-white leading-none">
            {totalSpendingDisplay.primary}
          </p>
          {totalSpendingDisplay.secondary && (
            <p className="text-[10px] text-slate-500 mt-1 font-mono">{totalSpendingDisplay.secondary}</p>
          )}
          {totalSpendingDisplay.helper && (
            <p className="text-[10px] text-slate-500 mt-1">{totalSpendingDisplay.helper}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-2">{expenses.length} expenses</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-100">Recent expenses</h2>
          {expenses.length > 4 && (
            <button
              type="button"
              onClick={() => onChangeTab('expenses')}
              className="text-xs font-semibold text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>See all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentExpenses.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl bg-[#1a1d23]">
            <Receipt className="w-9 h-9 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-semibold">No expenses yet</p>
            <p className="text-xs text-slate-500 mt-1">Add the first shared cost for this trip.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentExpenses.map(expense => {
              const paidBy = approvedMembers.find(m => m.id === expense.paid_by_member_id);
              const displayEquivalent = formatDisplayMoney(
                expense.converted_amount,
                trip.base_currency,
                displayCurrency,
                exchangeRates,
                trip.id
              );
              const showDisplayEquivalent = displayEquivalent.converted && displayEquivalent.currency !== expense.currency;
              return (
                <button
                  type="button"
                  key={expense.id}
                  id={`recent-expense-${expense.id}`}
                  onClick={() => onViewExpense(expense.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#1a1d23] border border-slate-800/75 hover:border-slate-700 text-left cursor-pointer transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-100 truncate block">
                      {expense.title}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block truncate">
                      Paid by {paidBy ? (paidBy.id === currentMember.id ? 'You' : paidBy.display_name) : 'Removed member'} - {expense.expense_date}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="text-sm font-bold font-mono text-slate-100 block">
                      {expense.amount.toFixed(2)} {expense.currency}
                    </span>
                    {expense.currency !== trip.base_currency && (
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        {expense.converted_amount.toFixed(2)} {trip.base_currency}
                      </span>
                    )}
                    {showDisplayEquivalent && (
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        {displayEquivalent.primary}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
