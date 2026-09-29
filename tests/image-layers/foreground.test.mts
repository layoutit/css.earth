import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeCompanionGalaxies, removeForegroundStars } from '@cssearth/bake/image-layers';

// A flat grey sky with one compact star and one wide, unsaturated glow, both catalogued as foreground.
const size = 160, sky = 40;
const image = (paint: (x: number, y: number) => number) => {
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rgb.fill(Math.min(255, Math.round(paint(x, y))), 3 * (y * size + x), 3 * (y * size + x) + 3);
  return rgb;
};
const blob = (x: number, y: number, cx: number, cy: number, peak: number, sigma: number) => peak * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma));

test('a compact catalogued star is replaced by the sky around it', () => {
  const rgb = image((x, y) => sky + blob(x, y, 50, 50, 150, 1.2));
  const result = removeForegroundStars(rgb, size, size, [{ x: 50, y: 50, gMag: 16 }]);
  assert.equal(result.removed, 1);
  assert.ok(Math.abs(rgb[3 * (50 * size + 50)]! - sky) <= 1, `centre ${rgb[3 * (50 * size + 50)]}`);
});

test('a catalogued source on a wide glow (a galaxy core) is left in the image', () => {
  const rgb = image((x, y) => sky + blob(x, y, 100, 100, 150, 8));
  const before = Buffer.from(rgb), result = removeForegroundStars(rgb, size, size, [{ x: 100, y: 100, gMag: 16 }]);
  assert.equal(result.removed, 0);
  assert.equal(result.extended, 1);
  assert.deepEqual(rgb, before);
});

test('a companion galaxy is replaced out to where its glow ends', () => {
  const rgb = image((x, y) => sky + blob(x, y, 80, 80, 120, 6));
  const result = removeCompanionGalaxies(rgb, size, size, [{ x: 80, y: 80, halfLightPx: 7, axisRatio: 1, major: [1, 0] }]);
  assert.ok(result.extentHalfLight[0]! > 1.5, `extent ${result.extentHalfLight[0]}`);
  for (const [x, y] of [[80, 80], [88, 80], [80, 90]]) assert.ok(Math.abs(rgb[3 * (y! * size + x!)]! - sky) <= 3, `${x}, ${y}: ${rgb[3 * (y! * size + x!)]}`);
});
