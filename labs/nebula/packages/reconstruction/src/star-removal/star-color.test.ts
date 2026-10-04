import assert from 'node:assert/strict';
import test from 'node:test';
import { giveBackGas } from './star-color.ts';

// A 120 px picture over a level sky of 20. A blob adds its own color to the sky.
const size = 120, sky = 20;
type Blob = { x: number; y: number; radius: number; rgb: readonly [number, number, number] };
const picture = (blobs: readonly Blob[]) => {
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let channel = 0; channel < 3; channel++)
    rgb[(y * size + x) * 3 + channel] = Math.min(255, blobs.reduce((sum, blob) => sum + (Math.hypot(x - blob.x, y - blob.y) <= blob.radius ? blob.rgb[channel]! : 0), sky));
  return rgb;
};
const at = (rgb: Uint8Array, x: number, y: number) => [rgb[(y * size + x) * 3]!, rgb[(y * size + x) * 3 + 1]!, rgb[(y * size + x) * 3 + 2]!];
const star: Blob = { x: 30, y: 30, radius: 4, rgb: [90, 140, 200] }, knot: Blob = { x: 90, y: 30, radius: 4, rgb: [200, 110, 60] };

test('a blue patch NOX took stays taken, and a red one is given back', () => {
  const original = picture([star, knot]), starless = picture([]);
  const result = giveBackGas(starless, original, size, size, 0.8);
  assert.deepEqual(at(starless, 30, 30), [sky, sky, sky]);
  assert.deepEqual(at(starless, 90, 30), at(original, 90, 30));
  assert.deepEqual(result, { patches: 2, starPatches: 1, takenPixels: 49, givenBackPixels: 49 });
  // Nothing else of the picture changed.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x - knot.x, y - knot.y) > knot.radius) assert.deepEqual(at(starless, x, y), [sky, sky, sky], `at ${x}, ${y}`);
});

test('a star in front of a knot is taken out of the knot\'s patch', () => {
  // One patch, red over all: a wide knot with a small star on its edge.
  const wide: Blob = { x: 60, y: 80, radius: 12, rgb: [150, 80, 40] }, small: Blob = { x: 76, y: 80, radius: 3, rgb: [40, 120, 215] };
  const original = picture([wide, small]), starless = picture([]);
  const result = giveBackGas(starless, original, size, size, 0.8);
  assert.equal(result.patches, 1); assert.equal(result.starPatches, 0);
  // The knot's middle is the picture's own; the star's far side, off the knot, is NOX's sky.
  assert.deepEqual(at(starless, 60, 80), at(original, 60, 80));
  assert.deepEqual(at(starless, 78, 80), [sky, sky, sky]);
  assert.ok(result.givenBackPixels > 400 && result.takenPixels >= 9, `${result.givenBackPixels} given back, ${result.takenPixels} taken`);
});

test('light NOX only redrew by a few levels is not a patch, and a malformed call is refused', () => {
  const original = picture([{ ...knot, rgb: [5, 3, 2] }]), starless = picture([]), before = Uint8Array.from(starless);
  assert.deepEqual(giveBackGas(starless, original, size, size, 0.8), { patches: 0, starPatches: 0, takenPixels: 0, givenBackPixels: 0 });
  assert.deepEqual(starless, before);
  assert.throws(() => giveBackGas(starless, original.subarray(3), size, size, 0.8), /not 120 x 120 packed RGB/u);
  assert.throws(() => giveBackGas(starless, original, size, size, 0), /positive ratio/u);
});
