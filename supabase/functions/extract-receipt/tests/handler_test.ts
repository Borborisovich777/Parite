import type { AccessVerifier } from '../auth.ts';
import type { ReceiptExtractionResult } from '../contract.ts';
import { SafeHttpError } from '../errors.ts';
import { createReceiptHandler } from '../handler.ts';
import type { ReceiptQuotaLimiter, ReceiptQuotaReservation } from '../quota.ts';
import { assert, assertEquals } from './assert.ts';

const config = {
  imageLimits: { maxBytes: 1024, maxPixels: 2_000_000, maxEdge: 2_000, minEdge: 64 },
  requestTimeoutMs: 2_000,
};

const success: ReceiptExtractionResult = {
  currency: 'USD',
  totalMinor: 100,
  items: [{ id: 'item-1', rawName: 'Water', lineTotalMinor: 100 }],
  adjustments: [],
  warnings: [],
};

const allowedQuota: ReceiptQuotaReservation = {
  allowed: true,
  reason: null,
  limit: 10,
  used: 1,
  remaining: 9,
  resetAt: '2026-09-01T00:00:00+00:00',
};

Deno.test('unauthenticated request is rejected before its body or provider is used', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({ authenticationError: true }),
    quotaLimiter: quotaLimiter(),
    assertReady() {},
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });
  const response = await handler(receiptRequest());
  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: 'Sign in to scan a receipt.',
    code: 'authentication_required',
  });
  assertEquals(providerCalled, false);
});

Deno.test('reserves quota before extraction, returns quota headers, and clears the image buffer', async () => {
  let providerBytes: Uint8Array | undefined;
  const calls: string[] = [];
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: quotaLimiter(allowedQuota, () => calls.push('quota')),
    assertReady() {
      calls.push('ready');
    },
    extract: (input) => {
      calls.push('provider');
      providerBytes = input.bytes;
      assert(input.bytes.some((byte) => byte !== 0));
      return Promise.resolve(success);
    },
    config,
  });
  const response = await handler(receiptRequest());
  assertEquals(response.status, 200);
  assertEquals(await response.json(), success);
  assert(providerBytes);
  assertEquals(providerBytes.every((byte) => byte === 0), true);
  assertEquals(calls, ['ready', 'quota', 'provider']);
  assertEquals(response.headers.get('cache-control'), 'no-store, max-age=0');
  assertEquals(response.headers.get('x-receipt-scans-limit'), '10');
  assertEquals(response.headers.get('x-receipt-scans-remaining'), '9');
  assertEquals(response.headers.get('x-receipt-scans-reset-at'), allowedQuota.resetAt);
  assert(
    response.headers.get('access-control-expose-headers')?.includes('x-receipt-scans-remaining'),
  );
});

Deno.test('does not call the provider for a user outside the trip', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({ membershipError: true }),
    quotaLimiter: quotaLimiter(allowedQuota, () => {
      throw new Error('quota must not be called');
    }),
    assertReady() {
      throw new Error('provider readiness must not be checked');
    },
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });
  const response = await handler(receiptRequest());
  assertEquals(response.status, 403);
  assertEquals(providerCalled, false);
});

Deno.test('does not reserve quota for an invalid image', async () => {
  let quotaCalled = false;
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: quotaLimiter(allowedQuota, () => {
      quotaCalled = true;
    }),
    assertReady() {},
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });

  const response = await handler(receiptRequest(new Uint8Array([1, 2, 3])));
  assertEquals(response.status, 415);
  assertEquals(quotaCalled, false);
  assertEquals(providerCalled, false);
});

Deno.test('does not reserve quota when provider configuration is unavailable', async () => {
  let quotaCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: quotaLimiter(allowedQuota, () => {
      quotaCalled = true;
    }),
    assertReady() {
      throw new SafeHttpError(503, 'extraction_unavailable', 'Receipt scanning is not configured.');
    },
    extract: () => Promise.resolve(success),
    config,
  });

  const response = await handler(receiptRequest());
  assertEquals(response.status, 503);
  assertEquals(quotaCalled, false);
});

Deno.test('a user quota denial returns 429 and never calls the provider', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: quotaLimiter({
      ...allowedQuota,
      allowed: false,
      reason: 'user_limit',
      used: 10,
      remaining: 0,
    }),
    assertReady() {},
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });

  const response = await handler(receiptRequest());
  assertEquals(response.status, 429);
  assertEquals(response.headers.get('x-receipt-scans-remaining'), '0');
  assertEquals(await response.json(), {
    error: 'You have used all 10 receipt scans for this month. You can still enter the expense manually.',
    code: 'receipt_quota_exceeded',
  });
  assertEquals(providerCalled, false);
});

Deno.test('a shared capacity denial is distinct and does not expose global usage', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: quotaLimiter({
      ...allowedQuota,
      allowed: false,
      reason: 'global_limit',
    }),
    assertReady() {},
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });

  const response = await handler(receiptRequest());
  assertEquals(response.status, 429);
  const payload = await response.json();
  assertEquals(payload, {
    error: 'Receipt scanning has reached its shared monthly limit. You can still enter the expense manually.',
    code: 'receipt_capacity_reached',
  });
  assertEquals(JSON.stringify(payload).includes('450'), false);
  assertEquals(providerCalled, false);
});

Deno.test('quota service failure is sanitized and never calls the provider', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    quotaLimiter: {
      reserve() {
        return Promise.reject(
          new SafeHttpError(503, 'extraction_unavailable', 'Receipt scanning is temporarily unavailable.'),
        );
      },
    },
    assertReady() {},
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });

  const response = await handler(receiptRequest());
  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: 'Receipt scanning is temporarily unavailable.',
    code: 'extraction_unavailable',
  });
  assertEquals(providerCalled, false);
});

function verifier(options: { authenticationError?: boolean; membershipError?: boolean }): AccessVerifier {
  return {
    authenticate() {
      if (options.authenticationError) {
        return Promise.reject(
          new SafeHttpError(401, 'authentication_required', 'Sign in to scan a receipt.'),
        );
      }
      return Promise.resolve({ userId: '10000000-0000-4000-8000-000000000000' });
    },
    verifyTripMembership() {
      if (options.membershipError) {
        return Promise.reject(
          new SafeHttpError(403, 'trip_access_denied', 'You are not an approved member of this trip.'),
        );
      }
      return Promise.resolve();
    },
  };
}

function quotaLimiter(
  reservation: ReceiptQuotaReservation = allowedQuota,
  onReserve?: () => void,
): ReceiptQuotaLimiter {
  return {
    reserve() {
      onReserve?.();
      return Promise.resolve(reservation);
    },
  };
}

function receiptRequest(imageBytes = pngHeader(800, 1_600)): Request {
  const form = new FormData();
  form.set('trip_id', '20000000-0000-4000-8000-000000000000');
  form.set(
    'image',
    new File([imageBytes.buffer as ArrayBuffer], 'receipt.png', { type: 'image/png' }),
  );
  return new Request('https://example.test/functions/v1/extract-receipt', {
    method: 'POST',
    headers: { authorization: `Bearer ${'x'.repeat(40)}` },
    body: form,
  });
}

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 2;
  return bytes;
}
