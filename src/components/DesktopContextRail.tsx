import React, { useId, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  LockKeyhole,
  ReceiptText,
  Scale,
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
  TripStatus,
} from '../types';
import { calculateOpenMemberBalances } from '../lib/calculations';
import {
  formatDisplayMoney,
  getMemberDisplayCurrency,
} from '../lib/exchangeRates';

export interface DesktopContextRailProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  members: Member[];
  exchangeRates?: ExchangeRate[];
  pendingRequestsCount: number;
  onReviewBalances: () => void;
  onManageMembers: () => void;
}

const statusDetails: Record<TripStatus, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = {
  active: {
    label: 'Active',
    description: 'Expenses can be added',
    icon: CheckCircle2,
    tone: 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] text-[var(--color-positive)]',
  },
  closing: {
    label: 'Closing',
    description: 'Closeout in progress',
    icon: Clock3,
    tone: 'border-[var(--color-positive)]/20 bg-[var(--color-blue-wash)] text-[var(--color-positive)]',
  },
  closed: {
    label: 'Closed',
    description: 'Group is read-only',
    icon: LockKeyhole,
    tone: 'border-[var(--color-negative)]/20 bg-[var(--color-negative-soft)] text-[var(--color-negative)]',
  },
};

export const DesktopContextRail: React.FC<DesktopContextRailProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  settlements,
  members,
  exchangeRates = [],
  pendingRequestsCount,
  onReviewBalances,
  onManageMembers,
}) => {
  const headingId = useId();
  const approvedMembers = useMemo(
    () => members.filter(member => (
      member.trip_id === trip.id
      && member.status === 'approved'
    )),
    [members, trip.id],
  );
  const balances = useMemo(
    () => calculateOpenMemberBalances(
      expenses,
      splits,
      settlements,
      approvedMembers,
    ),
    [approvedMembers, expenses, settlements, splits],
  );
  const groupSpend = useMemo(
    () => expenses.reduce(
      (total, expense) => total + (
        Number.isFinite(expense.converted_amount)
          ? expense.converted_amount
          : 0
      ),
      0,
    ),
    [expenses],
  );

  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
  const currentNetBalance = balances.find(
    balance => balance.member_id === currentMember.id,
  )?.net_balance ?? 0;
  const currentPosition = formatDisplayMoney(
    Math.abs(currentNetBalance),
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id,
  );
  const groupSpendDisplay = formatDisplayMoney(
    groupSpend,
    trip.base_currency,
    displayCurrency,
    exchangeRates,
    trip.id,
  );
  const positionLabel = currentNetBalance > 0.01
    ? 'You are owed'
    : currentNetBalance < -0.01
      ? 'You owe'
      : 'You are settled up';
  const positionTone = currentNetBalance < -0.01
    ? 'text-[var(--color-negative)]'
    : currentNetBalance > 0.01
      ? 'text-[var(--color-positive)]'
      : 'text-[var(--color-text)]';
  const safePendingRequestsCount = Number.isFinite(pendingRequestsCount)
    ? Math.max(0, Math.floor(pendingRequestsCount))
    : 0;
  const tripStatus = trip.status ?? 'active';
  const status = statusDetails[tripStatus];
  const StatusIcon = status.icon;

  return (
    <aside
      className="sticky top-5 hidden w-[17.5rem] shrink-0 self-start flex-col gap-4 xl:flex"
      aria-labelledby={headingId}
    >
      <section className="header-wash overflow-hidden rounded-3xl border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
              Current group
            </p>
            <h2
              id={headingId}
              className="mt-1 truncate font-display text-lg font-bold text-[var(--color-text)]"
            >
              {trip.name}
            </h2>
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              {status.description}
            </p>
          </div>
          <span
            className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${status.tone}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <p className={`text-xs font-bold ${positionTone}`}>{positionLabel}</p>
          </div>
          <p className={`mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums ${positionTone}`}>
            {currentPosition.primary}
          </p>
          {currentPosition.secondary && (
            <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">
              {currentPosition.secondary}
            </p>
          )}
          {currentPosition.helper && (
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-muted)]">
              {currentPosition.helper}
            </p>
          )}
        </div>
      </section>

      <section
        className="parite-card p-4"
        aria-labelledby="desktop-context-group-snapshot"
      >
        <div className="flex items-center gap-2">
          <ReceiptText
            className="h-4 w-4 text-[var(--color-positive)]"
            aria-hidden="true"
          />
          <h3
            id="desktop-context-group-snapshot"
            className="font-display text-sm font-bold text-[var(--color-text)]"
          >
            Group snapshot
          </h3>
        </div>

        <dl className="mt-4 divide-y divide-[var(--color-border)]">
          <div className="flex items-start justify-between gap-4 pb-3">
            <dt className="text-[11px] text-[var(--color-muted)]">Total spend</dt>
            <dd className="text-right">
              <p className="font-mono text-xs font-bold tabular-nums text-[var(--color-text)]">
                {groupSpendDisplay.primary}
              </p>
              {groupSpendDisplay.secondary && (
                <p className="mt-0.5 font-mono text-[9px] text-[var(--color-muted)]">
                  {groupSpendDisplay.secondary}
                </p>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[11px] text-[var(--color-muted)]">Expenses</dt>
            <dd className="font-mono text-xs font-bold tabular-nums text-[var(--color-text)]">
              {expenses.length}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 pt-3">
            <dt className="text-[11px] text-[var(--color-muted)]">Active members</dt>
            <dd className="font-mono text-xs font-bold tabular-nums text-[var(--color-text)]">
              {approvedMembers.length}
            </dd>
          </div>
        </dl>
      </section>

      <nav
        className="parite-card p-3"
        aria-label="Expense workspace shortcuts"
      >
        <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Shortcuts
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            id="btn-desktop-context-balances"
            onClick={onReviewBalances}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-[var(--color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-positive)] cursor-pointer"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
              <Scale className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[var(--color-text)]">
                Review balances
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                See open positions
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            id="btn-desktop-context-members"
            onClick={onManageMembers}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-[var(--color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-positive)] cursor-pointer"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-soft)] text-[var(--color-positive)]">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[var(--color-text)]">
                Members
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                {safePendingRequestsCount > 0
                  ? `${safePendingRequestsCount} waiting for review`
                  : 'View people in this group'}
              </span>
            </span>
            {safePendingRequestsCount > 0 ? (
              <span
                className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-negative)] px-1.5 font-mono text-[9px] font-bold text-white"
                aria-label={`${safePendingRequestsCount} pending member ${
                  safePendingRequestsCount === 1 ? 'request' : 'requests'
                }`}
              >
                {safePendingRequestsCount}
              </span>
            ) : (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
};
