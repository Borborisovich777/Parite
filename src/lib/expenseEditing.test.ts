import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockingSettlements, formatExpenseDate, isValidExpenseDate, localDateKey, splitAllocationMessage } from './expenseEditing';
import { calculateSmartCustomSplitsWithFee, calculateOpenMemberBalances } from './calculations';
import { getMemberSettlementTotals } from './memberInsights';
import type { Expense, Settlement, Member, ExpenseSplit } from '../types';

test('calendar dates stay local at timezone boundaries and through formatting', () => {
  const original = process.env.TZ;
  try {
    for (const [tz, instant, expected] of [
      ['Asia/Dubai', '2026-09-16T21:00:00Z', '2026-09-17'],
      ['America/Los_Angeles', '2026-09-17T01:00:00Z', '2026-09-16'],
      ['Pacific/Kiritimati', '2026-09-16T11:00:00Z', '2026-09-17'],
    ]) {
      process.env.TZ = tz;
      assert.equal(localDateKey(new Date(instant)), expected);
      assert.match(formatExpenseDate('2026-09-10'), /10/);
      assert.ok(isValidExpenseDate('2024-02-29'));
      assert.equal(isValidExpenseDate('2026-02-29'), false);
      assert.equal(isValidExpenseDate('2026-13-10'), false);
      assert.equal(isValidExpenseDate('09/10/2026'), false);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('equal pennies, automatic remainder, custom under/over allocation and fees', () => {
  const split = (manualSubtotalAmounts = {}, total = 30, final = total) => calculateSmartCustomSplitsWithFee({
    subtotalBaseAmount: total, finalBaseAmount: final, participantIds: ['a', 'b'], manualSubtotalAmounts,
  });
  assert.deepEqual(split().splits.map(s => s.amount_owed), [15,15]);
  assert.equal(split({}, 30.01).splits.reduce((sum, s) => sum+Math.round(s.amount_owed*100), 0),3001);
  assert.deepEqual(split({a:'10'}).splits.map(s => s.amount_owed), [10,20]);
  assert.equal(split({a:'10',b:'19'}).isValid, false);
  assert.equal(split({a:'10',b:'21'}).isValid, false);
  assert.equal(splitAllocationMessage(1,'AED'), 'Assign the remaining AED 1.00');
  assert.equal(splitAllocationMessage(-1,'AED'), 'Reduce shares by AED 1.00');
  assert.deepEqual(split({a:'10',b:'20'},30,33).splits.map(s => s.amount_owed), [11,22]);
});

test('settlement protection uses creation time, not a corrected purchase date', () => {
  const expense = {created_at:'2026-09-17T10:00:00Z',expense_date:'2026-09-01'} as Expense;
  const paid = {id:'s',status:'paid',created_at:'2026-09-17T11:00:00Z'} as Settlement;
  assert.equal(blockingSettlements(expense,[paid]).length,1);
  assert.equal(blockingSettlements({...expense,expense_date:'2026-09-30'},[paid]).length,1);
  assert.equal(blockingSettlements(expense,[{...paid,status:'voided'}]).length,0);
  assert.equal(blockingSettlements({...expense,created_at:'2026-09-17T12:00:00Z'},[paid]).length,0);
});

test('balance explanation reconciles paid, share, repayments sent and received', () => {
  const expenses = [{id:'e',paid_by_member_id:'a',converted_amount:100}] as Expense[];
  const splits = [{expense_id:'e',member_id:'a',amount_owed:80},{expense_id:'e',member_id:'b',amount_owed:20}] as ExpenseSplit[];
  const settlements = [{status:'paid',from_member_id:'b',to_member_id:'a',amount:30}] as Settlement[];
  const totals = getMemberSettlementTotals('a',settlements);
  const balance = calculateOpenMemberBalances(expenses,splits,settlements,[{id:'a',display_name:'A'}] as Member[])[0];
  assert.equal(balance.net_balance, -10);
  assert.equal(100-80+totals.sent-totals.received,balance.net_balance);
});
