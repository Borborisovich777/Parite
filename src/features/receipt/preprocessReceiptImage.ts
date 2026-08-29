const ACCEPTED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const MIN_LONG_EDGE = 640;
const TARGET_LONG_EDGE = 2_000;
const FALLBACK_LONG_EDGE = 1_600;
const TARGET_BYTES = 3 * 1024 * 1024;

export interface PreparedReceiptImage {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  originalBytes: number;
  preparedBytes: number;
  mimeType: 'image/jpeg';
}

const abortIfNeeded = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Receipt preparation was canceled.', 'AbortError');
};

const canvasToJpeg = (
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot prepare the receipt image.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      canvas.width = 0;
      canvas.height = 0;

      if (!blob) {
        reject(new Error('The receipt image could not be compressed.'));
        return;
      }

      resolve(blob);
    }, 'image/jpeg', quality);
  });
};

const calculateSize = (width: number, height: number, maxLongEdge: number) => {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };

  const ratio = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const createSafeFileName = (fileName: string) => {
  const baseName = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'receipt';

  return `${baseName}.jpg`;
};

export async function preprocessReceiptImage(
  file: File,
  signal?: AbortSignal,
): Promise<PreparedReceiptImage> {
  abortIfNeeded(signal);

  if (!ACCEPTED_RECEIPT_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP receipt image.');
  }

  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('The receipt image must be smaller than 15 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This receipt image could not be decoded. Try a JPG, PNG, or WebP file.');
  }

  try {
    abortIfNeeded(signal);

    const sourcePixels = bitmap.width * bitmap.height;
    const sourceLongEdge = Math.max(bitmap.width, bitmap.height);
    if (sourcePixels <= 0 || sourcePixels > MAX_SOURCE_PIXELS) {
      throw new Error('The receipt image dimensions are too large.');
    }

    if (sourceLongEdge < MIN_LONG_EDGE) {
      throw new Error('The receipt image is too small to read reliably.');
    }

    let dimensions = calculateSize(bitmap.width, bitmap.height, TARGET_LONG_EDGE);
    let blob = await canvasToJpeg(bitmap, dimensions.width, dimensions.height, 0.84);
    abortIfNeeded(signal);

    if (blob.size > TARGET_BYTES) {
      blob = await canvasToJpeg(bitmap, dimensions.width, dimensions.height, 0.72);
      abortIfNeeded(signal);
    }

    if (blob.size > TARGET_BYTES) {
      dimensions = calculateSize(bitmap.width, bitmap.height, FALLBACK_LONG_EDGE);
      blob = await canvasToJpeg(bitmap, dimensions.width, dimensions.height, 0.7);
      abortIfNeeded(signal);
    }

    if (blob.size > TARGET_BYTES) {
      throw new Error('The receipt remains too large after compression. Try a tighter photo.');
    }

    return {
      blob,
      fileName: createSafeFileName(file.name),
      width: dimensions.width,
      height: dimensions.height,
      originalBytes: file.size,
      preparedBytes: blob.size,
      mimeType: 'image/jpeg',
    };
  } finally {
    bitmap.close();
  }
}

export const receiptImageLimits = {
  acceptedTypes: [...ACCEPTED_RECEIPT_TYPES],
  maxSourceBytes: MAX_SOURCE_BYTES,
  maxSourcePixels: MAX_SOURCE_PIXELS,
  minLongEdge: MIN_LONG_EDGE,
  targetLongEdge: TARGET_LONG_EDGE,
  targetBytes: TARGET_BYTES,
} as const;
