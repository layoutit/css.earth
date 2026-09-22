import { required } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {orthographicPoint} from './orthographic-observation.mts';
import {sampleColorBand} from './scientific-raster.mts';

test('orthographic center and east/north orientation follow the source projection', () => {
  const p = {centerLongitude: 15, centerLatitude: 18, radius: 1352600};
  const center = orthographicPoint(15, 18, p);
  assert.ok(Math.hypot(...required(center)) < 1e-8);
  assert.ok(required(orthographicPoint(25, 18, p))[0] > 0);
  assert.ok(required(orthographicPoint(5, 18, p))[0] < 0);
  assert.ok(required(orthographicPoint(15, 28, p))[1] > 0);
  assert.ok(required(orthographicPoint(15, 8, p))[1] < 0);
  assert.equal(orthographicPoint(195, -18, p), null);
  assert.ok(Math.hypot(...required(orthographicPoint(375, 18, p))) < 1e-8);
});

test('orthographic samples preserve dark observations and reject no-data boundary interpolation', () => {
  const band = {data: [0.001, 0.001, 0.001, 0.001], width: 2, height: 2,
    origin: [0, 2], resolution: [1, -1], noData: -3.4028226550889045e38, specialValueMagnitude: 1e30};
  assert.equal(sampleColorBand(band, 1, 1), 0.001);
  band.data[3] = band.noData;
  assert.equal(sampleColorBand(band, 1, 1), null);
});
