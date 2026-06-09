import { Currency, ExchangeRate, Member, Trip } from '../types';

export interface DisplayMoney {
  primary: string;
  amount: number;
  currency: Currency;
  converted: boolean;
  unavailable: boolean;
  secondary?: string;
  helper?: string;
}

export function normalizeCurrency(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function toCurrency(value: unknown): Currency {
  const normalized = normalizeCurrency(value);
  if (normalized === 'AED' || normalized === 'CNY' || normalized === 'KZT') {
    return normalized;
  }
  return 'CNY';
}

export function getTripExchangeRate(
  exchangeRates: unknown,
  tripId: string | null | undefined,
  fromCurrency: unknown,
  toCurrency: unknown
): ExchangeRate | null {
  const normalizedFrom = normalizeCurrency(fromCurrency);
  const normalizedTo = normalizeCurrency(toCurrency);
  const normalizedTripId = String(tripId ?? '').trim();
  const rows = Array.isArray(exchangeRates) ? exchangeRates : [];

  if (!normalizedTripId || !normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return null;
  }

  const match = rows.find(row => {
    if (!row || typeof row !== 'object') return false;

    const rate = row as Partial<ExchangeRate>;
    const numericRate = Number(rate.rate);

    return (
      String(rate.trip_id ?? '').trim() === normalizedTripId &&
      normalizeCurrency(rate.from_currency) === normalizedFrom &&
      normalizeCurrency(rate.to_currency) === normalizedTo &&
      Number.isFinite(numericRate) &&
      numericRate > 0
    );
  });

  return match ? match as ExchangeRate : null;
}

export function getMemberDisplayCurrency(member: Member | null | undefined, trip: Trip | null | undefined): Currency {
  return member?.display_currency ?? trip?.base_currency ?? 'CNY';
}

export function getDisplayConversionRate(
  baseCurrency: Currency,
  displayCurrency: Currency,
  exchangeRates: unknown,
  tripId?: string | null
): number | null {
  if (baseCurrency === displayCurrency) return 1;

  const directRate = getTripExchangeRate(exchangeRates, tripId, baseCurrency, displayCurrency);
  if (directRate) return directRate.rate;

  const inverseRate = getTripExchangeRate(exchangeRates, tripId, displayCurrency, baseCurrency);
  if (inverseRate?.rate && Number.isFinite(inverseRate.rate) && inverseRate.rate > 0) {
    return 1 / inverseRate.rate;
  }

  return null;
}

export function convertBaseToDisplayAmount(
  baseAmount: number,
  baseCurrency: Currency,
  displayCurrency: Currency,
  exchangeRates: unknown,
  tripId?: string | null
): number | null {
  if (!Number.isFinite(baseAmount)) return null;

  const rate = getDisplayConversionRate(baseCurrency, displayCurrency, exchangeRates, tripId);
  if (rate === null) return null;

  return Math.round(baseAmount * rate * 100) / 100;
}

export function formatMoney(amount: number, currency: Currency): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatDisplayMoney(
  baseAmount: number,
  baseCurrency: Currency,
  displayCurrency: Currency,
  exchangeRates: unknown,
  tripId?: string | null
): DisplayMoney {
  const convertedAmount = convertBaseToDisplayAmount(baseAmount, baseCurrency, displayCurrency, exchangeRates, tripId);
  const baseFormatted = formatMoney(baseAmount, baseCurrency);

  if (displayCurrency === baseCurrency) {
    return {
      primary: baseFormatted,
      amount: baseAmount,
      currency: baseCurrency,
      converted: false,
      unavailable: false,
    };
  }

  if (convertedAmount === null) {
    return {
      primary: baseFormatted,
      amount: baseAmount,
      currency: baseCurrency,
      converted: false,
      unavailable: true,
      helper: `Display rate unavailable. Showing ${baseCurrency}.`,
    };
  }

  return {
    primary: `≈${formatMoney(convertedAmount, displayCurrency)}`,
    amount: convertedAmount,
    currency: displayCurrency,
    converted: true,
    unavailable: false,
    secondary: `${baseFormatted} base`,
  };
}
