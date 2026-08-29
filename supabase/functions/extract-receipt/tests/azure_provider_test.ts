import { runProviderExtraction } from '../provider.ts';
import { AzureReceiptProvider } from '../providers/azure.ts';
import { assert, assertEquals } from './assert.ts';

const endpoint = 'https://parite-test.cognitiveservices.azure.com';
const operationId = '3b31320d-8bab-4f88-b19c-2322a7f11034';
const operationUrl =
  `${endpoint}/documentintelligence/documentModels/prebuilt-receipt/analyzeResults/${operationId}?api-version=2024-11-30`;

Deno.test('Azure stream endpoint is polled and deleted before normalized data returns', async () => {
  const calls: Array<{ method: string; url: string }> = [];
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url });
    if (method === 'POST') {
      assert(init?.body instanceof ArrayBuffer);
      assertEquals(new Headers(init.headers).get('content-type'), 'image/png');
      return Promise.resolve(
        new Response(null, {
          status: 202,
          headers: { 'operation-location': operationUrl },
        }),
      );
    }
    if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(Response.json({
      status: 'succeeded',
      analyzeResult: {
        documents: [{
          fields: {
            Total: { valueCurrency: { amount: 2.5, currencyCode: 'AED' } },
            Items: {
              valueArray: [{
                valueObject: {
                  Description: { valueString: 'Juice' },
                  TotalPrice: { valueCurrency: { amount: 2.5 } },
                },
              }],
            },
          },
        }],
      },
    }));
  }) as typeof fetch;

  const provider = new AzureReceiptProvider({
    endpoint,
    key: 'test-key-not-a-secret',
    maxPolls: 2,
    pollIntervalMs: 100,
  }, fetchImpl);
  const result = await runProviderExtraction(
    provider,
    { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' },
    new AbortController().signal,
    { cleanupTimeoutMs: 1_000, cleanupAttempts: 2, cleanupRetryDelayMs: 1 },
  );

  assertEquals(result.totalMinor, 250);
  assertEquals(calls, [
    {
      method: 'POST',
      url: `${endpoint}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30`,
    },
    { method: 'GET', url: operationUrl },
    { method: 'DELETE', url: operationUrl },
  ]);
});
