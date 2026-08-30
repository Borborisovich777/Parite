import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseReceiptQuotaForResponse,
  parseReceiptQuotaHeaders,
  parseReceiptQuotaStatus,
} from './receiptQuota';

const resetAt = '2026-09-01T00:00:00+00:00';

describe('receipt scan quota parsing', () => {
  it('parses a valid RPC response without exposing global usage', () => {
    assert.deepEqual(parseReceiptQuotaStatus({
      available: true,
      reason: null,
      limit: 10,
      used: 3,
      remaining: 7,
      reset_at: resetAt,
    }), {
      available: true,
      reason: null,
      limit: 10,
      used: 3,
      remaining: 7,
      resetAt,
    });
  });

  it('parses success headers and marks the tenth scan as exhausted', () => {
    const headers = new Headers({
      'x-receipt-scans-limit': '10',
      'x-receipt-scans-remaining': '0',
      'x-receipt-scans-reset-at': resetAt,
    });
    assert.deepEqual(parseReceiptQuotaHeaders(headers), {
      available: false,
      reason: 'user_limit',
      limit: 10,
      used: 10,
      remaining: 0,
      resetAt,
    });
  });

  it('keeps the shared capacity denial distinct from personal usage', () => {
    const headers = new Headers({
      'x-receipt-scans-limit': '10',
      'x-receipt-scans-remaining': '6',
      'x-receipt-scans-reset-at': resetAt,
    });
    assert.deepEqual(parseReceiptQuotaHeaders(headers, 'global_limit'), {
      available: false,
      reason: 'global_limit',
      limit: 10,
      used: 4,
      remaining: 6,
      resetAt,
    });
  });

  it('keeps an updated count after a non-quota provider failure', () => {
    const headers = new Headers({
      'x-receipt-scans-limit': '10',
      'x-receipt-scans-remaining': '1',
      'x-receipt-scans-reset-at': resetAt,
    });
    assert.deepEqual(parseReceiptQuotaForResponse(headers, 'extraction_failed'), {
      available: true,
      reason: null,
      limit: 10,
      used: 9,
      remaining: 1,
      resetAt,
    });
    assert.equal(parseReceiptQuotaForResponse(headers, 'receipt_capacity_reached')?.reason, 'global_limit');
  });

  it('rejects missing, negative, inconsistent, or oversized values', () => {
    assert.equal(parseReceiptQuotaHeaders(new Headers()), null);
    assert.equal(parseReceiptQuotaStatus({
      available: true,
      reason: null,
      limit: 10,
      used: 3,
      remaining: 8,
      reset_at: resetAt,
    }), null);
    assert.equal(parseReceiptQuotaStatus({
      available: true,
      reason: null,
      limit: 101,
      used: 0,
      remaining: 101,
      reset_at: resetAt,
    }), null);
    assert.equal(parseReceiptQuotaStatus({
      available: false,
      reason: 'user_limit',
      limit: 10,
      used: 9,
      remaining: 1,
      reset_at: resetAt,
    }), null);
  });
});
