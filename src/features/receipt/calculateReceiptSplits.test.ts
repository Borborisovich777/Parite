import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateConvertedAmount } from '../../lib/calculations';
import {
  allocateEqualMinor,
  allocateProportionalMinor,
  calculateReceiptSplits,
  MAX_EXPENSE_MINOR,
  type ReceiptExtractionResult,
  type ReceiptSplitRequest,
  type ReceiptSplitResult,
} from './index';

function receipt(overrides: Partial<ReceiptExtractionResult> = {}): ReceiptExtractionResult {
  return {
    currency: 'USD',
    subtotalMinor: 1000,
    totalMinor: 1000,
    items: [{ id: 'item-1', rawName: 'Lunch', lineTotalMinor: 1000 }],
    adjustments: [],
    warnings: [],
    ...overrides,
  };
}

function split(overrides: Partial<ReceiptSplitRequest> = {}): ReceiptSplitResult {
  return calculateReceiptSplits({
    receipt: receipt(),
    memberIds: ['alice'],
    itemAssignments: [{ itemId: 'item-1', memberIds: ['alice'] }],
    exchangeRateToBase: 1,
    ...overrides,
  });
}

function requireSuccess(result: ReceiptSplitResult): Extract<ReceiptSplitResult, { ok: true }> {
  if (result.ok === false) throw new Error(JSON.stringify(result.errors));
  assert.equal(result.ok, true);
  return result;
}

function requireError(
  result: ReceiptSplitResult,
  code: Extract<ReceiptSplitResult, { ok: false }>['errors'][number]['code']
): Extract<ReceiptSplitResult, { ok: false }> {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error(`Expected ${code}, received success.`);
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
  return result;
}

describe('minor-unit allocators', () => {
  it('splits a 10.00 item among three members in stable order', () => {
    assert.deepEqual(allocateEqualMinor(1000, ['alice', 'bob', 'carol']), [
      { memberId: 'alice', amountMinor: 334 },
      { memberId: 'bob', amountMinor: 333 },
      { memberId: 'carol', amountMinor: 333 },
    ]);
  });

  it('allocates signed proportional amounts and gives zero-subtotal members zero', () => {
    assert.deepEqual(allocateProportionalMinor(101, [
      { memberId: 'alice', weightMinor: 1000 },
      { memberId: 'bob', weightMinor: 0 },
      { memberId: 'carol', weightMinor: 2000 },
    ]), [
      { memberId: 'alice', amountMinor: 34 },
      { memberId: 'bob', amountMinor: 0 },
      { memberId: 'carol', amountMinor: 67 },
    ]);

    assert.deepEqual(allocateProportionalMinor(-101, [
      { memberId: 'alice', weightMinor: 1000 },
      { memberId: 'bob', weightMinor: 0 },
      { memberId: 'carol', weightMinor: 2000 },
    ]), [
      { memberId: 'alice', amountMinor: -34 },
      { memberId: 'bob', amountMinor: 0 },
      { memberId: 'carol', amountMinor: -67 },
    ]);
  });
});

