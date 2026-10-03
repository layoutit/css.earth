import assert from 'node:assert/strict';
import test from 'node:test';
import { takeCoarsePass } from './coarse.ts';

// A 240 px picture and its 60 px copy, both a level sky of 30. A blob stands `height` levels above the sky.
const width = 240, height = 240, factor = 4, smallWidth = width / factor, smallHeight = height / factor, sky = 30;
const picture = (size: number, blobs: { x: number; y: number; radius: number; height: number }[]) => {
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const light = blobs.reduce((sum, blob) => sum + (Math.hypot(x - blob.x, y - blob.y) <= blob.radius ? blob.height : 0), sky);
    rgb.fill(Math.min(255, light), (y * size + x) * 3, (y * size + x) * 3 + 3);
  }
  return rgb;
};
const at = (rgb: Uint8Array, x: number, y: number) => rgb[(y * width + x) * 3]!;
const small = (blobs: { x: number; y: number; radius: number; height: number }[]) => picture(smallWidth, blobs.map(blob => ({ x: blob.x / factor, y: blob.y / factor, radius: blob.radius / factor, height: blob.height })));

test('a star the small pass took is replaced by that pass\'s result, and the rest of the picture is untouched', () => {
  const star = { x: 160, y: 80, radius: 16, height: 180 };
  const rgb = picture(width, [star]), before = Uint8Array.from(rgb);
  const { replacedPixels } = takeCoarsePass(rgb, width, height, small([star]), small([]), smallWidth, smallHeight);
  assert.equal(at(before, 160, 80), sky + 180);
  assert.equal(at(rgb, 160, 80), sky);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot(x - star.x, y - star.y);
    if (distance <= star.radius) assert.equal(at(rgb, x, y), sky, `inside the star at ${x}, ${y}`);
    // The replaced area ends within 2 + 2 x 2 small pixels, and one more for the reading between small pixels, of the star.
    if (distance > star.radius + 7 * factor) assert.equal(at(rgb, x, y), at(before, x, y), `far from the star at ${x}, ${y}`);
  }
  assert.ok(replacedPixels >= Math.PI * star.radius ** 2 * 0.9, `${replacedPixels} pixels replaced`);
});

test('a small pass that only redrew the copy by a few levels changes nothing', () => {
  const knot = { x: 100, y: 100, radius: 12, height: 60 };
  const rgb = picture(width, [knot]), before = Uint8Array.from(rgb);
  // The small pass softened the knot by 30 levels: more than the redrawing floor, less than a star.
  const result = takeCoarsePass(rgb, width, height, small([knot]), small([{ ...knot, height: 30 }]), smallWidth, smallHeight);
  assert.equal(result.replacedPixels, 0);
  assert.deepEqual(rgb, before);
});

test('light taken beside a star goes with it; the same light elsewhere stays', () => {
  const star = { x: 60, y: 60, radius: 8, height: 200 }, beside = { x: 76, y: 60, radius: 8, height: 20 }, apart = { x: 180, y: 180, radius: 8, height: 20 };
  const rgb = picture(width, [star, beside, apart]);
  takeCoarsePass(rgb, width, height, small([star, beside, apart]), small([]), smallWidth, smallHeight);
  assert.equal(at(rgb, 82, 60), sky);
  assert.equal(at(rgb, 180, 180), sky + 20);
});

test('copies of the wrong size are refused by name', () => {
  assert.throws(() => takeCoarsePass(new Uint8Array(10), width, height, small([]), small([]), smallWidth, smallHeight), /The picture is not 240 x 240 packed RGB/);
  assert.throws(() => takeCoarsePass(picture(width, []), width, height, small([]), new Uint8Array(12), smallWidth, smallHeight), /The small copies are not 60 x 60 packed RGB/);
});
