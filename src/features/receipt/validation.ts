import { SUPPORTED_CURRENCIES, type Currency } from '../../types';
import { MAX_EXPENSE_MINOR } from './constants';
import type {
  ReceiptAdjustment,
  ReceiptAdjustmentAllocation,
  ReceiptAdjustmentKind,
  ReceiptExtractionResult,
  ReceiptItemCandidate,
  ReceiptSplitError,
} from './types';

const ADJUSTMENT_KINDS = new Set<ReceiptAdjustmentKind>([
  'tax',
  'tip',
  'service',
  'discount',
  'rounding',
  'other',
]);

const ALLOCATION_METHODS = new Set<ReceiptAdjustmentAllocation>([
  'proportional',
  'equal',
  'manual',
]);

export type ReceiptExtractionValidationResult =
  | { ok: true; value: ReceiptExtractionResult }
  | { ok: false; errors: ReceiptSplitError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeMinor(value: unknown, allowNegative: boolean): value is number {
  return Number.isSafeInteger(value)
    && Math.abs(value as number) <= MAX_EXPENSE_MINOR
    && (allowNegative || (value as number) >= 0);
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  errors: ReceiptSplitError[]
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    errors.push({
      code: 'INVALID_VALUE',
      message: `${field} must be text when provided.`,
      path: field,
    });
    return undefined;
  }
  return value;
}

function parseItems(value: unknown, errors: ReceiptSplitError[]): ReceiptItemCandidate[] {
  if (!Array.isArray(value)) {
    errors.push({
      code: 'INVALID_VALUE',
      message: 'Receipt items must be an array.',
      path: 'items',
    });
    return [];
  }

  const ids = new Set<string>();
  const items: ReceiptItemCandidate[] = [];

  value.forEach((candidate, index) => {
    const path = `items[${index}]`;
    if (!isRecord(candidate)) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each receipt item must be an object.', path });
      return;
    }

    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each receipt item needs an ID.', path: `${path}.id` });
    } else if (ids.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        message: `Receipt item ID "${id}" is duplicated.`,
        path: `${path}.id`,
      });
    } else {
      ids.add(id);
    }

    const rawName = typeof candidate.rawName === 'string' ? candidate.rawName.trim() : '';
    if (!rawName) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Each receipt item needs a name.',
        path: `${path}.rawName`,
      });
    }

    if (!isSafeMinor(candidate.lineTotalMinor, false)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Item totals must be non-negative integer minor units.',
        path: `${path}.lineTotalMinor`,
      });
    }

    if (candidate.unitAmountMinor !== undefined && !isSafeMinor(candidate.unitAmountMinor, false)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Unit amounts must be non-negative integer minor units.',
        path: `${path}.unitAmountMinor`,
      });
    }

    if (candidate.quantity !== undefined && typeof candidate.quantity !== 'string') {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Item quantity must be text when provided.',
        path: `${path}.quantity`,
      });
    }

    if (
      candidate.confidence !== undefined
      && (
        typeof candidate.confidence !== 'number'
        || !Number.isFinite(candidate.confidence)
        || candidate.confidence < 0
        || candidate.confidence > 1
      )
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Item confidence must be a number from 0 to 1.',
        path: `${path}.confidence`,
      });
    }

    if (
      id
      && rawName
      && isSafeMinor(candidate.lineTotalMinor, false)
      && (candidate.unitAmountMinor === undefined || isSafeMinor(candidate.unitAmountMinor, false))
      && (candidate.quantity === undefined || typeof candidate.quantity === 'string')
      && (
        candidate.confidence === undefined
        || (
          typeof candidate.confidence === 'number'
          && Number.isFinite(candidate.confidence)
          && candidate.confidence >= 0
          && candidate.confidence <= 1
        )
      )
    ) {
      items.push({
        id,
        rawName,
        lineTotalMinor: candidate.lineTotalMinor,
        ...(candidate.quantity === undefined ? {} : { quantity: candidate.quantity as string }),
        ...(candidate.unitAmountMinor === undefined
          ? {}
          : { unitAmountMinor: candidate.unitAmountMinor as number }),
        ...(candidate.confidence === undefined
          ? {}
          : { confidence: candidate.confidence as number }),
      });
    }
  });

  return items;
}

