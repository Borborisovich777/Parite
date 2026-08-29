import { SUPPORTED_CURRENCIES, type Currency } from '../../types';
import { MAX_EXPENSE_MINOR } from './constants';
import type { MoneyParseOptions, MoneyParseResult } from './types';

const TWO_DECIMAL_MONEY_PATTERN = /^(-)?(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/;

function normalizeSupportedCurrency(value: unknown): Currency | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as Currency)
    ? (normalized as Currency)
    : null;
}

/**
 * Parses user-edited money without passing through binary floating point.
 * All currently supported Parité currencies use two decimal minor units.
 */
export function parseMoneyToMinor(
  value: string,
  options: MoneyParseOptions
): MoneyParseResult {
  const currency = normalizeSupportedCurrency(options.currency);
  if (!currency) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Choose a supported currency: AED, CNY, KZT, or USD.',
        path: 'currency',
      },
    };
  }

  const trimmed = value.trim();
  const match = TWO_DECIMAL_MONEY_PATTERN.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VALUE',
        message: 'Enter a money amount with no more than two decimal places.',
        path: 'amount',
      },
    };
  }

  const negative = match[1] === '-';
  if (negative && !options.allowNegative) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VALUE',
        message: 'This money amount cannot be negative.',
        path: 'amount',
      },
    };
  }

  const whole = match[2] ?? '0';
  const fraction = (match[3] ?? match[4] ?? '').padEnd(2, '0');
  const absoluteMinor = (BigInt(whole) * 100n) + BigInt(fraction || '0');
  const signedMinor = negative ? -absoluteMinor : absoluteMinor;

  if (
    signedMinor > BigInt(MAX_EXPENSE_MINOR)
    || signedMinor < BigInt(-MAX_EXPENSE_MINOR)
  ) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VALUE',
        message: 'The money amount is too large to calculate safely.',
        path: 'amount',
      },
    };
  }

  const amountMinor = Number(signedMinor);
  if (amountMinor === 0 && options.allowZero === false) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VALUE',
        message: 'The money amount must be greater than zero.',
        path: 'amount',
      },
    };
  }

  return { ok: true, currency, amountMinor };
}
