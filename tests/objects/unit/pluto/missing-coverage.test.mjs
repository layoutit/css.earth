import assert from "node:assert/strict";
import test from "node:test";
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from "../../../../src/platform/prepare-missing-coverage.mts";
import { elevationRaster } from "./preparation-fixture.mjs";

test("JPEG coverage keeps enclosed black terrain and nonzero dark pixels", () => {
  const info = { width: 4, height: 4, channels: 3 };
  const data = Buffer.alloc(48, 120);
  for (const i of [5, 12, 13, 14, 15]) data.fill(0, i * 3, i * 3 + 3);
  data.fill(1, 9 * 3, 9 * 3 + 3);
  const missing = blackFillCoverage(data, info, { southConnected: true });
  assert.deepEqual([...missing], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
  const painted = paintMissingCoverage(data, info, missing);
  assert.deepEqual(painted.subarray(0, 36), data.subarray(0, 36));
  assert.notDeepEqual(painted.subarray(36), data.subarray(36));
});

test("monochrome coverage preserves the lowest valid observation value", () => {
  assert.deepEqual([...blackFillCoverage(Buffer.from([0, 1, 2, 255]), { width: 4, height: 1, channels: 1 })], [1, 0, 0, 0]);
});

test("coverage is sampled independently and only changes missing pixels", () => {
  const missing = sampleCoverage(Uint8Array.from([0, 1]), { width: 2, height: 1 }, 4, 2);
  assert.deepEqual([...missing], [0, 0, 1, 1, 0, 0, 1, 1]);
  const info = { width: 4, height: 2, channels: 3 };
  const input = Buffer.from(Array.from({ length: 24 }, (_, i) => i));
  const painted = paintMissingCoverage(input, info, missing);
  for (let i = 0; i < missing.length; i++) if (!missing[i]) assert.deepEqual(painted.subarray(i * 3, i * 3 + 3), input.subarray(i * 3, i * 3 + 3));
  assert.throws(() => paintMissingCoverage(input, info, []), /dimensions/);
});

test("elevation uses its own signed no-data value, not the imagery footprint", () => {
  const raster = elevationRaster({ width: 3, height: 1, sample: (x) => [-32768, 0, -1000][x] }, 3, 1);
  assert.deepEqual([...raster.missing], [1, 0, 0]);
  const painted = paintMissingCoverage(raster.data, raster.info, raster.missing);
  assert.deepEqual(painted.subarray(3), raster.data.subarray(3));
});
