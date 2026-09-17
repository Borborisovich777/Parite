import type { Expense, Settlement } from '../types';

/** A calendar date is never converted through UTC. */
export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const isValidExpenseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value;
};

export const formatExpenseDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// Matches the existing update RPC: creation time, never the purchase date,
// determines whether a recorded repayment protects an expense.
export const blockingSettlements = (expense: Expense, settlements: Settlement[]) =>
  settlements.filter(s => s.status === 'paid' &&
    Date.parse(s.paid_at ?? s.created_at) >= Date.parse(expense.created_at));

export const splitAllocationMessage = (remaining: number, currency: string) =>
  remaining < 0
    ? `Reduce shares by ${currency} ${Math.abs(remaining).toFixed(2)}`
    : `Assign the remaining ${currency} ${remaining.toFixed(2)}`;
