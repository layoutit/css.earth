import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { frameObjectThumbnail, OBJECT_THUMBNAIL_MARGIN, OBJECT_THUMBNAIL_PIXELS } from './object-thumbnail.ts';

const size = OBJECT_THUMBNAIL_PIXELS;
/** An opaque photograph: `level(x, y)` in 0..1 of an orange light on black sky. */
const photograph = (width: number, height: number, level: (x: number, y: number) => number) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = level(x / width, y / height);
    pixels.set([255 * value, 160 * value, 80 * value], (y * width + x) * 3);
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
};
const alphaAt = (tile: Buffer, x: number, y: number) => tile[(y * size + x) * 4 + 3]!;
/** The largest alpha in the margin of a tile. */
const marginAlpha = (tile: Buffer) => {
  let most = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (Math.min(x, y, size - 1 - x, size - 1 - y) < OBJECT_THUMBNAIL_MARGIN) most = Math.max(most, alphaAt(tile, x, y));
  return most;
};

test('an object on black sky is cut to its own extent and its sky is transparent', async () => {
  // A wide blob off centre in a far larger black frame.
  const tile = await frameObjectThumbnail(await photograph(600, 400, (x, y) => Math.exp(-(((x - 0.3) / 0.08) ** 2 + ((y - 0.6) / 0.04) ** 2))));
  assert.equal(marginAlpha(tile), 0);
  const centre = (size / 2 * size + size / 2) * 4;
  assert.equal(tile[centre + 3], 255);
  assert.ok(tile[centre]! > 240 && Math.abs(tile[centre + 1]! - 160) < 12, 'the centre keeps the photograph\'s color');
  let left = size, right = 0;
  for (let x = 0; x < size; x++) if (alphaAt(tile, x, size / 2) > 16) { left = Math.min(left, x); right = Math.max(right, x); }
  assert.ok(right - left > size / 2, `the object spans ${right - left + 1} of ${size} px`);
});

test('a photograph that fills its frame fades out before the frame', async () => {
  const tile = await frameObjectThumbnail(await photograph(600, 400, () => 0.8));
  assert.equal(marginAlpha(tile), 0);
  assert.equal(alphaAt(tile, size / 2, size / 2), 255);
  // No step between neighbours anywhere: the edge of what is drawn is a ramp.
  let step = 0;
  for (let y = 0; y < size; y++) for (let x = 1; x < size; x++) step = Math.max(step, Math.abs(alphaAt(tile, x, y) - alphaAt(tile, x - 1, y)));
  assert.ok(step < 48, `largest alpha step ${step}`);
});
