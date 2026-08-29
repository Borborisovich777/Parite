import type { AccessVerifier } from './auth.ts';
import type { ReceiptExtractionResult } from './contract.ts';
import { SafeHttpError, toSafeHttpError } from './errors.ts';
import { readStreamLimited } from './http.ts';
import { type ImageLimits, type ValidatedImage, validateImage } from './image.ts';
import type { ProviderInput } from './provider.ts';

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_CONTENT_TYPE_LENGTH = 300;

export type ReceiptHandlerConfig = {
  imageLimits: ImageLimits;
  requestTimeoutMs: number;
};

export type ReceiptExtractor = (
  input: ProviderInput,
  signal: AbortSignal,
) => Promise<ReceiptExtractionResult>;

export type ReceiptHandlerDependencies = {
  accessVerifier: AccessVerifier;
  extract: ReceiptExtractor;
  config: ReceiptHandlerConfig;
};

type ParsedReceiptForm = {
  tripId: string;
  bytes: Uint8Array;
  image: ValidatedImage;
};

export function createReceiptHandler(
  dependencies: ReceiptHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const headers = responseHeaders();
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return errorResponse(
        new SafeHttpError(405, 'method_not_allowed', 'Use POST to extract a receipt.'),
        headers,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), dependencies.config.requestTimeoutMs);
    const requestAbort = () => controller.abort();
    request.signal.addEventListener('abort', requestAbort, { once: true });
    let parsed: ParsedReceiptForm | undefined;

    try {
      // Reject missing/invalid/revoked sessions before buffering multipart bytes.
      const { userId } = await dependencies.accessVerifier.authenticate(request, controller.signal);
      parsed = await parseReceiptForm(request, dependencies.config.imageLimits, controller.signal);
      await dependencies.accessVerifier.verifyTripMembership(userId, parsed.tripId, controller.signal);
      const result = await dependencies.extract({
        bytes: parsed.bytes,
        contentType: parsed.image.contentType,
      }, controller.signal);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers,
      });
    } catch (error) {
      return errorResponse(toSafeHttpError(error), headers);
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', requestAbort);
      parsed?.bytes.fill(0);
      parsed = undefined;
    }
  };
}

export async function parseReceiptForm(
  request: Request,
  limits: ImageLimits,
  signal: AbortSignal,
): Promise<ParsedReceiptForm> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.length > MAX_CONTENT_TYPE_LENGTH || !isMultipartContentType(contentType)) {
    throw new SafeHttpError(400, 'invalid_request', 'Send one image as multipart form data.');
  }

  const maxRequestBytes = limits.maxBytes + MULTIPART_OVERHEAD_BYTES;
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new SafeHttpError(400, 'invalid_request', 'The request size is invalid.');
    }
    if (length > maxRequestBytes) {
      throw new SafeHttpError(413, 'image_too_large', 'The uploaded image is too large.');
    }
  }

  let requestBytes: Uint8Array | undefined;
  try {
    requestBytes = await readStreamLimited(request.body, maxRequestBytes, signal);
    let form: FormData;
    try {
      form = await new Request('https://receipt.invalid/', {
        method: 'POST',
        headers: { 'content-type': contentType },
        // readStreamLimited always returns a zero-offset ArrayBuffer-backed view.
        body: requestBytes.buffer as ArrayBuffer,
      }).formData();
    } catch {
      throw new SafeHttpError(400, 'invalid_request', 'The multipart request could not be read.');
    }

    let tripId: string | undefined;
    let imageFile: File | undefined;
    let entryCount = 0;
    for (const [name, value] of form.entries()) {
      entryCount += 1;
      if (name === 'trip_id' && typeof value === 'string' && tripId === undefined) {
        tripId = value.trim();
      } else if (name === 'image' && value instanceof File && imageFile === undefined) {
        imageFile = value;
      } else {
        throw new SafeHttpError(400, 'invalid_request', 'Send exactly one trip ID and one receipt image.');
      }
    }
    if (entryCount !== 2 || !tripId || !imageFile) {
      throw new SafeHttpError(400, 'invalid_request', 'Send exactly one trip ID and one receipt image.');
    }
    if (imageFile.size === 0 || imageFile.size > limits.maxBytes) {
      throw new SafeHttpError(
        imageFile.size > limits.maxBytes ? 413 : 400,
        imageFile.size > limits.maxBytes ? 'image_too_large' : 'invalid_image',
        imageFile.size > limits.maxBytes
          ? 'The uploaded image is too large.'
          : 'The selected image is empty.',
      );
    }

    const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
    try {
      const image = validateImage(imageBytes, imageFile.type.toLowerCase(), limits);
      return { tripId, bytes: imageBytes, image };
    } catch (error) {
      imageBytes.fill(0);
      throw error;
    }
  } finally {
    requestBytes?.fill(0);
    requestBytes = undefined;
  }
}

function isMultipartContentType(value: string): boolean {
  if (!/^multipart\/form-data\s*;/i.test(value)) return false;
  const boundary = value.match(/(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const token = boundary?.[1] ?? boundary?.[2] ?? '';
  return token.length >= 1 && token.length <= 70 && /^[\x20-\x7E]+$/.test(token);
}

function errorResponse(error: SafeHttpError, headers: Headers): Response {
  return new Response(JSON.stringify({ error: error.safeMessage }), {
    status: error.status,
    headers,
  });
}

function responseHeaders(): Headers {
  const headers = new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-max-age': '600',
    'cache-control': 'no-store, max-age=0',
    pragma: 'no-cache',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    vary: 'Origin',
  });
  return headers;
}
