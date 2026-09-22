import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { minimapPointCovered } from '../minimap/point-coverage.mts';

const point = { index: 0, x: 0, y: 0, radius: .75, alpha: 1 };
const foreground = { index: 1, x: 0, y: 0, radius: 2.5, alpha: 1, opaque: true };
const guard = Math.SQRT2;

test('only a later fully opaque marker covers a complete earlier marker', () => {
  assert.equal(minimapPointCovered(point, foreground, guard), true);
  for (const change of [{ index: 0 }, { index: -1 }, { alpha: .999999 }, { alpha: 0 }, { opaque: false }]) {
    assert.equal(minimapPointCovered(point, { ...foreground, ...change }, guard), false);
  }
  assert.equal(minimapPointCovered({ ...point, radius: 1.75 }, foreground, guard), false);
});

test('edge contact, motion out of coverage and responsive raster guards keep drawing', () => {
  const clearance = foreground.radius - point.radius - guard;
  assert.equal(minimapPointCovered({ ...point, x: clearance }, foreground, guard), false);
  assert.equal(minimapPointCovered({ ...point, x: clearance + .01 }, foreground, guard), false);
  assert.equal(minimapPointCovered({ ...point, x: clearance - .01 }, foreground, guard), true);
  assert.equal(minimapPointCovered(point, foreground, guard / .7368421), false);
  for (const value of [0, -1, NaN, Infinity]) assert.equal(minimapPointCovered(point, foreground, value), false);
  assert.equal(minimapPointCovered(point, { ...foreground, x: NaN }, guard), false);
  assert.equal(minimapPointCovered(point, { ...foreground, radius: Infinity }, guard), false);
});
