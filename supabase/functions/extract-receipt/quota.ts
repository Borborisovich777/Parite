import { isUuid } from './auth.ts';
import { SafeHttpError } from './errors.ts';
import { readJsonResponseLimited } from './http.ts';

const MAX_QUOTA_RESPONSE_BYTES = 16 * 1024;
const MAX_USER_QUOTA = 100;

export type ReceiptQuotaReason = 'user_limit' | 'global_limit';

export type ReceiptQuotaReservation = {
  allowed: boolean;
  reason: ReceiptQuotaReason | null;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

export interface ReceiptQuotaLimiter {
  reserve(userId: string, signal: AbortSignal): Promise<ReceiptQuotaReservation>;
}

type SupabaseQuotaConfig = {
  url: string;
  serviceRoleKey: string;
};

export class SupabaseReceiptQuotaLimiter implements ReceiptQuotaLimiter {
  private readonly baseUrl: URL;

  constructor(
    private readonly config: SupabaseQuotaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = validateSupabaseUrl(config.url);
    if (!config.serviceRoleKey) throw new Error('missing Supabase configuration');
  }

  async reserve(userId: string, signal: AbortSignal): Promise<ReceiptQuotaReservation> {
    if (!isUuid(userId)) throw quotaUnavailable();

    const url = new URL('/rest/v1/rpc/reserve_receipt_scan', this.baseUrl);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.serviceRoleKey}`,
          apikey: this.config.serviceRoleKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ user_id_input: userId }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw quotaUnavailable();
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw quotaUnavailable();
    }

    let payload: unknown;
    try {
      payload = await readJsonResponseLimited(response, MAX_QUOTA_RESPONSE_BYTES);
    } catch {
      throw quotaUnavailable();
    }

    const quota = parseQuotaReservation(payload);
    if (!quota) throw quotaUnavailable();
    return quota;
  }
}

export function parseQuotaReservation(value: unknown): ReceiptQuotaReservation | null {
  if (!isRecord(value)) return null;

  const allowed = value.allowed;
  const reason = value.reason;
  const limit = value.limit;
  const used = value.used;
  const remaining = value.remaining;
  const resetAt = value.reset_at;

  if (typeof allowed !== 'boolean') return null;
  if (reason !== null && reason !== 'user_limit' && reason !== 'global_limit') return null;
  if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_USER_QUOTA) {
    return null;
  }
  if (!Number.isSafeInteger(used) || (used as number) < 0 || (used as number) > (limit as number)) {
    return null;
  }
  if (
    !Number.isSafeInteger(remaining) || (remaining as number) < 0 ||
    (remaining as number) !== (limit as number) - (used as number)
  ) {
    return null;
  }
  if (typeof resetAt !== 'string' || !isIsoUtcTimestamp(resetAt)) return null;
  if ((allowed && reason !== null) || (!allowed && reason === null)) return null;
  if (reason === 'user_limit' && remaining !== 0) return null;

  return {
    allowed,
    reason,
    limit: limit as number,
    used: used as number,
    remaining: remaining as number,
    resetAt,
  };
}

function quotaUnavailable(): SafeHttpError {
  return new SafeHttpError(
    503,
    'extraction_unavailable',
    'Receipt scanning is temporarily unavailable. You can still enter the expense manually.',
  );
}

function validateSupabaseUrl(value: string): URL {
  const url = new URL(value);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) throw new Error('invalid Supabase URL');
  if (url.username || url.password || url.search || url.hash) throw new Error('invalid Supabase URL');
  return url;
}

function isIsoUtcTimestamp(value: string): boolean {
  if (value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value)) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
