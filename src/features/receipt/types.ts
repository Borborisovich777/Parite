import type { Currency, ExpenseSplitInput } from '../../types';

export type ReceiptAdjustmentKind =
  | 'tax'
  | 'tip'
  | 'service'
  | 'discount'
  | 'rounding'
  | 'other';

export type ReceiptAdjustmentAllocation = 'proportional' | 'equal' | 'manual';

/** Provider-neutral line item returned to the browser after normalization. */
export interface ReceiptItemCandidate {
  id: string;
  rawName: string;
  quantity?: string;
  unitAmountMinor?: number;
  lineTotalMinor: number;
  confidence?: number;
}

/**
 * Receipt-level amount that is already included in the printed total.
 * Discounts and other credits use a negative amount.
 */
export interface ReceiptAdjustment {
  id: string;
  kind: ReceiptAdjustmentKind;
  label: string;
  amountMinor: number;
  allocation: ReceiptAdjustmentAllocation;
}

/** The only receipt extraction shape consumed by browser receipt features. */
export interface ReceiptExtractionResult {
  merchant?: string;
  purchasedAt?: string;
  currency?: Currency;
  subtotalMinor?: number;
  totalMinor: number;
  items: ReceiptItemCandidate[];
  adjustments: ReceiptAdjustment[];
  warnings: string[];
}

export interface ReceiptItemAssignment {
  itemId: string;
  /** Stable order controls deterministic remainder-unit allocation. */
  memberIds: string[];
}

export interface ReceiptManualAdjustmentAllocation {
  adjustmentId: string;
  /** Signed integer minor units, keyed by member ID. Missing members receive zero. */
  amountsByMemberId: Record<string, number>;
}

export interface ReceiptMemberMinorShare {
  memberId: string;
  itemSubtotalMinor: number;
  adjustmentMinor: number;
  totalMinor: number;
  convertedTotalMinor: number;
}

export interface ReceiptAllocatedRow {
  sourceId: string;
  shares: Array<{ memberId: string; amountMinor: number }>;
}

export type ReceiptSplitErrorCode =
  | 'INVALID_RECEIPT'
  | 'MISSING_TOTAL'
  | 'UNSUPPORTED_CURRENCY'
  | 'INVALID_VALUE'
  | 'DUPLICATE_ID'
  | 'INVALID_MEMBER'
  | 'UNASSIGNED_ITEM'
  | 'UNKNOWN_ASSIGNMENT'
  | 'MANUAL_ADJUSTMENT_MISMATCH'
  | 'UNALLOCATABLE_ADJUSTMENT'
  | 'UNRESOLVED_DIFFERENCE'
  | 'NEGATIVE_MEMBER_TOTAL'
  | 'INVALID_EXCHANGE_RATE'
  | 'UNSAFE_CONVERTED_TOTAL';

export interface ReceiptSplitError {
  code: ReceiptSplitErrorCode;
  message: string;
  path?: string;
}

export interface ReceiptSplitRequest {
  /** Accepted as unknown because provider and edited JSON are untrusted at runtime. */
  receipt: unknown;
  /** Stable order controls all receipt-level rounding. */
  memberIds: string[];
  itemAssignments: ReceiptItemAssignment[];
  manualAdjustmentAllocations?: ReceiptManualAdjustmentAllocation[];
  /** Receipt currency to trip base currency. */
  exchangeRateToBase: number;
}

export type ReceiptSplitResult =
  | {
      ok: true;
      receipt: ReceiptExtractionResult;
      itemAllocations: ReceiptAllocatedRow[];
      adjustmentAllocations: ReceiptAllocatedRow[];
      memberShares: ReceiptMemberMinorShare[];
      receiptTotalMinor: number;
      convertedTotalMinor: number;
      expenseSplits: ExpenseSplitInput[];
    }
  | {
      ok: false;
      errors: ReceiptSplitError[];
    };

export interface MoneyParseOptions {
  currency: unknown;
  allowNegative?: boolean;
  allowZero?: boolean;
}

export type MoneyParseResult =
  | { ok: true; currency: Currency; amountMinor: number }
  | { ok: false; error: ReceiptSplitError };
