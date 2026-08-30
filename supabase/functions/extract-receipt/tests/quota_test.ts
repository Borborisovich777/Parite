import { SafeHttpError } from '../errors.ts';
import { parseQuotaReservation, SupabaseReceiptQuotaLimiter } from '../quota.ts';
import { assert, assertEquals } from './assert.ts';

const userId = '10000000-0000-4000-8000-000000000000';
const validPayload = {
  allowed: true,
  reason: null,
  limit: 10,
  used: 4,
  remaining: 6,
  reset_at: '2026-09-01T00:00:00+00:00',
};

Deno.test('parses a valid metadata-only quota reservation', () => {
  assertEquals(parseQuotaReservation(validPayload), {
    allowed: true,
    reason: null,
    limit: 10,
    used: 4,
    remaining: 6,
    resetAt: validPayload.reset_at,
  });
});

Deno.test('rejects inconsistent or malformed quota reservations', () => {
  assertEquals(parseQuotaReservation({ ...validPayload, remaining: 7 }), null);
  assertEquals(parseQuotaReservation({ ...validPayload, limit: -1 }), null);
  assertEquals(parseQuotaReservation({ ...validPayload, used: 1.5 }), null);
  assertEquals(parseQuotaReservation({ ...validPayload, reason: 'other' }), null);
  assertEquals(parseQuotaReservation({ ...validPayload, reset_at: 'next month' }), null);
  assertEquals(parseQuotaReservation({ ...validPayload, allowed: false, reason: null }), null);
  assertEquals(
    parseQuotaReservation({ ...validPayload, allowed: false, reason: 'user_limit', remaining: 6 }),
    null,
  );
});

Deno.test('quota client sends only the user ID with service-role authorization', async () => {
  let requestBody: unknown;
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    assertEquals(String(input), 'https://project.supabase.co/rest/v1/rpc/reserve_receipt_scan');
    assertEquals(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assertEquals(headers.get('authorization'), 'Bearer service-role-test-key');
    assertEquals(headers.get('apikey'), 'service-role-test-key');
    requestBody = JSON.parse(String(init?.body));
    return Promise.resolve(Response.json(validPayload));
  }) as typeof fetch;

  const limiter = new SupabaseReceiptQuotaLimiter({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-role-test-key',
  }, fetchImpl);
  const result = await limiter.reserve(userId, new AbortController().signal);

  assertEquals(requestBody, { user_id_input: userId });
  assertEquals(result.remaining, 6);
});

Deno.test('quota client fails closed on an invalid response', async () => {
  const limiter = new SupabaseReceiptQuotaLimiter({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-role-test-key',
  }, (() => Promise.resolve(Response.json({ allowed: true }))) as typeof fetch);

  let thrown: unknown;
  try {
    await limiter.reserve(userId, new AbortController().signal);
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof SafeHttpError);
  assertEquals((thrown as SafeHttpError).status, 503);
});
