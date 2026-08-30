export type SafeErrorCode =
  | 'authentication_required'
  | 'account_access_denied'
  | 'trip_access_denied'
  | 'invalid_request'
  | 'unsupported_media_type'
  | 'image_too_large'
  | 'invalid_image'
  | 'request_timeout'
  | 'extraction_unavailable'
  | 'extraction_failed'
  | 'malformed_extraction'
  | 'privacy_cleanup_failed'
  | 'receipt_quota_exceeded'
  | 'receipt_capacity_reached'
  | 'method_not_allowed';

export class SafeHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: SafeErrorCode,
    public readonly safeMessage: string,
  ) {
    super(code);
    this.name = 'SafeHttpError';
  }
}

export type ProviderFailureKind =
  | 'configuration'
  | 'timeout'
  | 'request'
  | 'malformed'
  | 'deletion';

export class ProviderFailure extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    public readonly retryable = false,
  ) {
    super(kind);
    this.name = 'ProviderFailure';
  }
}

export function toSafeHttpError(error: unknown): SafeHttpError {
  if (error instanceof SafeHttpError) return error;

  if (error instanceof ProviderFailure) {
    if (error.kind === 'configuration') {
      return new SafeHttpError(503, 'extraction_unavailable', 'Receipt scanning is not configured.');
    }
    if (error.kind === 'timeout') {
      return new SafeHttpError(
        504,
        'request_timeout',
        'Receipt extraction timed out. Try again or enter it manually.',
      );
    }
    if (error.kind === 'malformed') {
      return new SafeHttpError(
        502,
        'malformed_extraction',
        'The receipt service returned an unusable result.',
      );
    }
    if (error.kind === 'deletion') {
      return new SafeHttpError(
        502,
        'privacy_cleanup_failed',
        'The temporary provider result could not be deleted. No receipt data was returned.',
      );
    }
    return new SafeHttpError(
      502,
      'extraction_failed',
      'The receipt could not be read. Try again or enter it manually.',
    );
  }

  if (isAbortError(error)) {
    return new SafeHttpError(
      504,
      'request_timeout',
      'Receipt extraction timed out. Try again or enter it manually.',
    );
  }

  return new SafeHttpError(500, 'extraction_failed', 'The receipt could not be processed.');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
