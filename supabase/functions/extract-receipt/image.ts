import { SafeHttpError } from './errors.ts';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export type ImageLimits = {
  maxBytes: number;
  maxPixels: number;
  maxEdge: number;
  minEdge: number;
};

export type ValidatedImage = {
  contentType: AllowedImageType;
  width: number;
  height: number;
};

export function validateImage(
  bytes: Uint8Array,
  declaredType: string,
  limits: ImageLimits,
): ValidatedImage {
  if (!ALLOWED_IMAGE_TYPES.includes(declaredType as AllowedImageType)) {
    throw new SafeHttpError(415, 'unsupported_media_type', 'Choose a JPG, PNG, or WebP image.');
  }
  if (bytes.byteLength === 0) {
    throw new SafeHttpError(400, 'invalid_image', 'The selected image is empty.');
  }
  if (bytes.byteLength > limits.maxBytes) {
    throw new SafeHttpError(413, 'image_too_large', 'The uploaded image is too large.');
  }

  const sniffedType = sniffImageType(bytes);
  if (sniffedType !== declaredType) {
    throw new SafeHttpError(415, 'unsupported_media_type', 'The image content does not match its file type.');
  }

  const dimensions = sniffedType === 'image/png'
    ? readPngDimensions(bytes)
    : sniffedType === 'image/jpeg'
    ? readJpegDimensions(bytes)
    : readWebpDimensions(bytes);

  if (!dimensions) {
    throw new SafeHttpError(400, 'invalid_image', 'The image dimensions could not be read.');
  }

  const { width, height } = dimensions;
  if (
    width < limits.minEdge || height < limits.minEdge ||
    width > limits.maxEdge || height > limits.maxEdge ||
    width * height > limits.maxPixels
  ) {
    throw new SafeHttpError(400, 'invalid_image', 'The image dimensions are outside the supported range.');
  }

  return { contentType: sniffedType, width, height };
}

export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 33 || ascii(bytes, 12, 4) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 > bytes.byteLength) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    if ((bytes[20] & 0x02) !== 0) return null; // Animated WebP is deliberately unsupported.
    return {
      width: 1 + readUint24LE(bytes, 24),
      height: 1 + readUint24LE(bytes, 27),
    };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    };
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
