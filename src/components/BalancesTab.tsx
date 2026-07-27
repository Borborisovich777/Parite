import React, { useState } from 'react';
import { Trip, Member, Expense, ExpenseSplit, Settlement, ExchangeRate } from '../types';
import { calculateOpenMemberBalances, calculateSettlementRecommendations } from '../lib/calculations';
import { formatDisplayMoney, getMemberDisplayCurrency } from '../lib/exchangeRates';
import { CheckCircle2, Clock, History, RotateCcw, Scale } from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';

interface BalancesTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  exchangeRates?: ExchangeRate[];
  members: Member[];
  settlements: Settlement[];
  onMarkSettlementPaid: (fromMemberId: string, toMemberId: string, amount: number) => void | Promise<void>;
  onVoidSettlement: (settlementId: string, reason: string) => void | Promise<void>;
  onViewMemberBreakdown: (memberId: string) => void;
}

export const BalancesTab: React.FC<BalancesTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  exchangeRates = [],
  members,
  settlements,
  onMarkSettlementPaid,
  onVoidSettlement,
  onViewMemberBreakdown,
}) => {
  const approvedMembers = members.filter(member => member.status === 'approved');
  const [activeSubTab, setActiveSubTab] = useState<'recommendations' | 'history'>('recommendations');
  const [busySettlementKey, setBusySettlementKey] = useState<string | null>(null);

  const balances = calculateOpenMemberBalances(expenses, splits, settlements, approvedMembers);
  const recommendations = calculateSettlementRecommendations(balances, settlements, trip.base_currency);
  const settlementHistoryList = settlements.filter(settlement =>
    settlement.status === 'paid' || settlement.status === 'voided'
  );
  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
  const isTripClosed = (trip.status ?? 'active') === 'closed';
  const currentBalance = balances.find(balance => balance.member_id === currentMember.id);
  const currentNetBalance = currentBalance?.net_balance ?? 0;
  const currentBalanceDisplay = formatDisplayMoney(
    Math.abs(currentNetBalance),
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id
  );
  const currentBalanceLabel = currentNetBalance > 0.01
    ? 'You are owed'
    : currentNetBalance < -0.01
      ? 'You owe'
      : 'You are all settled up';

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-5 animate-fade-in md:px-6 md:pb-6 lg:px-8">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
          {trip.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold font-display text-[var(--color-text)] tracking-tight">
          Balances
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
          See what everyone covered and settle up in the fewest transfers.
        </p>
      </div>

      <section className="header-wash flex items-center justify-between gap-4 rounded-3xl border border-[var(--color-border)] px-4 py-4 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[var(--color-positive)] shadow-sm">
            <Scale className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${
              currentNetBalance < -0.01 ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive)]'
            }`}>
              {currentBalanceLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              Across {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-xl font-bold tabular-nums ${
            currentNetBalance < -0.01 ? 'text-[var(--color-negative)]' : 'text-[var(--color-text)]'
          }`}>
            {currentBalanceDisplay.primary}
          </p>
          {currentBalanceDisplay.secondary && (
            <p className="mt-0.5 text-[10px] font-mono text-[var(--color-muted)]">
              {currentBalanceDisplay.secondary}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <section className="parite-card p-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">Everyone's balance</h2>
              <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Tap a person for their breakdown</p>
            </div>
            <span className="rounded-full border border-[var(--color-positive)]/15 bg-[var(--color-positive-soft)] px-2.5 py-1 text-[10px] font-mono font-bold text-[var(--color-positive)]">
              {trip.base_currency}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {balances.map(balance => {
            const isMe = balance.member_id === currentMember.id;
            const balanceMember = members.find(member => member.id === balance.member_id);
            const isPositive = balance.net_balance > 0.01;
            const isNegative = balance.net_balance < -0.01;
            const balanceDisplay = formatDisplayMoney(
              Math.abs(balance.net_balance),
              trip.base_currency,
              displayCurrency,
              exchangeRates,
              trip.id
            );

            return (
              <button
                type="button"
                key={balance.member_id}
                id={`balance-row-${balance.member_id}`}
                onClick={() => onViewMemberBreakdown(balance.member_id)}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left cursor-pointer transition-colors ${
                  isMe
                    ? 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)]'
                    : 'border-transparent bg-[var(--color-surface-soft)] hover:border-[var(--color-border)]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar member={balanceMember} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--color-text)]">
                      {balance.display_name}{isMe ? ' (You)' : ''}
                    </p>
                    <p className="mt-1 text-[10px] font-mono text-[var(--color-muted)]">
                      Paid {balance.total_paid.toFixed(2)} · Share {balance.total_owed.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={`mb-1 text-[9px] font-bold uppercase tracking-wide ${
                    isPositive
                      ? 'text-[var(--color-positive)]'
                      : isNegative
                        ? 'text-[var(--color-negative)]'
                        : 'text-[var(--color-muted)]'
                  }`}>
                    {isPositive ? 'Gets back' : isNegative ? 'Owes' : 'Settled'}
                  </p>
                  <div
                    id={`member-net-balance-${balance.member_id}`}
                    className={`font-mono text-sm font-bold tabular-nums ${
                      isPositive
                        ? 'text-[var(--color-positive)]'
                        : isNegative
                        ? 'text-[var(--color-negative)]'
                        : 'text-[var(--color-muted)]'
                    }`}
                  >
                    {balanceDisplay.primary}
                    {balanceDisplay.secondary && (
                      <span className="block text-[9px] font-mono font-medium opacity-70 mt-0.5">
                        {balanceDisplay.secondary}
                      </span>
                    )}
                  </div>
                  {balanceDisplay.helper && (
                    <p className="mt-1 max-w-[8rem] text-[10px] text-[var(--color-muted)]">
                      {balanceDisplay.helper}
                    </p>
                  )}
                </div>
              </button>
            );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1"
            role="tablist"
            aria-label="Settlement views"
          >
        <button
          type="button"
          id="btn-settlement-recommendations-tab"
          role="tab"
          aria-selected={activeSubTab === 'recommendations'}
          aria-controls="settlement-recommendations-panel"
          onClick={() => setActiveSubTab('recommendations')}
          className={`min-h-11 rounded-xl px-2 text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'recommendations'
              ? 'bg-white text-[var(--color-positive)] shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          To settle
          {recommendations.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--color-negative)] px-1.5 text-[9px] text-[#fff]">
              {recommendations.length}
            </span>
          )}
        </button>
        <button
          type="button"
          id="btn-settlement-history-tab"
          role="tab"
          aria-selected={activeSubTab === 'history'}
          aria-controls="settlement-history-panel"
          onClick={() => setActiveSubTab('history')}
          className={`min-h-11 rounded-xl px-2 text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-white text-[var(--color-positive)] shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Settlement history
          {settlementHistoryList.length > 0 && (
            <span className="ml-1.5 rounded-full bg-white px-1.5 text-[9px] text-[var(--color-muted)]">
              {settlementHistoryList.length}
            </span>
          )}
        </button>
          </div>

          {activeSubTab === 'recommendations' ? (
        <section
          id="settlement-recommendations-panel"
          role="tabpanel"
          aria-labelledby="btn-settlement-recommendations-tab"
          className="flex flex-col gap-2"
        >
          {recommendations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] px-4 py-12 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[var(--color-positive)] shadow-sm">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-[var(--color-positive)]">All settled up</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                No settlement transfers are needed right now.
              </p>
            </div>
          ) : (
            recommendations.map((recommendation, index) => {
              const isAdmin = currentMember.role === 'admin';
              const isReceiver = currentMember.id === recommendation.to_member_id;
              const canConfirmSettlement = !isTripClosed && (isAdmin || isReceiver);
              const confirmLabel = isReceiver && !isAdmin ? 'Confirm received' : 'Mark as paid';
              const settlementKey = `${recommendation.from_member_id}-${recommendation.to_member_id}-${index}`;
              const fromMember = members.find(member => member.id === recommendation.from_member_id);
              const toMember = members.find(member => member.id === recommendation.to_member_id);
              const recommendationDisplay = formatDisplayMoney(
                recommendation.amount,
                trip.base_currency,
                displayCurrency,
                exchangeRates,
                trip.id
              );

              return (
                <div
                  key={settlementKey}
                  id={`recommendation-card-${index}`}
                  className="parite-card flex flex-col gap-3 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 -space-x-2">
                        <MemberAvatar member={fromMember} size="sm" className="ring-2 ring-white" />
                        <MemberAvatar member={toMember} size="sm" className="ring-2 ring-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed text-[var(--color-text)]">
                          <strong className="text-[var(--color-negative)]">{recommendation.from_display_name}</strong>
                          {' pays '}
                          <strong className="text-[var(--color-positive)]">{recommendation.to_display_name}</strong>
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                          Recommended settlement
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-bold text-[var(--color-text)] tabular-nums">
                        {recommendationDisplay.primary}
                      </p>
                      {recommendationDisplay.secondary ? (
                        <p className="mt-0.5 text-[10px] font-mono text-[var(--color-muted)]">
                          {recommendationDisplay.secondary}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] font-mono text-[var(--color-muted)]">
                          {recommendation.currency}
                        </p>
                      )}
                      {recommendationDisplay.helper && (
                        <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                          {recommendationDisplay.helper}
                        </p>
                      )}
                    </div>
                  </div>

                  {canConfirmSettlement ? (
                    <button
                      type="button"
                      id={`btn-settle-${recommendation.from_member_id}-${recommendation.to_member_id}`}
                      onClick={async () => {
                        setBusySettlementKey(settlementKey);
                        try {
                          await onMarkSettlementPaid(
                            recommendation.from_member_id,
                            recommendation.to_member_id,
                            recommendation.amount
                          );
                        } catch (error) {
                          console.error(error);
                        } finally {
                          setBusySettlementKey(null);
                        }
                      }}
                      disabled={busySettlementKey === settlementKey}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {busySettlementKey === settlementKey ? 'Confirming...' : confirmLabel}
                    </button>
                  ) : (
                    <p className="rounded-2xl bg-[var(--color-surface-soft)] px-3 py-2.5 text-xs leading-normal text-[var(--color-muted)]">
                    The receiver or a group admin can confirm this settlement after the transfer is complete.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      ) : (
        <section
          id="settlement-history-panel"
          role="tabpanel"
          aria-labelledby="btn-settlement-history-tab"
          className="flex flex-col gap-2"
        >
          {settlementHistoryList.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-4 py-12 text-center">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface-soft)] text-[var(--color-muted)]">
                <History className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)]">No settlement history yet</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Paid and voided transfers will appear here.</p>
            </div>
          ) : (
            [...settlementHistoryList]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(settlement => {
                const fromMember = members.find(member => member.id === settlement.from_member_id);
                const toMember = members.find(member => member.id === settlement.to_member_id);
                const isVoided = settlement.status === 'voided';
                const canVoidSettlement = !isTripClosed
                  && settlement.status === 'paid'
                  && (currentMember.role === 'admin' || currentMember.id === settlement.to_member_id);
                const settlementDisplay = formatDisplayMoney(
                  settlement.amount,
                  trip.base_currency,
                  displayCurrency,
                  exchangeRates,
                  trip.id
                );

                return (
                  <div
                    key={settlement.id}
                    id={`historic-settlement-${settlement.id}`}
                    className="parite-card flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex shrink-0 -space-x-2">
                          <MemberAvatar member={fromMember} size="sm" className="ring-2 ring-white" />
                          <MemberAvatar member={toMember} size="sm" className="ring-2 ring-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm leading-relaxed text-[var(--color-text)]">
                            <strong>{fromMember ? fromMember.display_name : 'Removed member'}</strong>
                            {' paid '}
                            <strong>{toMember ? toMember.display_name : 'Removed member'}</strong>
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[var(--color-muted)]">
                            <Clock className="w-3 h-3" />
                            {settlement.paid_at ? new Date(settlement.paid_at).toLocaleDateString() : 'No date'}
                          </p>
                          {isVoided && (
                            <p className="mt-1 text-[10px] text-[var(--color-negative)]">
                              Voided{settlement.void_reason ? `: ${settlement.void_reason}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className={`text-right font-mono font-bold text-xs shrink-0 ${
                        isVoided ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-positive)]'
                      }`}>
                        {settlementDisplay.primary}
                        {settlementDisplay.secondary && (
                          <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                            {settlementDisplay.secondary}
                          </span>
                        )}
                        {isVoided && (
                          <span className="mt-1 block text-[10px] text-[var(--color-negative)] no-underline">
                            Voided
                          </span>
                        )}
                      </div>
                    </div>

                    {canVoidSettlement && (
                      <button
                        type="button"
                        id={`btn-void-settlement-${settlement.id}`}
                        onClick={async () => {
                          setBusySettlementKey(`void-${settlement.id}`);
                          try {
                            await onVoidSettlement(
                              settlement.id,
                              'Voided before changing related expenses.'
                            );
                          } catch (error) {
                            console.error(error);
                          } finally {
                            setBusySettlementKey(null);
                          }
                        }}
                        disabled={busySettlementKey === `void-${settlement.id}`}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] text-xs font-bold text-[var(--color-negative)] cursor-pointer disabled:opacity-60"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {busySettlementKey === `void-${settlement.id}` ? 'Voiding...' : 'Void settlement'}
                      </button>
                    )}
                  </div>
                );
              })
          )}
        </section>
          )}
        </div>
      </div>
    </div>
  );
};
