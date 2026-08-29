import type { ReceiptExtractionResult } from '../contract.ts';
import { ProviderFailure } from '../errors.ts';
import type { ProviderInput, ReceiptProvider } from '../provider.ts';
import { runProviderExtraction } from '../provider.ts';
import { assertEquals, assertRejects } from './assert.ts';

type Job = { id: string };

const normalized: ReceiptExtractionResult = {
  currency: 'AED',
  totalMinor: 500,
  items: [{ id: 'item-1', rawName: 'Tea', lineTotalMinor: 500 }],
  adjustments: [],
  warnings: [],
};

Deno.test('returns normalized content only after provider deletion succeeds', async () => {
  const events: string[] = [];
  const provider = fakeProvider(events);
  const result = await runProviderExtraction(provider, input(), new AbortController().signal, {
    cleanupTimeoutMs: 1_000,
    cleanupAttempts: 3,
    cleanupRetryDelayMs: 1,
  });
  assertEquals(result, normalized);
  assertEquals(events, ['start', 'wait', 'normalize', 'delete']);
});

Deno.test('suppresses extracted receipt content when deletion never succeeds', async () => {
  const events: string[] = [];
  const provider = fakeProvider(events, true);
  await assertRejects(
    () =>
      runProviderExtraction(provider, input(), new AbortController().signal, {
        cleanupTimeoutMs: 1_000,
        cleanupAttempts: 3,
        cleanupRetryDelayMs: 1,
      }),
    (error) => error instanceof ProviderFailure && error.kind === 'deletion',
  );
  assertEquals(events, ['start', 'wait', 'normalize', 'delete', 'delete', 'delete']);
});

Deno.test('still deletes a created job after extraction fails', async () => {
  const events: string[] = [];
  const provider = fakeProvider(events);
  provider.waitForResult = () => {
    events.push('wait');
    throw new ProviderFailure('request');
  };
  await assertRejects(
    () =>
      runProviderExtraction(provider, input(), new AbortController().signal, {
        cleanupTimeoutMs: 1_000,
        cleanupAttempts: 1,
        cleanupRetryDelayMs: 1,
      }),
    (error) => error instanceof ProviderFailure && error.kind === 'request',
  );
  assertEquals(events, ['start', 'wait', 'delete']);
});

function fakeProvider(events: string[], failDeletion = false): ReceiptProvider<Job> {
  return {
    start() {
      events.push('start');
      return Promise.resolve({ id: 'provider-job' });
    },
    waitForResult() {
      events.push('wait');
      return Promise.resolve({ provider: 'raw' });
    },
    normalize() {
      events.push('normalize');
      return normalized;
    },
    deleteResult() {
      events.push('delete');
      return failDeletion ? Promise.reject(new ProviderFailure('deletion', true)) : Promise.resolve();
    },
  };
}

function input(): ProviderInput {
  return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' };
}
