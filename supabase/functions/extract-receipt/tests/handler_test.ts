import type { AccessVerifier } from '../auth.ts';
import type { ReceiptExtractionResult } from '../contract.ts';
import { SafeHttpError } from '../errors.ts';
import { createReceiptHandler } from '../handler.ts';
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

Deno.test('unauthenticated request is rejected before its body or provider is used', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({ authenticationError: true }),
    extract: () => {
      providerCalled = true;
      return Promise.resolve(success);
    },
    config,
  });
  const response = await handler(receiptRequest());
  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Sign in to scan a receipt.' });
  assertEquals(providerCalled, false);
});

Deno.test('returns the normalized result at top level and clears the image buffer', async () => {
  let providerBytes: Uint8Array | undefined;
  const handler = createReceiptHandler({
    accessVerifier: verifier({}),
    extract: (input) => {
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
  assertEquals(response.headers.get('cache-control'), 'no-store, max-age=0');
});

Deno.test('does not call the provider for a user outside the trip', async () => {
  let providerCalled = false;
  const handler = createReceiptHandler({
    accessVerifier: verifier({ membershipError: true }),
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

function receiptRequest(): Request {
  const form = new FormData();
  form.set('trip_id', '20000000-0000-4000-8000-000000000000');
  form.set(
    'image',
    new File([pngHeader(800, 1_600).buffer as ArrayBuffer], 'receipt.png', { type: 'image/png' }),
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
