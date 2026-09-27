import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leafRasterScale, TEXELS_PER_CSS_PIXEL } from '@cssearth/bake/scene';

// A raster leaf holds its widest image at two texels per CSS pixel. WebKit backs each leaf at its box times the device pixel
// ratio whatever its transform: Earth, Mercury, Haumea and Saturn each backed four caps with 36 MB layers on an iPhone at
// raster scale 2 or 4, and Itokawa's faces 486 MB at one texel per CSS pixel against 173 MB at two.
test('a leaf shows its widest image at two texels per CSS pixel, whatever the lane asks', () => {
  assert.equal(TEXELS_PER_CSS_PIXEL, 2);
  assert.equal(leafRasterScale(512, 256, 4), 1);
  assert.equal(leafRasterScale(2048, 256, 4), 4);
  assert.equal(leafRasterScale(1024, 256, 2), 2);
});

test('the ceiling keeps a leaf that already holds more texels at its box; a 1x image shrinks it below one', () => {
  assert.equal(leafRasterScale(4096, 256, 4), 4);
  assert.equal(leafRasterScale(1024, 256, 1), 1, 'a plain leaf never grows');
  assert.equal(leafRasterScale(2048, 27377.713375, 1), 2048 / 27377.713375 / 2, "Jupiter's ring tile shrinks to its image");
  assert.equal(leafRasterScale(256, 256, 4), 0.5);
});

test('a leaf needs a positive image width, background width and ceiling', () => {
  assert.throws(() => leafRasterScale(0, 256, 4), /image width \(0 px\)/);
  assert.throws(() => leafRasterScale(256, Number.NaN, 4), /background width \(NaN px\)/);
  assert.throws(() => leafRasterScale(256, 256, 0), /ceiling \(0\)/);
});
