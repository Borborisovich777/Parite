import React, { useState } from 'react';
import { Trip, Member, Expense, ExpenseSplit, Settlement, Currency } from '../types';
import { calculateMemberBalances, calculateSettlementRecommendations } from '../lib/calculations';
import { CheckCircle2, Clock, History, Scale } from 'lucide-react';

interface BalancesTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  members: Member[];
  settlements: Settlement[];
  onMarkSettlementPaid: (fromMemberId: string, toMemberId: string, amount: number, currency: Currency) => void | Promise<void>;
}

export const BalancesTab: React.FC<BalancesTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  members,
  settlements,
  onMarkSettlementPaid,
}) => {
  const approvedMembers = members.filter(member => member.status === 'approved');
  const [activeSubTab, setActiveSubTab] = useState<'recommendations' | 'history'>('recommendations');
  const [busySettlementKey, setBusySettlementKey] = useState<string | null>(null);

  const balances = calculateMemberBalances(expenses, splits, approvedMembers);
  const recommendations = calculateSettlementRecommendations(balances, settlements, trip.base_currency);
  const paidSettlementsList = settlements.filter(settlement => settlement.status === 'paid');

  return (
    <div className="flex flex-col gap-4 pb-24 animate-fade-in px-4 pt-4">
      <div>
        <h1 className="text-xl font-bold font-display text-white tracking-tight">
          Balances
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Who paid, who owes, and the simplest way to settle.
        </p>
      </div>

      <section className="bg-[#1a1d23] border border-slate-800 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-100">Member balances</h2>
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-1">
            {trip.base_currency}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {balances.map(balance => {
            const isMe = balance.member_id === currentMember.id;
            const isPositive = balance.net_balance > 0.01;
            const isNegative = balance.net_balance < -0.01;

            return (
              <div
                key={balance.member_id}
                id={`balance-row-${balance.member_id}`}
                className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${
                  isMe ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-[#121418] border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {balance.display_name}{isMe ? ' (You)' : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Paid {balance.total_paid.toFixed(2)} / share {balance.total_owed.toFixed(2)}
                  </p>
                </div>

                <div
                  id={`member-net-balance-${balance.member_id}`}
                  className={`font-mono text-xs font-bold px-2.5 py-1.5 rounded-xl shrink-0 ${
                    isPositive
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : isNegative
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {balance.net_balance.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1.5 bg-[#1a1d23] border border-slate-800 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('recommendations')}
          className={`min-h-11 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'recommendations'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          To settle
          {recommendations.length > 0 && (
            <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1.5 rounded-full">
              {recommendations.length}
            </span>
          )}
        </button>
        <button
          type="button"
          id="btn-settlement-history-tab"
          onClick={() => setActiveSubTab('history')}
          className={`min-h-11 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Paid log
          {paidSettlementsList.length > 0 && (
            <span className="ml-1.5 bg-slate-700 text-slate-100 text-[9px] px-1.5 rounded-full">
              {paidSettlementsList.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'recommendations' ? (
        <section className="flex flex-col gap-2">
          {recommendations.length === 0 ? (
            <div className="text-center py-12 px-4 bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-3xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-emerald-300">All settled up</p>
              <p className="text-xs text-slate-500 mt-1">
                No settlement transfers are needed right now.
              </p>
            </div>
          ) : (
            recommendations.map((recommendation, index) => {
              const isAdmin = currentMember.role === 'admin';
              const settlementKey = `${recommendation.from_member_id}-${recommendation.to_member_id}-${index}`;

              return (
                <div
                  key={settlementKey}
                  id={`recommendation-card-${index}`}
                  className="bg-[#1a1d23] border border-slate-800 rounded-3xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 leading-relaxed">
                        <strong className="text-rose-300">{recommendation.from_display_name}</strong>
                        {' pays '}
                        <strong className="text-emerald-300">{recommendation.to_display_name}</strong>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Recommended settlement
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-bold text-white">
                        {recommendation.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {recommendation.currency}
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      id={`btn-settle-${recommendation.from_member_id}-${recommendation.to_member_id}`}
                      onClick={async () => {
                        setBusySettlementKey(settlementKey);
                        try {
                          await onMarkSettlementPaid(
                            recommendation.from_member_id,
                            recommendation.to_member_id,
                            recommendation.amount,
                            recommendation.currency
                          );
                        } catch (error) {
                          console.error(error);
                        } finally {
                          setBusySettlementKey(null);
                        }
                      }}
                      disabled={busySettlementKey === settlementKey}
                      className="min-h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs px-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {busySettlementKey === settlementKey ? 'Saving...' : 'Mark as paid'}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 leading-normal">
                      Admins can mark settlements as paid after the transfer is complete.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          {paidSettlementsList.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl bg-[#1a1d23]">
              <History className="w-9 h-9 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-semibold">No paid settlements yet</p>
              <p className="text-xs text-slate-500 mt-1">Paid transfers will appear here.</p>
            </div>
          ) : (
            [...paidSettlementsList]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(settlement => {
                const fromMember = approvedMembers.find(member => member.id === settlement.from_member_id);
                const toMember = approvedMembers.find(member => member.id === settlement.to_member_id);

                return (
                  <div
                    key={settlement.id}
                    id={`historic-settlement-${settlement.id}`}
                    className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 leading-relaxed">
                        <strong>{fromMember ? fromMember.display_name : 'Removed member'}</strong>
                        {' paid '}
                        <strong>{toMember ? toMember.display_name : 'Removed member'}</strong>
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {settlement.paid_at ? new Date(settlement.paid_at).toLocaleDateString() : 'No date'}
                      </p>
                    </div>

                    <div className="text-right font-mono font-bold text-xs shrink-0 text-emerald-300">
                      {settlement.amount.toFixed(2)} {settlement.currency}
                    </div>
                  </div>
                );
              })
          )}
        </section>
      )}
    </div>
  );
};
