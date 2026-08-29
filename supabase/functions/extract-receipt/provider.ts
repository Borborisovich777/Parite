import { assertReceiptExtractionResult, type ReceiptExtractionResult } from './contract.ts';
import { isAbortError, ProviderFailure } from './errors.ts';
import { delay } from './http.ts';
import type { AllowedImageType } from './image.ts';

export type ProviderInput = {
  bytes: Uint8Array;
  contentType: AllowedImageType;
};

export interface ReceiptProvider<Job> {
  start(input: ProviderInput, signal: AbortSignal): Promise<Job>;
  waitForResult(job: Job, signal: AbortSignal): Promise<unknown>;
  normalize(rawResult: unknown): ReceiptExtractionResult;
  deleteResult(job: Job, signal: AbortSignal): Promise<void>;
}

export type ProviderRunOptions = {
  cleanupTimeoutMs: number;
  cleanupAttempts: number;
  cleanupRetryDelayMs: number;
};

/**
 * The deletion attempt deliberately uses a fresh timeout instead of the caller's
 * signal. A browser cancellation or extraction timeout must not skip provider
 * cleanup after an analysis job has been created.
 */
export async function runProviderExtraction<Job>(
  provider: ReceiptProvider<Job>,
  input: ProviderInput,
  extractionSignal: AbortSignal,
  options: ProviderRunOptions,
): Promise<ReceiptExtractionResult> {
  let job: Job | undefined;
  let rawResult: unknown;
  let normalized: ReceiptExtractionResult | undefined;
  let primaryError: unknown;

  try {
    job = await provider.start(input, extractionSignal);
    rawResult = await provider.waitForResult(job, extractionSignal);
    normalized = provider.normalize(rawResult);
    try {
      assertReceiptExtractionResult(normalized);
    } catch {
      throw new ProviderFailure('malformed');
    }
  } catch (error) {
    primaryError = normalizeProviderError(error, extractionSignal);
  } finally {
    rawResult = undefined;
  }

  if (job !== undefined) {
    try {
      await deleteWithRetry(provider, job, options);
    } catch {
      // Privacy takes precedence over extraction. Never return receipt data if
      // the provider cannot confirm deletion of its temporary result.
      normalized = undefined;
      throw new ProviderFailure('deletion');
    }
  }

  if (primaryError) throw primaryError;
  if (!normalized) throw new ProviderFailure('malformed');
  return normalized;
}

async function deleteWithRetry<Job>(
  provider: ReceiptProvider<Job>,
  job: Job,
  options: ProviderRunOptions,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.cleanupTimeoutMs);
  try {
    let finalError: unknown;
    for (let attempt = 1; attempt <= options.cleanupAttempts; attempt += 1) {
      try {
        await provider.deleteResult(job, controller.signal);
        return;
      } catch (error) {
        finalError = error;
        const retryable = error instanceof ProviderFailure && error.retryable;
        if (!retryable || attempt === options.cleanupAttempts || controller.signal.aborted) break;
        await delay(options.cleanupRetryDelayMs * attempt, controller.signal);
      }
    }
    throw finalError;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProviderError(error: unknown, signal: AbortSignal): unknown {
  if (error instanceof ProviderFailure) return error;
  if (signal.aborted || isAbortError(error)) return new ProviderFailure('timeout');
  return new ProviderFailure('request');
}
