import { normalizeAzureReceipt } from '../providers/azure.ts';
import { assertEquals } from './assert.ts';

Deno.test('normalizes Azure prebuilt-receipt fields into the browser contract', () => {
  const result = normalizeAzureReceipt({
    status: 'succeeded',
    analyzeResult: {
      documents: [{
        fields: {
          MerchantName: { valueString: 'Corner Cafe' },
          TransactionDate: { valueDate: '2026-08-29' },
          Subtotal: { valueCurrency: { amount: 10, currencyCode: 'USD' } },
          Tax: { valueCurrency: { amount: 1, currencyCode: 'USD' } },
          Tip: { valueCurrency: { amount: 1.1, currencyCode: 'USD' } },
          Total: { valueCurrency: { amount: 12.1, currencyCode: 'USD' } },
          Items: {
            valueArray: [
              {
                valueObject: {
                  Description: { valueString: 'Burger', confidence: 0.96 },
                  Quantity: { valueNumber: 1 },
                  Price: { valueCurrency: { amount: 6.67 } },
                  TotalPrice: { valueCurrency: { amount: 6.67 }, confidence: 0.97 },
                },
              },
              {
                valueObject: {
                  Description: { valueString: 'Coffee', confidence: 0.94 },
                  Quantity: { valueNumber: 1 },
                  Price: { valueCurrency: { amount: 3.33 } },
                  TotalPrice: { valueCurrency: { amount: 3.33 }, confidence: 0.95 },
                },
              },
            ],
          },
        },
      }],
    },
  });

  assertEquals(result, {
    merchant: 'Corner Cafe',
    purchasedAt: '2026-08-29',
    currency: 'USD',
    subtotalMinor: 1_000,
    totalMinor: 1_210,
    items: [
      {
        id: 'item-1',
        rawName: 'Burger',
        quantity: '1',
        unitAmountMinor: 667,
        lineTotalMinor: 667,
        confidence: 0.96,
      },
      {
        id: 'item-2',
        rawName: 'Coffee',
        quantity: '1',
        unitAmountMinor: 333,
        lineTotalMinor: 333,
        confidence: 0.94,
      },
    ],
    adjustments: [
      { id: 'adjustment-1', kind: 'tax', label: 'Tax', amountMinor: 100, allocation: 'proportional' },
      { id: 'adjustment-2', kind: 'tip', label: 'Tip', amountMinor: 110, allocation: 'proportional' },
    ],
    warnings: [],
  });
});

Deno.test('adds a signed residual adjustment but never invents a line item', () => {
  const result = normalizeAzureReceipt({
    status: 'succeeded',
    analyzeResult: {
      documents: [{
        fields: {
          Total: { valueCurrency: { amount: 9, currencyCode: 'AED' } },
          Items: {
            valueArray: [{
              valueObject: {
                Description: { valueString: 'Lunch' },
                TotalPrice: { valueCurrency: { amount: 10 } },
              },
            }],
          },
        },
      }],
    },
  });

  assertEquals(result.adjustments, [{
    id: 'adjustment-1',
    kind: 'other',
    label: 'Unclassified receipt adjustment',
    amountMinor: -100,
    allocation: 'proportional',
  }]);
  assertEquals(result.items.length, 1);
});