function parseAdjustments(value: unknown, errors: ReceiptSplitError[]): ReceiptAdjustment[] {
  if (!Array.isArray(value)) {
    errors.push({
      code: 'INVALID_VALUE',
      message: 'Receipt adjustments must be an array.',
      path: 'adjustments',
    });
    return [];
  }

  const ids = new Set<string>();
  const adjustments: ReceiptAdjustment[] = [];

  value.forEach((candidate, index) => {
    const path = `adjustments[${index}]`;
    if (!isRecord(candidate)) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each adjustment must be an object.', path });
      return;
    }

    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each adjustment needs an ID.', path: `${path}.id` });
    } else if (ids.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        message: `Receipt adjustment ID "${id}" is duplicated.`,
        path: `${path}.id`,
      });
    } else {
      ids.add(id);
    }

    const kind = candidate.kind;
    if (typeof kind !== 'string' || !ADJUSTMENT_KINDS.has(kind as ReceiptAdjustmentKind)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Adjustment kind is not supported.',
        path: `${path}.kind`,
      });
    }

    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    if (!label) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each adjustment needs a label.', path: `${path}.label` });
    }

    if (!isSafeMinor(candidate.amountMinor, true)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Adjustment amounts must be signed integer minor units.',
        path: `${path}.amountMinor`,
      });
    } else if (kind === 'discount' && candidate.amountMinor > 0) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Discount amounts must be zero or negative.',
        path: `${path}.amountMinor`,
      });
    } else if (
      (kind === 'tax' || kind === 'tip' || kind === 'service')
      && candidate.amountMinor < 0
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        message: `${kind} amounts must be zero or positive.`,
        path: `${path}.amountMinor`,
      });
    }

    const allocation = candidate.allocation;
    if (
      typeof allocation !== 'string'
      || !ALLOCATION_METHODS.has(allocation as ReceiptAdjustmentAllocation)
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Adjustment allocation must be proportional, equal, or manual.',
        path: `${path}.allocation`,
      });
    }

    if (
      id
      && label
      && typeof kind === 'string'
      && ADJUSTMENT_KINDS.has(kind as ReceiptAdjustmentKind)
      && isSafeMinor(candidate.amountMinor, true)
      && !(kind === 'discount' && candidate.amountMinor > 0)
      && !((kind === 'tax' || kind === 'tip' || kind === 'service') && candidate.amountMinor < 0)
      && typeof allocation === 'string'
      && ALLOCATION_METHODS.has(allocation as ReceiptAdjustmentAllocation)
    ) {
      adjustments.push({
        id,
        kind: kind as ReceiptAdjustmentKind,
        label,
        amountMinor: candidate.amountMinor,
        allocation: allocation as ReceiptAdjustmentAllocation,
      });
    }
  });

  return adjustments;
}

/** Validates edited or remotely-produced receipt JSON before any arithmetic. */
export function parseReceiptExtractionResult(value: unknown): ReceiptExtractionValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_RECEIPT', message: 'Receipt data must be an object.' }],
    };
  }

  const errors: ReceiptSplitError[] = [];
  const merchant = optionalString(value, 'merchant', errors);
  const purchasedAt = optionalString(value, 'purchasedAt', errors);

  const hasCurrencyValue = value.currency !== undefined;
  const currencyValue = typeof value.currency === 'string'
    ? value.currency.trim().toUpperCase()
    : '';
  const currency = SUPPORTED_CURRENCIES.includes(currencyValue as Currency)
    ? (currencyValue as Currency)
    : undefined;
  if (hasCurrencyValue && !currency) {
    errors.push({
      code: 'UNSUPPORTED_CURRENCY',
      message: 'Choose a supported receipt currency: AED, CNY, KZT, or USD.',
      path: 'currency',
    });
  }

  if (value.totalMinor === undefined || value.totalMinor === null) {
    errors.push({ code: 'MISSING_TOTAL', message: 'The receipt total is required.', path: 'totalMinor' });
  } else if (!isSafeMinor(value.totalMinor, false) || value.totalMinor <= 0) {
    errors.push({
      code: 'INVALID_VALUE',
      message: 'The receipt total must be a positive integer number of minor units.',
      path: 'totalMinor',
    });
  }

  if (value.subtotalMinor !== undefined && !isSafeMinor(value.subtotalMinor, false)) {
    errors.push({
      code: 'INVALID_VALUE',
      message: 'The receipt subtotal must be non-negative integer minor units.',
      path: 'subtotalMinor',
    });
  }

  const items = parseItems(value.items, errors);
  const adjustments = parseAdjustments(value.adjustments, errors);

  const warnings: string[] = [];
  if (!Array.isArray(value.warnings) || value.warnings.some(warning => typeof warning !== 'string')) {
    errors.push({
      code: 'INVALID_VALUE',
      message: 'Receipt warnings must be an array of text values.',
      path: 'warnings',
    });
  } else {
    warnings.push(...value.warnings);
  }

  if (errors.length > 0 || !isSafeMinor(value.totalMinor, false) || value.totalMinor <= 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...(merchant === undefined ? {} : { merchant }),
      ...(purchasedAt === undefined ? {} : { purchasedAt }),
      ...(currency === undefined ? {} : { currency }),
      ...(value.subtotalMinor === undefined ? {} : { subtotalMinor: value.subtotalMinor as number }),
      totalMinor: value.totalMinor,
      items,
      adjustments,
      warnings,
    },
  };
}
