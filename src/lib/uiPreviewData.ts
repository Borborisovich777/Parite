import type { PhaseOneWorkspace } from './tripRepository';
import type { Currency, Expense, ExpenseSplit, Member } from '../types';

const tripId = 'ui-preview-trip';

const isoDate = (daysAgo = 0) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

const now = new Date().toISOString();

export const uiPreviewMembers: Member[] = [
  {
    id: 'member-mira',
    user_id: 'preview-user-mira',
    trip_id: tripId,
    display_name: 'Mira',
    role: 'admin',
    status: 'approved',
    display_currency: 'AED',
    created_at: now,
    approved_at: now,
  },
  {
    id: 'member-layla',
    user_id: 'preview-user-layla',
    trip_id: tripId,
    display_name: 'Layla',
    role: 'member',
    status: 'approved',
    display_currency: 'AED',
    created_at: now,
    approved_at: now,
  },
  {
    id: 'member-omar',
    user_id: 'preview-user-omar',
    trip_id: tripId,
    display_name: 'Omar',
    role: 'member',
    status: 'approved',
    display_currency: 'AED',
    created_at: now,
    approved_at: now,
  },
  {
    id: 'member-noor',
    user_id: 'preview-user-noor',
    trip_id: tripId,
    display_name: 'Noor',
    role: 'member',
    status: 'approved',
    display_currency: 'AED',
    created_at: now,
    approved_at: now,
  },
];

interface PreviewExpenseSeed {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  daysAgo: number;
  currency?: Currency;
  exchangeRate?: number;
  notes?: string;
}

const expenseSeeds: PreviewExpenseSeed[] = [
  { id: 'groceries', title: 'Groceries', amount: 220, paidBy: 'member-mira', daysAgo: 0 },
  { id: 'careem', title: 'Careem ride', amount: 84, paidBy: 'member-omar', daysAgo: 0 },
  { id: 'dinner', title: 'Dinner at Orfali', amount: 360, paidBy: 'member-layla', daysAgo: 0, notes: 'Welcome dinner' },
  { id: 'coffee', title: 'Coffee beans', amount: 52, paidBy: 'member-mira', daysAgo: 0 },
  { id: 'hotel', title: 'Hotel stay', amount: 1200, paidBy: 'member-mira', daysAgo: 1 },
  { id: 'museum', title: 'Museum tickets', amount: 180, paidBy: 'member-noor', daysAgo: 1 },
  { id: 'pharmacy', title: 'Pharmacy', amount: 76, paidBy: 'member-layla', daysAgo: 1 },
  { id: 'beach', title: 'Beach umbrellas', amount: 96, paidBy: 'member-noor', daysAgo: 1 },
  { id: 'spotify', title: 'Spotify family', amount: 39.99, paidBy: 'member-omar', daysAgo: 2 },
  { id: 'fuel', title: 'Fuel', amount: 145, paidBy: 'member-mira', daysAgo: 2 },
  { id: 'flight', title: 'Flight tickets', amount: 1940, paidBy: 'member-layla', daysAgo: 3 },
  { id: 'gift', title: 'Gift for Sara', amount: 160, paidBy: 'member-noor', daysAgo: 3 },
];

const buildExpense = (seed: PreviewExpenseSeed): Expense => {
  const currency = seed.currency ?? 'AED';
  const exchangeRate = seed.exchangeRate ?? 1;

  return {
    id: `preview-expense-${seed.id}`,
    trip_id: tripId,
    title: seed.title,
    amount: seed.amount,
    currency,
    exchange_rate_to_base: exchangeRate,
    converted_amount: Math.round(seed.amount * exchangeRate * 100) / 100,
    paid_by_member_id: seed.paidBy,
    expense_date: isoDate(seed.daysAgo),
    notes: seed.notes ?? '',
    created_by_member_id: seed.paidBy,
    created_at: now,
    updated_at: now,
  };
};

export const uiPreviewExpenses = expenseSeeds.map(buildExpense);

export const uiPreviewSplits: ExpenseSplit[] = uiPreviewExpenses.flatMap(expense => {
  const baseShare = Math.floor((expense.converted_amount / uiPreviewMembers.length) * 100) / 100;
  let allocated = 0;

  return uiPreviewMembers.map((member, index) => {
    const isLast = index === uiPreviewMembers.length - 1;
    const amountOwed = isLast
      ? Math.round((expense.converted_amount - allocated) * 100) / 100
      : baseShare;
    allocated += amountOwed;

    return {
      id: `${expense.id}-split-${member.id}`,
      expense_id: expense.id,
      member_id: member.id,
      amount_owed: amountOwed,
      subtotal_amount_owed: amountOwed,
      fee_amount_owed: 0,
    };
  });
});

export const createUiPreviewWorkspace = (): PhaseOneWorkspace => ({
  trip: {
    id: tripId,
    name: 'Weekend in Dubai',
    base_currency: 'AED',
    invite_code: 'PARITE',
    status: 'active',
    created_at: now,
  },
  currentMember: uiPreviewMembers[0],
  members: uiPreviewMembers,
  expenses: uiPreviewExpenses,
  splits: uiPreviewSplits,
  settlements: [],
  exchangeRates: [],
  closureVotes: [],
});
