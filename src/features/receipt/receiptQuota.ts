const MAX_USER_RECEIPT_SCANS = 100;

export type ReceiptQuotaReason = 'user_limit' | 'global_limit';

export interface ReceiptQuotaStatus {
  available: boolean;
  reason: ReceiptQuotaReason | null;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export async function getMyReceiptScanQuota(): Promise<ReceiptQuotaStatus> {
  // Keep the pure parsers usable in the Node test runner, where Vite's
  // import.meta.env object is not installed.
  const { requireSupabase } = await import('../../lib/supabase');
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_receipt_scan_quota');
  if (error) throw new Error('Receipt scan availability could not be checked.');

  const quota = parseReceiptQuotaStatus(data);
  if (!quota) throw new Error('Receipt scan availability returned an invalid response.');
  return quota;
}

export function parseReceiptQuotaStatus(value: unknown): ReceiptQuotaStatus | null {
  if (!isRecord(value)) return null;

  return validateQuota({
    available: value.available,
    reason: value.reason,
    limit: value.limit,
    used: value.used,
    remaining: value.remaining,
    resetAt: value.reset_at,
  });
}

export function parseReceiptQuotaHeaders(
  headers: Headers,
  deniedReason?: ReceiptQuotaReason,
): ReceiptQuotaStatus | null {
  const limit = parseHeaderInteger(headers.get('x-receipt-scans-limit'));
  const remaining = parseHeaderInteger(headers.get('x-receipt-scans-remaining'));
  const resetAt = headers.get('x-receipt-scans-reset-at');
  if (limit === null || remaining === null || resetAt === null) return null;

  const exhausted = remaining === 0;
  const reason = deniedReason ?? (exhausted ? 'user_limit' : null);
  return validateQuota({
    available: deniedReason === undefined && !exhausted,
    reason,
    limit,
    used: limit - remaining,
    remaining,
    resetAt,
  });
}

export function parseReceiptQuotaForResponse(
  headers: Headers,
  errorCode: string | null = null,
): ReceiptQuotaStatus | null {
  const deniedReason = errorCode === 'receipt_quota_exceeded'
    ? 'user_limit'
    : errorCode === 'receipt_capacity_reached'
      ? 'global_limit'
      : undefined;
  return parseReceiptQuotaHeaders(headers, deniedReason);
}

function validateQuota(value: {
  available: unknown;
  reason: unknown;
  limit: unknown;
  used: unknown;
  remaining: unknown;
  resetAt: unknown;
}): ReceiptQuotaStatus | null {
  const { available, reason, limit, used, remaining, resetAt } = value;
  if (typeof available !== 'boolean') return null;
  if (reason !== null && reason !== 'user_limit' && reason !== 'global_limit') return null;
  if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_USER_RECEIPT_SCANS) {
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
  if ((available && reason !== null) || (!available && reason === null)) return null;
  if (reason === 'user_limit' && remaining !== 0) return null;

  return {
    available,
    reason: reason as ReceiptQuotaReason | null,
    limit: limit as number,
    used: used as number,
    remaining: remaining as number,
    resetAt,
  };
}

function parseHeaderInteger(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
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
