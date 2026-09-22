import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polarCapRasterScale } from '../../src/platform/projective-surface-raster.mts';

// A polar cap is rastered only as finely as its texture. Earth, Mercury, Haumea and Saturn each backed four caps with
// 36 MB layers on an iPhone at raster scale 2 or 4; their textures carry one logical pixel per CSS px of the leaf.
test('a cap whose texture has one pixel per leaf pixel rasters at scale 1, whatever the lane asks', () => {
  assert.equal(polarCapRasterScale(4, 256, 256), 1);
  assert.equal(polarCapRasterScale(2, 512, 512), 1);
});

test('a denser texture keeps a scale that shows every pixel, never above the lane\'s', () => {
  assert.equal(polarCapRasterScale(4, 512, 256), 2);
  assert.equal(polarCapRasterScale(4, 700, 256), 3);
  assert.equal(polarCapRasterScale(2, 1024, 256), 2);
});

test('a cap needs its texture and leaf size', () => {
  assert.throws(() => polarCapRasterScale(4, 0, 256), /texture and leaf size/);
  assert.throws(() => polarCapRasterScale(4, 256, Number.NaN), /texture and leaf size/);
});
