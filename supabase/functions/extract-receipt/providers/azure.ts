import {
  isSupportedCurrency,
  type ReceiptAdjustment,
  type ReceiptExtractionResult,
  type ReceiptItemCandidate,
} from '../contract.ts';
import { ProviderFailure } from '../errors.ts';
import { delay, readJsonResponseLimited } from '../http.ts';
import type { ProviderInput, ReceiptProvider } from '../provider.ts';

const MODEL_ID = 'prebuilt-receipt';
const DEFAULT_API_VERSION = '2024-11-30';
const MAX_PROVIDER_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_MINOR_AMOUNT = 1_000_000_000_000;

export type AzureReceiptJob = {
  operationUrl: string;
};

export type AzureReceiptConfig = {
  endpoint: string;
  key: string;
  apiVersion?: string;
  maxPolls: number;
  pollIntervalMs: number;
};

export class AzureReceiptProvider implements ReceiptProvider<AzureReceiptJob> {
  private readonly endpoint: URL;
  private readonly apiVersion: string;
  private readonly expectedOperationPathPrefix: string;

  constructor(
    private readonly config: AzureReceiptConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.endpoint = validateEndpoint(config.endpoint);
    if (!config.key) throw new ProviderFailure('configuration');
    this.apiVersion = config.apiVersion || DEFAULT_API_VERSION;
    if (!/^\d{4}-\d{2}-\d{2}(?:-preview)?$/.test(this.apiVersion)) {
      throw new ProviderFailure('configuration');
    }
    if (
      !Number.isSafeInteger(config.maxPolls) || config.maxPolls < 1 || config.maxPolls > 60 ||
      !Number.isSafeInteger(config.pollIntervalMs) || config.pollIntervalMs < 100 ||
      config.pollIntervalMs > 5_000
    ) {
      throw new ProviderFailure('configuration');
    }
    const basePath = this.endpoint.pathname.replace(/\/$/, '');
    this.expectedOperationPathPrefix =
      `${basePath}/documentintelligence/documentModels/${MODEL_ID}/analyzeResults/`;
  }

  async start(input: ProviderInput, signal: AbortSignal): Promise<AzureReceiptJob> {
    const url = new URL(this.endpoint);
    url.pathname = `${
      url.pathname.replace(/\/$/, '')
    }/documentintelligence/documentModels/${MODEL_ID}:analyze`;
    url.searchParams.set('api-version', this.apiVersion);

    let response: Response;
    // Keep an independently wipeable request buffer because BodyInit's DOM type
    // requires an ArrayBuffer-backed value in Deno's strict configuration.
    const requestBody = new Uint8Array(input.bytes);
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': input.contentType,
          'ocp-apim-subscription-key': this.config.key,
        },
        body: requestBody.buffer,
        signal,
      });
    } catch {
      if (signal.aborted) throw new ProviderFailure('timeout');
      throw new ProviderFailure('request', true);
    } finally {
      requestBody.fill(0);
    }

    if (response.status !== 202) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderFailure('request', response.status === 429 || response.status >= 500);
    }
    await response.body?.cancel().catch(() => undefined);

    const operationLocation = response.headers.get('operation-location');
    if (!operationLocation) throw new ProviderFailure('malformed');
    return { operationUrl: this.validateOperationUrl(operationLocation).toString() };
  }

  async waitForResult(job: AzureReceiptJob, signal: AbortSignal): Promise<unknown> {
    for (let poll = 0; poll < this.config.maxPolls; poll += 1) {
      if (poll > 0) await delay(this.config.pollIntervalMs, signal);

      let response: Response;
      try {
        response = await this.fetchImpl(job.operationUrl, {
          headers: {
            'ocp-apim-subscription-key': this.config.key,
            accept: 'application/json',
          },
          signal,
        });
      } catch {
        if (signal.aborted) throw new ProviderFailure('timeout');
        throw new ProviderFailure('request', true);
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new ProviderFailure('request', response.status === 429 || response.status >= 500);
      }

      let payload: unknown;
      try {
        payload = await readJsonResponseLimited(response, MAX_PROVIDER_RESPONSE_BYTES);
      } catch {
        throw new ProviderFailure('malformed');
      }
      const payloadRecord = record(payload);
      const status = typeof payloadRecord.status === 'string' ? payloadRecord.status.toLowerCase() : '';
      if (status === 'succeeded') return payload;
      if (status === 'failed') throw new ProviderFailure('request');
      if (status !== 'running' && status !== 'notstarted') throw new ProviderFailure('malformed');
    }
    throw new ProviderFailure('timeout');
  }

  normalize(rawResult: unknown): ReceiptExtractionResult {
    return normalizeAzureReceipt(rawResult);
  }

  async deleteResult(job: AzureReceiptJob, signal: AbortSignal): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImpl(job.operationUrl, {
        method: 'DELETE',
        headers: { 'ocp-apim-subscription-key': this.config.key },
        signal,
      });
    } catch {
      throw new ProviderFailure('deletion', !signal.aborted);
    }

    await response.body?.cancel().catch(() => undefined);
    // Azure v4 documents 204 as the only success response. A 404 is also a
    // confirmed absence and is safe for an idempotent cleanup retry.
    if (response.status === 204 || response.status === 404) return;
    const retryable = response.status === 409 || response.status === 429 || response.status >= 500;
    throw new ProviderFailure('deletion', retryable);
  }

  private validateOperationUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ProviderFailure('malformed');
    }
    if (
      url.protocol !== 'https:' || url.origin !== this.endpoint.origin || url.username || url.password ||
      url.hash ||
      !url.pathname.startsWith(this.expectedOperationPathPrefix)
    ) {
      throw new ProviderFailure('malformed');
    }
    const resultId = url.pathname.slice(this.expectedOperationPathPrefix.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resultId)) {
      throw new ProviderFailure('malformed');
    }
    if (url.searchParams.get('api-version') !== this.apiVersion) throw new ProviderFailure('malformed');
    for (const key of url.searchParams.keys()) {
      if (key !== 'api-version') throw new ProviderFailure('malformed');
    }
    return url;
  }
}

