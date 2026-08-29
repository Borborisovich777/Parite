import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMoneyToMinor, parseReceiptExtractionResult } from './index';

describe('parseMoneyToMinor', () => {
  it('parses supported two-decimal money without floating-point arithmetic', () => {
    assert.deepEqual(parseMoneyToMinor('10.05', { currency: 'usd' }), {
      ok: true,
      currency: 'USD',
      amountMinor: 1005,
    });
    assert.deepEqual(parseMoneyToMinor('.5', { currency: 'AED' }), {
      ok: true,
      currency: 'AED',
      amountMinor: 50,
    });
    assert.deepEqual(parseMoneyToMinor('42.', { currency: 'KZT' }), {
      ok: true,
      currency: 'KZT',
      amountMinor: 4200,
    });
  });

  it('allows signed discount values only when explicitly requested', () => {
    assert.deepEqual(parseMoneyToMinor('-2.75', {
      currency: 'CNY',
      allowNegative: true,
    }), {
      ok: true,
      currency: 'CNY',
      amountMinor: -275,
    });

    const result = parseMoneyToMinor('-2.75', { currency: 'CNY' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_VALUE');
  });

  it('rejects unsupported currencies, excess precision, exponent notation, and unsafe values', () => {
    const unsupported = parseMoneyToMinor('1.00', { currency: 'EUR' });
    assert.equal(unsupported.ok, false);
    if (!unsupported.ok) assert.equal(unsupported.error.code, 'UNSUPPORTED_CURRENCY');

    for (const value of ['1.001', '1e3', '1,000.00', '', 'not money']) {
      const result = parseMoneyToMinor(value, { currency: 'USD' });
      assert.equal(result.ok, false, value);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_VALUE');
    }

    const unsafe = parseMoneyToMinor('90071992547410.00', { currency: 'USD' });
    assert.equal(unsafe.ok, false);
    if (!unsafe.ok) assert.match(unsafe.error.message, /too large/i);

    const malformedCurrency = parseMoneyToMinor('1.00', { currency: ['USD'] });
    assert.equal(malformedCurrency.ok, false);
    if (!malformedCurrency.ok) assert.equal(malformedCurrency.error.code, 'UNSUPPORTED_CURRENCY');
  });

  it('enforces the existing numeric(14,2) persistence boundary', () => {
    assert.deepEqual(parseMoneyToMinor('999999999999.99', { currency: 'USD' }), {
      ok: true,
      currency: 'USD',
      amountMinor: 99_999_999_999_999,
    });
    const tooLarge = parseMoneyToMinor('1000000000000.00', { currency: 'USD' });
    assert.equal(tooLarge.ok, false);
    if (!tooLarge.ok) assert.match(tooLarge.error.message, /too large/i);
  });

  it('can require a positive, non-zero value', () => {
    const result = parseMoneyToMinor('0.00', { currency: 'USD', allowZero: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error.message, /greater than zero/i);
  });
});

describe('parseReceiptExtractionResult', () => {
  const validReceipt = {
    merchant: 'Cafe',
    currency: 'USD',
    subtotalMinor: 1000,
    totalMinor: 1100,
    items: [{ id: 'item-1', rawName: 'Lunch', lineTotalMinor: 1000 }],
    adjustments: [{
      id: 'tax-1',
      kind: 'tax',
      label: 'Tax',
      amountMinor: 100,
      allocation: 'proportional',
    }],
    warnings: [],
  };

  it('accepts and normalizes provider-neutral receipt data', () => {
    const result = parseReceiptExtractionResult({ ...validReceipt, currency: 'usd' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.currency, 'USD');
      assert.equal(result.value.items[0].rawName, 'Lunch');
    }
  });

  it('allows an omitted currency so a person can correct an ambiguous extraction', () => {
    const { currency: _currency, ...withoutCurrency } = validReceipt;
    const result = parseReceiptExtractionResult(withoutCurrency);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.currency, undefined);
  });

  it('returns a specific missing-total error', () => {
    const { totalMinor: _totalMinor, ...withoutTotal } = validReceipt;
    const result = parseReceiptExtractionResult(withoutTotal);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(error => error.code === 'MISSING_TOTAL'));
  });

  it('blocks unsupported currencies and invalid minor-unit values', () => {
    const result = parseReceiptExtractionResult({
      ...validReceipt,
      currency: 'EUR',
      items: [{ id: 'item-1', rawName: 'Lunch', lineTotalMinor: 10.5 }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some(error => error.code === 'UNSUPPORTED_CURRENCY'));
      assert.ok(result.errors.some(error => error.path === 'items[0].lineTotalMinor'));
    }
  });

  it('does not coerce malformed currency JSON into a supported code', () => {
    for (const malformedCurrency of [['USD'], 123, null, {}]) {
      const result = parseReceiptExtractionResult({
        ...validReceipt,
        currency: malformedCurrency,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(result.errors.some(error => error.code === 'UNSUPPORTED_CURRENCY'));
      }
    }
  });

  it('keeps repeated item names but rejects duplicated item IDs', () => {
    const repeatedNames = parseReceiptExtractionResult({
      ...validReceipt,
      subtotalMinor: 2000,
      totalMinor: 2100,
      items: [
        { id: 'item-1', rawName: 'Latte', lineTotalMinor: 1000 },
        { id: 'item-2', rawName: 'Latte', lineTotalMinor: 1000 },
      ],
    });
    assert.equal(repeatedNames.ok, true);
    if (repeatedNames.ok) assert.equal(repeatedNames.value.items.length, 2);

    const duplicatedIds = parseReceiptExtractionResult({
      ...validReceipt,
      subtotalMinor: 2000,
      totalMinor: 2100,
      items: [
        { id: 'item-1', rawName: 'Latte', lineTotalMinor: 1000 },
        { id: 'item-1', rawName: 'Latte', lineTotalMinor: 1000 },
      ],
    });
    assert.equal(duplicatedIds.ok, false);
    if (!duplicatedIds.ok) {
      assert.ok(duplicatedIds.errors.some(error => error.code === 'DUPLICATE_ID'));
    }
  });
});