describe('calculateReceiptSplits', () => {
  it('keeps repeated item names as separately assigned rows', () => {
    const result = requireSuccess(split({
      receipt: receipt({
        subtotalMinor: 1000,
        totalMinor: 1000,
        items: [
          { id: 'latte-1', rawName: 'Latte', lineTotalMinor: 500 },
          { id: 'latte-2', rawName: 'Latte', lineTotalMinor: 500 },
        ],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [
        { itemId: 'latte-1', memberIds: ['alice'] },
        { itemId: 'latte-2', memberIds: ['bob'] },
      ],
    }));

    assert.deepEqual(result.itemAllocations.map(row => row.sourceId), ['latte-1', 'latte-2']);
    assert.deepEqual(result.memberShares.map(share => share.totalMinor), [500, 500]);
  });

  it('allocates positive tax proportionally and positive tip equally', () => {
    const result = requireSuccess(split({
      receipt: receipt({
        subtotalMinor: 3000,
        totalMinor: 3401,
        items: [
          { id: 'meal-a', rawName: 'Meal', lineTotalMinor: 1000 },
          { id: 'meal-b', rawName: 'Meal', lineTotalMinor: 2000 },
        ],
        adjustments: [
          {
            id: 'tax',
            kind: 'tax',
            label: 'Tax',
            amountMinor: 300,
            allocation: 'proportional',
          },
          {
            id: 'tip',
            kind: 'tip',
            label: 'Tip',
            amountMinor: 101,
            allocation: 'equal',
          },
        ],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [
        { itemId: 'meal-a', memberIds: ['alice'] },
        { itemId: 'meal-b', memberIds: ['bob'] },
      ],
    }));

    assert.deepEqual(result.adjustmentAllocations, [
      {
        sourceId: 'tax',
        shares: [
          { memberId: 'alice', amountMinor: 100 },
          { memberId: 'bob', amountMinor: 200 },
        ],
      },
      {
        sourceId: 'tip',
        shares: [
          { memberId: 'alice', amountMinor: 51 },
          { memberId: 'bob', amountMinor: 50 },
        ],
      },
    ]);
    assert.deepEqual(result.memberShares.map(share => share.totalMinor), [1151, 2250]);
  });

  it('allocates negative discounts without changing the grand-total invariant', () => {
    const result = requireSuccess(split({
      receipt: receipt({
        subtotalMinor: 3000,
        totalMinor: 2700,
        items: [
          { id: 'a', rawName: 'A', lineTotalMinor: 1000 },
          { id: 'b', rawName: 'B', lineTotalMinor: 2000 },
        ],
        adjustments: [{
          id: 'discount',
          kind: 'discount',
          label: 'Discount',
          amountMinor: -300,
          allocation: 'proportional',
        }],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [
        { itemId: 'a', memberIds: ['alice'] },
        { itemId: 'b', memberIds: ['bob'] },
      ],
    }));

    assert.deepEqual(result.adjustmentAllocations[0].shares, [
      { memberId: 'alice', amountMinor: -100 },
      { memberId: 'bob', amountMinor: -200 },
    ]);
    assert.deepEqual(result.memberShares.map(share => share.totalMinor), [900, 1800]);
    assert.equal(result.memberShares.reduce((sum, share) => sum + share.totalMinor, 0), 2700);
  });

  it('leaves zero-subtotal members at zero during proportional allocation', () => {
    const result = requireSuccess(split({
      receipt: receipt({
        totalMinor: 1100,
        adjustments: [{
          id: 'tax',
          kind: 'tax',
          label: 'Tax',
          amountMinor: 100,
          allocation: 'proportional',
        }],
      }),
      memberIds: ['alice', 'bob', 'carol'],
      itemAssignments: [{ itemId: 'item-1', memberIds: ['alice'] }],
    }));

    assert.deepEqual(result.adjustmentAllocations[0].shares, [
      { memberId: 'alice', amountMinor: 100 },
      { memberId: 'bob', amountMinor: 0 },
      { memberId: 'carol', amountMinor: 0 },
    ]);
  });

  it('requires manual adjustments to sum exactly in signed minor units', () => {
    const invalid = requireError(split({
      receipt: receipt({
        totalMinor: 1100,
        adjustments: [{
          id: 'manual-tax',
          kind: 'tax',
          label: 'Manual tax',
          amountMinor: 100,
          allocation: 'manual',
        }],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [{ itemId: 'item-1', memberIds: ['alice', 'bob'] }],
      manualAdjustmentAllocations: [{
        adjustmentId: 'manual-tax',
        amountsByMemberId: { alice: 40, bob: 50 },
      }],
    }), 'MANUAL_ADJUSTMENT_MISMATCH');
    assert.match(invalid.errors[0].message, /sum exactly/i);

    const valid = requireSuccess(split({
      receipt: receipt({
        totalMinor: 1100,
        adjustments: [{
          id: 'manual-tax',
          kind: 'tax',
          label: 'Manual tax',
          amountMinor: 100,
          allocation: 'manual',
        }],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [{ itemId: 'item-1', memberIds: ['alice', 'bob'] }],
      manualAdjustmentAllocations: [{
        adjustmentId: 'manual-tax',
        amountsByMemberId: { alice: 60, bob: 40 },
      }],
    }));
    assert.deepEqual(valid.memberShares.map(share => share.totalMinor), [560, 540]);
  });

  it('does not let a zero manual adjustment silently transfer debt between members', () => {
    requireError(split({
      receipt: receipt({
        adjustments: [{
          id: 'rounding',
          kind: 'rounding',
          label: 'Rounding',
          amountMinor: 0,
          allocation: 'manual',
        }],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [{ itemId: 'item-1', memberIds: ['alice', 'bob'] }],
      manualAdjustmentAllocations: [{
        adjustmentId: 'rounding',
        amountsByMemberId: { alice: 100, bob: -100 },
      }],
    }), 'MANUAL_ADJUSTMENT_MISMATCH');
  });

  it('blocks continuation while any item is unassigned', () => {
    const result = requireError(split({ itemAssignments: [] }), 'UNASSIGNED_ITEM');
    assert.match(result.errors[0].message, /assign item/i);
  });

  it('requires items plus adjustments to reconcile exactly to the printed total', () => {
    const result = requireError(split({
      receipt: receipt({ totalMinor: 1001 }),
    }), 'UNRESOLVED_DIFFERENCE');
    assert.match(result.errors[0].message, /differ.*1 minor unit/i);
  });

  it('rejects a printed subtotal that differs from the item rows', () => {
    requireError(split({
      receipt: receipt({ subtotalMinor: 999 }),
    }), 'UNRESOLVED_DIFFERENCE');
  });

  it('converts through the existing exchange path and reconciles its remainder', () => {
    const result = requireSuccess(split({
      receipt: receipt({
        subtotalMinor: 3,
        totalMinor: 3,
        items: [
          { id: 'a', rawName: 'A', lineTotalMinor: 1 },
          { id: 'b', rawName: 'B', lineTotalMinor: 1 },
          { id: 'c', rawName: 'C', lineTotalMinor: 1 },
        ],
      }),
      memberIds: ['alice', 'bob', 'carol'],
      itemAssignments: [
        { itemId: 'a', memberIds: ['alice'] },
        { itemId: 'b', memberIds: ['bob'] },
        { itemId: 'c', memberIds: ['carol'] },
      ],
      exchangeRateToBase: 0.5,
    }));

    const canonicalConvertedAmount = calculateConvertedAmount(0.03, 0.5);
    assert.equal(result.convertedTotalMinor, Math.round(canonicalConvertedAmount * 100));
    assert.equal(result.expenseSplits.reduce((sum, row) => sum + row.amount_owed, 0), canonicalConvertedAmount);
    assert.deepEqual(result.expenseSplits, [
      { member_id: 'alice', amount_owed: 0 },
      { member_id: 'bob', amount_owed: 0.01 },
      { member_id: 'carol', amount_owed: 0.01 },
    ]);
  });

  it('maps supported results directly into ExpenseSplitInput rows', () => {
    const result = requireSuccess(split());
    assert.deepEqual(result.expenseSplits, [{ member_id: 'alice', amount_owed: 10 }]);
  });

  it('returns clear errors for missing totals, unsupported currencies, and invalid rates', () => {
    requireError(split({
      receipt: { ...receipt(), totalMinor: undefined },
    }), 'MISSING_TOTAL');
    requireError(split({
      receipt: { ...receipt(), currency: 'EUR' },
    }), 'UNSUPPORTED_CURRENCY');
    const { currency: _currency, ...receiptWithoutCurrency } = receipt();
    requireError(split({ receipt: receiptWithoutCurrency }), 'UNSUPPORTED_CURRENCY');
    requireError(split({ exchangeRateToBase: 0 }), 'INVALID_EXCHANGE_RATE');
  });

  it('rejects rates that round a positive receipt to a zero base total', () => {
    requireError(split({
      receipt: receipt({ subtotalMinor: 1, totalMinor: 1, items: [
        { id: 'item-1', rawName: 'Tiny item', lineTotalMinor: 1 },
      ] }),
      exchangeRateToBase: 0.001,
    }), 'UNSAFE_CONVERTED_TOTAL');
  });

  it('rejects exchange-rate precision that cannot be persisted exactly', () => {
    requireError(split({
      receipt: receipt({
        subtotalMinor: 100_000_000,
        totalMinor: 100_000_000,
        items: [{
          id: 'item-1',
          rawName: 'Large item',
          lineTotalMinor: 100_000_000,
        }],
      }),
      exchangeRateToBase: 0.123456784,
    }), 'INVALID_EXCHANGE_RATE');
  });

  it('rejects a converted total outside the existing numeric(14,2) schema', () => {
    requireError(split({
      receipt: receipt({
        subtotalMinor: MAX_EXPENSE_MINOR,
        totalMinor: MAX_EXPENSE_MINOR,
        items: [{
          id: 'item-1',
          rawName: 'Maximum expense',
          lineTotalMinor: MAX_EXPENSE_MINOR,
        }],
      }),
      exchangeRateToBase: 2,
    }), 'UNSAFE_CONVERTED_TOTAL');
  });

  it('blocks adjustment policies that would create a negative expense split', () => {
    requireError(split({
      receipt: receipt({
        subtotalMinor: 110,
        totalMinor: 60,
        items: [
          { id: 'small', rawName: 'Small', lineTotalMinor: 10 },
          { id: 'large', rawName: 'Large', lineTotalMinor: 100 },
        ],
        adjustments: [{
          id: 'discount',
          kind: 'discount',
          label: 'Discount',
          amountMinor: -50,
          allocation: 'equal',
        }],
      }),
      memberIds: ['alice', 'bob'],
      itemAssignments: [
        { itemId: 'small', memberIds: ['alice'] },
        { itemId: 'large', memberIds: ['bob'] },
      ],
    }), 'NEGATIVE_MEMBER_TOTAL');
  });
});
