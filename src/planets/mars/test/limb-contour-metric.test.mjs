import assert from "node:assert/strict";
import test from "node:test";

import {
  MARS_LIMB_CONTOUR_THRESHOLDS,
  measureMarsLimbContour,
} from "../tools/audit/limb-contour-metric.mjs";

test("the Mars limb metric accepts its smooth prepared control", () => {
  const size = 64;
  const radius = 24;
  const coverage = Uint8Array.from({ length: size * size }, (_, index) => {
    const x = index % size + 0.5 - size / 2;
    const y = Math.floor(index / size) + 0.5 - size / 2;
    return x * x + y * y <= radius * radius ? 255 : 0;
  });
  const result = measureMarsLimbContour({
    actualAlpha: coverage,
    actualWidth: size,
    actualHeight: size,
    expectedCoverage: coverage,
    expectedWidth: size,
    expectedHeight: size,
    expectedRect: { x: 0, y: 0, width: size, height: size },
  });

  assert.equal(result.outwardPixelCount, 0);
  assert.equal(result.inwardPixelCount, 0);
  assert.equal(result.maximumAbsoluteCssPixels, 0);
  assert.equal(result.passes, true);
});

test("the Mars limb metric rejects a polygon protruding beyond the control", () => {
  const size = 64;
  const radius = 24;
  const coverage = Uint8Array.from({ length: size * size }, (_, index) => {
    const x = index % size + 0.5 - size / 2;
    const y = Math.floor(index / size) + 0.5 - size / 2;
    return x * x + y * y <= radius * radius ? 255 : 0;
  });
  const polygon = coverage.slice();
  for (let y = 27; y <= 37; y += 1) {
    for (let x = 55; x <= 59; x += 1) polygon[y * size + x] = 255;
  }
  const result = measureMarsLimbContour({
    actualAlpha: polygon,
    actualWidth: size,
    actualHeight: size,
    expectedCoverage: coverage,
    expectedWidth: size,
    expectedHeight: size,
    expectedRect: { x: 0, y: 0, width: size, height: size },
    thresholds: {
      ...MARS_LIMB_CONTOUR_THRESHOLDS,
      maximumAbsoluteCssPixels: { dpr1: 1, dpr2: 0.5 },
      maximumRmsCssPixels: 0.25,
    },
  });

  assert.ok(result.outwardPixelCount > 0);
  assert.ok(result.maximumAbsoluteCssPixels > 1);
  assert.equal(result.passes, false);
});