export function normalizeAzureReceipt(rawResult: unknown): ReceiptExtractionResult {
  const root = record(rawResult);
  if (typeof root.status !== 'string' || root.status.toLowerCase() !== 'succeeded') {
    throw new ProviderFailure('malformed');
  }
  const analyzeResult = record(root.analyzeResult);
  const documents = Array.isArray(analyzeResult.documents) ? analyzeResult.documents : [];
  const document = record(documents[0]);
  const fields = record(document.fields);

  const totalMinor = moneyMinor(fields.Total);
  if (totalMinor === undefined || totalMinor <= 0) throw new ProviderFailure('malformed');

  const warnings: string[] = [];
  const merchant = cleanText(fieldString(fields.MerchantName), 200);
  const purchasedAt = dateValue(fields.TransactionDate);
  const subtotalMinor = moneyMinor(fields.Subtotal);
  const currencyCode = currencyValue(fields.Total) ??
    cleanText(fieldString(fields.Currency), 8)?.toUpperCase();
  const currency = currencyCode && isSupportedCurrency(currencyCode) ? currencyCode : undefined;
  if (currencyCode && !currency) {
    warnings.push('The detected currency is unsupported. Choose AED, CNY, KZT, or USD.');
  }
  if (!currencyCode) warnings.push('Check the receipt currency before continuing.');

  const { items, omitted, lowConfidence } = extractItems(fields.Items);
  if (items.length === 0) warnings.push('No usable line items were detected.');
  if (omitted) {
    warnings.push('Some line items were omitted because they did not contain a usable name and total.');
  }

  const adjustments: ReceiptAdjustment[] = [];
  addAdjustment(adjustments, fields, ['TotalTax', 'Tax'], 'tax', 'Tax', false);
  addAdjustment(adjustments, fields, ['Tip'], 'tip', 'Tip', false);
  addAdjustment(
    adjustments,
    fields,
    ['ServiceCharge', 'ServiceChargeAmount'],
    'service',
    'Service charge',
    false,
  );
  addAdjustment(adjustments, fields, ['TotalDiscount', 'Discount'], 'discount', 'Discount', true);
  addAdjustment(adjustments, fields, ['Rounding'], 'rounding', 'Rounding', false);

  const itemSum = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const adjustmentSum = adjustments.reduce((sum, adjustment) => sum + adjustment.amountMinor, 0);
  if (items.length > 0) {
    if (subtotalMinor !== undefined && subtotalMinor !== itemSum) {
      warnings.push('Detected line items do not match the detected subtotal.');
    }
    const residual = totalMinor - itemSum - adjustmentSum;
    if (residual !== 0) {
      adjustments.push({
        id: `adjustment-${adjustments.length + 1}`,
        kind: 'other',
        label: 'Unclassified receipt adjustment',
        amountMinor: residual,
        allocation: 'proportional',
      });
      warnings.push('An unclassified adjustment was added so the extracted rows match the total.');
    }
  }
  if (lowConfidence) warnings.push('Check fields marked with low confidence before continuing.');

  return {
    ...(merchant ? { merchant } : {}),
    ...(purchasedAt ? { purchasedAt } : {}),
    ...(currency ? { currency } : {}),
    ...(subtotalMinor !== undefined ? { subtotalMinor } : {}),
    totalMinor,
    items,
    adjustments,
    warnings,
  };
}

