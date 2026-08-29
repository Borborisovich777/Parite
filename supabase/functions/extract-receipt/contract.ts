export const SUPPORTED_CURRENCIES = ['AED', 'CNY', 'KZT', 'USD'] as const;

export type ReceiptCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type ReceiptItemCandidate = {
  id: string;
  rawName: string;
  quantity?: string;
  unitAmountMinor?: number;
  lineTotalMinor: number;
  confidence?: number;
};

export type ReceiptAdjustment = {
  id: string;
  kind: 'tax' | 'tip' | 'service' | 'discount' | 'rounding' | 'other';
  label: string;
  amountMinor: number;
  allocation: 'proportional' | 'equal' | 'manual';
};

export type ReceiptExtractionResult = {
  merchant?: string;
  purchasedAt?: string;
  currency?: ReceiptCurrency;
  subtotalMinor?: number;
  totalMinor: number;
  items: ReceiptItemCandidate[];
  adjustments: ReceiptAdjustment[];
  warnings: string[];
};

const MAX_MINOR_AMOUNT = 1_000_000_000_000;
const MAX_ITEMS = 500;
const MAX_ADJUSTMENTS = 50;

export function isSupportedCurrency(value: string): value is ReceiptCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * The provider adapter is not trusted. Validate the small, provider-neutral
 * object again before allowing it to cross the Edge Function boundary.
 */
export function assertReceiptExtractionResult(
  value: ReceiptExtractionResult,
): asserts value is ReceiptExtractionResult {
  if (
    !Number.isSafeInteger(value.totalMinor) || value.totalMinor <= 0 || value.totalMinor > MAX_MINOR_AMOUNT
  ) {
    throw new Error('invalid total');
  }

  if (value.subtotalMinor !== undefined && !isMinorAmount(value.subtotalMinor, false)) {
    throw new Error('invalid subtotal');
  }

  if (value.currency !== undefined && !isSupportedCurrency(value.currency)) {
    throw new Error('invalid currency');
  }

  if (value.merchant !== undefined && (!isSafeText(value.merchant, 200) || value.merchant.length === 0)) {
    throw new Error('invalid merchant');
  }

  if (value.purchasedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value.purchasedAt)) {
    throw new Error('invalid purchase date');
  }

  if (!Array.isArray(value.items) || value.items.length > MAX_ITEMS) {
    throw new Error('invalid items');
  }

  const itemIds = new Set<string>();
  for (const item of value.items) {
    if (!isSafeText(item.id, 80) || itemIds.has(item.id)) throw new Error('invalid item id');
    itemIds.add(item.id);
    if (!isSafeText(item.rawName, 500) || item.rawName.length === 0) throw new Error('invalid item name');
    if (item.quantity !== undefined && !isSafeText(item.quantity, 80)) throw new Error('invalid quantity');
    if (item.unitAmountMinor !== undefined && !isMinorAmount(item.unitAmountMinor, false)) {
      throw new Error('invalid unit amount');
    }
    if (!isMinorAmount(item.lineTotalMinor, false)) throw new Error('invalid line total');
    if (
      item.confidence !== undefined &&
      (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1)
    ) {
      throw new Error('invalid confidence');
    }
  }

  if (!Array.isArray(value.adjustments) || value.adjustments.length > MAX_ADJUSTMENTS) {
    throw new Error('invalid adjustments');
  }

  const adjustmentIds = new Set<string>();
  for (const adjustment of value.adjustments) {
    if (!isSafeText(adjustment.id, 80) || adjustmentIds.has(adjustment.id)) {
      throw new Error('invalid adjustment id');
    }
    adjustmentIds.add(adjustment.id);
    if (!isSafeText(adjustment.label, 200) || adjustment.label.length === 0) {
      throw new Error('invalid adjustment label');
    }
    if (!isMinorAmount(adjustment.amountMinor, true)) throw new Error('invalid adjustment amount');
    if (!['tax', 'tip', 'service', 'discount', 'rounding', 'other'].includes(adjustment.kind)) {
      throw new Error('invalid adjustment kind');
    }
    if (adjustment.kind === 'discount' && adjustment.amountMinor > 0) {
      throw new Error('invalid discount sign');
    }
    if (['tax', 'tip', 'service'].includes(adjustment.kind) && adjustment.amountMinor < 0) {
      throw new Error('invalid charge sign');
    }
    if (!['proportional', 'equal', 'manual'].includes(adjustment.allocation)) {
      throw new Error('invalid adjustment allocation');
    }
  }

  if (
    !Array.isArray(value.warnings) || value.warnings.length > 50 ||
    value.warnings.some((warning) => !isSafeText(warning, 300))
  ) {
    throw new Error('invalid warnings');
  }
}

function isMinorAmount(value: number, signed: boolean): boolean {
  return Number.isSafeInteger(value) && value <= MAX_MINOR_AMOUNT &&
    value >= (signed ? -MAX_MINOR_AMOUNT : 0);
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength &&
    !containsDisallowedControl(value);
}

function containsDisallowedControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) return true;
  }
  return false;
}
