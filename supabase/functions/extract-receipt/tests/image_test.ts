import { SafeHttpError } from '../errors.ts';
import { validateImage } from '../image.ts';
import { assertEquals, assertRejects } from './assert.ts';

const limits = { maxBytes: 1024, maxPixels: 2_000_000, maxEdge: 2_000, minEdge: 64 };

Deno.test('validates PNG magic and dimensions without decoding or persisting it', () => {
  const image = pngHeader(800, 1_600);
  assertEquals(validateImage(image, 'image/png', limits), {
    contentType: 'image/png',
    width: 800,
    height: 1_600,
  });
});

Deno.test('rejects a declared MIME type that does not match the image bytes', async () => {
  await assertRejects(
    () => Promise.resolve(validateImage(pngHeader(800, 1_600), 'image/jpeg', limits)),
    (error) => error instanceof SafeHttpError && error.code === 'unsupported_media_type',
  );
});

Deno.test('rejects excessive decoded dimensions even when encoded bytes are small', async () => {
  await assertRejects(
    () => Promise.resolve(validateImage(pngHeader(4_000, 4_000), 'image/png', limits)),
    (error) => error instanceof SafeHttpError && error.code === 'invalid_image',
  );
});

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 2;
  return bytes;
}