function extractItems(value: unknown): {
  items: ReceiptItemCandidate[];
  omitted: boolean;
  lowConfidence: boolean;
} {
  const field = record(value);
  const candidates = Array.isArray(field.valueArray) ? field.valueArray.slice(0, 500) : [];
  const items: ReceiptItemCandidate[] = [];
  let omitted = Array.isArray(field.valueArray) && field.valueArray.length > 500;
  let lowConfidence = false;

  for (const candidate of candidates) {
    const object = record(record(candidate).valueObject);
    const name = cleanText(fieldString(object.Description), 500);
    const quantity = cleanText(fieldDisplayValue(object.Quantity), 80);
    const unitAmountMinor = moneyMinor(object.Price);
    let lineTotalMinor = moneyMinor(object.TotalPrice);
    if (lineTotalMinor === undefined && unitAmountMinor !== undefined) {
      const numericQuantity = fieldNumber(object.Quantity);
      lineTotalMinor = numericQuantity !== undefined
        ? safeMinorProduct(unitAmountMinor, numericQuantity)
        : unitAmountMinor;
    }
    if (!name || lineTotalMinor === undefined || lineTotalMinor < 0) {
      omitted = true;
      continue;
    }
    const confidence = minConfidence(object.Description, object.TotalPrice ?? object.Price);
    if (confidence !== undefined && confidence < 0.8) lowConfidence = true;
    items.push({
      id: `item-${items.length + 1}`,
      rawName: name,
      ...(quantity ? { quantity } : {}),
      ...(unitAmountMinor !== undefined ? { unitAmountMinor } : {}),
      lineTotalMinor,
      ...(confidence !== undefined ? { confidence } : {}),
    });
  }
  return { items, omitted, lowConfidence };
}

function addAdjustment(
  output: ReceiptAdjustment[],
  fields: Record<string, unknown>,
  aliases: string[],
  kind: ReceiptAdjustment['kind'],
  label: string,
  forceNegative: boolean,
): void {
  const field = aliases.map((alias) => fields[alias]).find((candidate) =>
    moneyMinor(candidate) !== undefined
  );
  const amount = moneyMinor(field);
  if (amount === undefined || amount === 0) return;
  output.push({
    id: `adjustment-${output.length + 1}`,
    kind,
    label,
    amountMinor: forceNegative ? -Math.abs(amount) : amount,
    allocation: 'proportional',
  });
}

function moneyMinor(value: unknown): number | undefined {
  const field = record(value);
  const currency = record(field.valueCurrency);
  const amount = typeof currency.amount === 'number'
    ? currency.amount
    : typeof field.valueNumber === 'number'
    ? field.valueNumber
    : undefined;
  if (amount === undefined || !Number.isFinite(amount) || Math.abs(amount) > MAX_MINOR_AMOUNT / 100) {
    return undefined;
  }
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : undefined;
}

function currencyValue(value: unknown): string | undefined {
  const currency = record(record(value).valueCurrency);
  return typeof currency.currencyCode === 'string' ? currency.currencyCode.trim().toUpperCase() : undefined;
}

function fieldString(value: unknown): string | undefined {
  const field = record(value);
  if (typeof field.valueString === 'string') return field.valueString;
  return typeof field.content === 'string' ? field.content : undefined;
}

function fieldNumber(value: unknown): number | undefined {
  const field = record(value);
  return typeof field.valueNumber === 'number' && Number.isFinite(field.valueNumber)
    ? field.valueNumber
    : undefined;
}

function fieldDisplayValue(value: unknown): string | undefined {
  const field = record(value);
  if (typeof field.content === 'string') return field.content;
  if (typeof field.valueNumber === 'number' && Number.isFinite(field.valueNumber)) {
    return String(field.valueNumber);
  }
  return undefined;
}

function dateValue(value: unknown): string | undefined {
  const field = record(value);
  const candidate = typeof field.valueDate === 'string' ? field.valueDate : undefined;
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : undefined;
}

function minConfidence(...values: unknown[]): number | undefined {
  const confidences = values.map((value) => record(value).confidence)
    .filter((value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    );
  return confidences.length ? Math.min(...confidences) : undefined;
}

function safeMinorProduct(unitMinor: number, quantity: number): number | undefined {
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100_000) return undefined;
  const result = Math.round(unitMinor * quantity);
  return Number.isSafeInteger(result) && result <= MAX_MINOR_AMOUNT ? result : undefined;
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .slice(0, maxLength * 4)
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127);
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validateEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderFailure('configuration');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new ProviderFailure('configuration');
  }
  return url;
}
