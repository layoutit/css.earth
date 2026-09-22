import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { accumulateRadianceRow, finishRadianceGrid, nightLightColor, validateNightLightGrid } from './night-lights.mts';

const missing = Math.fround(-999.9);
function aggregate(rows: number[][], grid: Parameters<typeof accumulateRadianceRow>[2], target: Parameters<typeof accumulateRadianceRow>[3]) {
  const sums = new Float64Array(target.width * target.height), weights = new Float64Array(sums.length);
  rows.forEach((row: Iterable<number>, y: number) => accumulateRadianceRow(Float32Array.from(row), y, grid, target, sums, weights));
  return finishRadianceGrid(sums, weights, grid, target);
}

test('a sparse light contributes its area mean instead of disappearing between samples', () => {
  const values = aggregate([[0, 100, 0, 0], [0, 0, 20, 20]],
    { width: 4, height: 2, cellDegrees: 90, bounds: [-180, -90, 180, 90] }, { width: 2, height: 1 });
  assert.deepEqual([...values], [25, 10]);
});

test('fractional longitude overlaps conserve radiance and do not wrap a seam into its neighbor', () => {
  const grid = { width: 3, height: 1, cellDegrees: 180, bounds: [-180, -90, 180, 90] };
  assert.deepEqual([...aggregate([[0, 12, 0]], grid, { width: 2, height: 1 })], [4, 4]);
  assert.deepEqual([...aggregate([[9, 0, 0]], grid, { width: 2, height: 1 })], [6, 0]);
});

test('latitude integration uses spherical area, not equal weight for polar and equatorial cells', () => {
  const values = aggregate([[100, 100], [0, 0], [0, 0], [100, 100]],
    { width: 2, height: 4, cellDegrees: 45, bounds: [-180, -90, 180, 90] }, { width: 2, height: 1 });
  const expected = 100 * (1 - Math.sin(Math.PI / 4));
  assert.ok(Math.abs(values[0] - expected) < .00001);
});

test('missing observations are never averaged as darkness and coverage gaps stay missing', () => {
  const grid = { width: 4, height: 1, cellDegrees: 180, bounds: [-180, -90, 180, 90] };
  assert.deepEqual([...aggregate([[missing, 8, missing, missing]], grid, { width: 2, height: 1 })], [8, missing]);
  assert.deepEqual([...aggregate([[0, 0, 0, 0]], grid, { width: 2, height: 1 })], [0, 0]);
  assert.deepEqual([...aggregate([[missing, missing, missing, 8]], grid, { width: 1, height: 1 })], [missing]);
  const cropped = aggregate([[0, 0], [0, 0]],
    { width: 2, height: 2, cellDegrees: 45, bounds: [-180, -45, 180, 45] }, { width: 2, height: 4 });
  assert.deepEqual([...cropped], [missing, missing, 0, 0, 0, 0, missing, missing]);
});

test('unexpected negative, NaN and infinite measurements fail before rendering', () => {
  const grid = { width: 2, height: 1, cellDegrees: 180, bounds: [-180, -90, 180, 90] };
  for (const value of [-1, NaN, Infinity]) assert.throws(() => aggregate([[0, value]], grid, { width: 2, height: 1 }), /radiance/);
});

test('georeferencing must match the actual pixel-area EPSG:4326 mosaic', () => {
  const recipe = { grid: { width: 86400, height: 33600, cellDegrees: 1 / 240, bounds: [-180, -65, 180, 75] } };
  const image = { getWidth: () => 86400, getHeight: () => 33600, getBoundingBox: () => [-180, -65, 180, 75],
    getSamplesPerPixel: () => 1, getGDALNoData: () => missing,
    getGeoKeys: () => ({ GeographicTypeGeoKey: 4326, GTRasterTypeGeoKey: 1 }) };
  assert.doesNotThrow(() => validateNightLightGrid(image, recipe));
  assert.throws(() => Reflect.apply(validateNightLightGrid, undefined, [{ ...image, getBoundingBox: () => [-180, -70, 180, 80] }, recipe]), /coordinates/);
  assert.throws(() => Reflect.apply(validateNightLightGrid, undefined, [{ ...image, getGeoKeys: () => ({ GeographicTypeGeoKey: 3857 }) }, recipe]), /coordinates/);
  assert.throws(() => Reflect.apply(validateNightLightGrid, undefined, [{ ...image, getGDALNoData: () => 0 }, recipe]), /missing/);
});

test('the shared globe and legend transfer distinguishes darkness, missingness and saturation', () => {
  const display = { maximum: 100, softening: .25, missing: [38, 42, 49] };
  assert.deepEqual(nightLightColor(missing, display), display.missing);
  assert.deepEqual(nightLightColor(0, display), [4, 7, 13]);
  assert.deepEqual(nightLightColor(100, display), [255, 251, 211]);
  assert.deepEqual(nightLightColor(100000, display), nightLightColor(100, display));
  for (const value of [.01, .1, 1, 10]) assert.ok(nightLightColor(value, display)[0] < nightLightColor(value * 2, display)[0]);
});
