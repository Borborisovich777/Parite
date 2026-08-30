import { type AccessVerifier, SupabaseAccessVerifier } from './auth.ts';
import { ProviderFailure, SafeHttpError } from './errors.ts';
import { createReceiptHandler, type ReceiptExtractor } from './handler.ts';
import { runProviderExtraction } from './provider.ts';
import { AzureReceiptProvider } from './providers/azure.ts';
import { type ReceiptQuotaLimiter, SupabaseReceiptQuotaLimiter } from './quota.ts';

const config = {
  imageLimits: {
    maxBytes: boundedEnvInteger('RECEIPT_MAX_IMAGE_BYTES', 4 * 1024 * 1024, 256 * 1024, 10 * 1024 * 1024),
    maxPixels: boundedEnvInteger('RECEIPT_MAX_IMAGE_PIXELS', 20_000_000, 500_000, 40_000_000),
    maxEdge: boundedEnvInteger('RECEIPT_MAX_IMAGE_EDGE', 8_000, 1_000, 10_000),
    minEdge: boundedEnvInteger('RECEIPT_MIN_IMAGE_EDGE', 64, 32, 500),
  },
  requestTimeoutMs: boundedEnvInteger('RECEIPT_REQUEST_TIMEOUT_MS', 30_000, 10_000, 45_000),
};

let cachedAccessVerifier: SupabaseAccessVerifier | undefined;
let cachedQuotaLimiter: SupabaseReceiptQuotaLimiter | undefined;
let cachedProvider: AzureReceiptProvider | undefined;

const accessVerifier: AccessVerifier = {
  authenticate(request, signal) {
    return getAccessVerifier().authenticate(request, signal);
  },
  verifyTripMembership(userId, tripId, signal) {
    return getAccessVerifier().verifyTripMembership(userId, tripId, signal);
  },
};

const quotaLimiter: ReceiptQuotaLimiter = {
  reserve(userId, signal) {
    return getQuotaLimiter().reserve(userId, signal);
  },
};

const extract: ReceiptExtractor = async (input, signal) => {
  return await runProviderExtraction(getProvider(), input, signal, {
    cleanupTimeoutMs: boundedEnvInteger('RECEIPT_DELETE_TIMEOUT_MS', 5_000, 1_000, 10_000),
    cleanupAttempts: boundedEnvInteger('RECEIPT_DELETE_MAX_ATTEMPTS', 3, 1, 5),
    cleanupRetryDelayMs: boundedEnvInteger('RECEIPT_DELETE_RETRY_DELAY_MS', 250, 100, 1_000),
  });
};

Deno.serve(createReceiptHandler({
  accessVerifier,
  quotaLimiter,
  assertReady: () => void getProvider(),
  extract,
  config,
}));

function getAccessVerifier(): SupabaseAccessVerifier {
  if (cachedAccessVerifier) return cachedAccessVerifier;
  try {
    cachedAccessVerifier = new SupabaseAccessVerifier({
      url: Deno.env.get('SUPABASE_URL') ?? '',
      anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    });
    return cachedAccessVerifier;
  } catch {
    throw new SafeHttpError(503, 'extraction_unavailable', 'Receipt scanning is not configured.');
  }
}

function getQuotaLimiter(): SupabaseReceiptQuotaLimiter {
  if (cachedQuotaLimiter) return cachedQuotaLimiter;
  try {
    cachedQuotaLimiter = new SupabaseReceiptQuotaLimiter({
      url: Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    });
    return cachedQuotaLimiter;
  } catch {
    throw new SafeHttpError(503, 'extraction_unavailable', 'Receipt scanning is not configured.');
  }
}

function getProvider(): AzureReceiptProvider {
  if (cachedProvider) return cachedProvider;
  const providerName = (Deno.env.get('RECEIPT_PROVIDER') ?? '').trim().toLowerCase();
  if (providerName !== 'azure') throw new ProviderFailure('configuration');

  cachedProvider = new AzureReceiptProvider({
    endpoint: Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT') ?? '',
    key: Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY') ?? '',
    apiVersion: Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_API_VERSION') || undefined,
    maxPolls: boundedEnvInteger('RECEIPT_PROVIDER_MAX_POLLS', 20, 1, 40),
    // Azure F0 permits one result GET per second. Keep headroom for timer jitter.
    pollIntervalMs: boundedEnvInteger('RECEIPT_PROVIDER_POLL_INTERVAL_MS', 1_100, 1_100, 2_000),
  });
  return cachedProvider;
}

function boundedEnvInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
