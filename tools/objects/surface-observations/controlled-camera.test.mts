/** A controlled camera must place its lit source shape on the photographed body; the share that lands on the photograph's sky decides refusal. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PixelGeometry } from './contract.mts';
import { MAXIMUM_LIT_SHAPE_ON_SKY, litShapeOnSky } from './formats/controlled-camera.mts';

// Five detector pixels: pixels 0-3 hit the source shape and pixel 4 misses it. Pixel 3 lies beyond an 80-degree incidence limit.
const geometry: PixelGeometry = { source: 'source-mesh-rays', report: {},
  reject: i => i < 4 ? null : 'no-geometry', incidence: i => (i === 3 ? 85 : 40) * Math.PI / 180, emission: () => 0, phase: () => 0,
  distanceMeters: () => 0, rangeMeters: () => 1 };

test('lit shape on sky counts only lit shape pixels, and the archive quality mask is not sky', () => {
  // Lit shape: pixels 0, 1 and 2. Pixel 1 is edge-connected sky; pixel 2 is withheld by the archive's quality data instead.
  const report = litShapeOnSky(geometry, Uint8Array.from([0, 1, 1, 1, 1]), Uint8Array.from([0, 0, 1, 0, 0]), 80, 5);
  assert.deepEqual(report, { litPixels: 3, onSkyPixels: 1, share: 1 / 3, maximumShare: MAXIMUM_LIT_SHAPE_ON_SKY });
  assert.ok(report.share > MAXIMUM_LIT_SHAPE_ON_SKY, 'a third of the lit shape on sky refuses the frame');
  assert.equal(litShapeOnSky(geometry, Uint8Array.from([0, 0, 0, 1, 1]), undefined, 80, 5).share, 0, 'shape beyond the incidence limit and sky beside the shape do not count');
  assert.equal(litShapeOnSky(geometry, undefined, undefined, 80, 5).share, 0, 'a frame without a sky threshold has no sky to test against');
});
