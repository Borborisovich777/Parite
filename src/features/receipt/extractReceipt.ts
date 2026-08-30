import { requireSupabase } from '../../lib/supabase';
import type { ReceiptExtractionResult } from './types';
import type { PreparedReceiptImage } from './preprocessReceiptImage';
import { isReceiptImportMockEnabled } from './config';
import {
  parseReceiptQuotaHeaders,
  parseReceiptQuotaForResponse,
  type ReceiptQuotaStatus,
} from './receiptQuota';
import { parseReceiptExtractionResult } from './validation';

interface ExtractReceiptInput {
  tripId: string;
  image: PreparedReceiptImage;
  signal?: AbortSignal;
}

export interface ExtractReceiptResult {
  receipt: ReceiptExtractionResult;
  quota?: ReceiptQuotaStatus;
}

export class ReceiptExtractionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly quota?: ReceiptQuotaStatus,
  ) {
    super(message);
    this.name = 'ReceiptExtractionError';
  }
}

const MAX_EXTRACTION_RESPONSE_BYTES = 512 * 1024;

const readBoundedJson = async (response: Response): Promise<unknown> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EXTRACTION_RESPONSE_BYTES) {
    throw new Error('Receipt extraction returned too much data. Try again or enter it manually.');
  }

  if (!response.body) throw new Error('Receipt extraction returned an empty response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_EXTRACTION_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Receipt extraction returned too much data. Try again or enter it manually.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Receipt extraction returned an unreadable response. Try again or enter it manually.');
  }
};

const mockReceipt = (): ReceiptExtractionResult => ({
  merchant: 'Orfali Bros',
  purchasedAt: new Date().toISOString().slice(0, 10),
  currency: 'AED',
  subtotalMinor: 15_200,
  totalMinor: 16_720,
  items: [
    { id: 'item-1', rawName: 'Chicken burger', lineTotalMinor: 5_200, confidence: 0.97 },
    { id: 'item-2', rawName: 'Fattoush salad', lineTotalMinor: 3_600, confidence: 0.94 },
    { id: 'item-3', rawName: 'Sparkling water', lineTotalMinor: 1_800, confidence: 0.89 },
    { id: 'item-4', rawName: 'Date dessert', lineTotalMinor: 4_600, confidence: 0.91 },
  ],
  adjustments: [
    {
      id: 'adjustment-1',
      kind: 'service',
      label: 'Service charge',
      amountMinor: 1_520,
      allocation: 'proportional',
    },
  ],
  warnings: [],
});

const waitForMock = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Receipt extraction was canceled.', 'AbortError'));
    return;
  }

  const handleComplete = () => {
    signal?.removeEventListener('abort', handleAbort);
    resolve();
  };
  const timeoutId = window.setTimeout(handleComplete, 650);
  const handleAbort = () => {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleAbort);
    reject(new DOMException('Receipt extraction was canceled.', 'AbortError'));
  };
  signal?.addEventListener('abort', handleAbort, { once: true });
});

const getErrorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const message = (value as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
};

const getErrorCode = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' && /^[a-z_]{1,64}$/.test(code) ? code : null;
};

export async function extractReceipt({
  tripId,
  image,
  signal,
}: ExtractReceiptInput): Promise<ExtractReceiptResult> {
  if (isReceiptImportMockEnabled) {
    await waitForMock(signal);
    return { receipt: mockReceipt() };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error('Receipt scanning is not configured yet. You can still enter the expense manually.');
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Sign in again before scanning a receipt.');
  }

  const formData = new FormData();
  formData.append('trip_id', tripId);
  formData.append('image', image.blob, image.fileName);

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/extract-receipt`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: formData,
    signal,
  });

  let payload: unknown;
  try {
    payload = await readBoundedJson(response);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Receipt extraction')) throw error;
    throw new Error('Receipt extraction returned an unreadable response. Try again or enter it manually.');
  }

  if (!response.ok) {
    const code = getErrorCode(payload);
    const quota = parseReceiptQuotaForResponse(response.headers, code) ?? undefined;
    throw new ReceiptExtractionError(
      getErrorMessage(payload) ?? 'The receipt could not be read. Try again or enter it manually.',
      response.status,
      code,
      quota,
    );
  }

  const parsed = parseReceiptExtractionResult(payload);
  if (!parsed.ok) {
    throw new Error('The receipt result was incomplete. Try again or enter it manually.');
  }

  return {
    receipt: parsed.value,
    quota: parseReceiptQuotaHeaders(response.headers) ?? undefined,
  };
}
