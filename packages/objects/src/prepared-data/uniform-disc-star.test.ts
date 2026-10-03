import assert from 'node:assert/strict';
import test from 'node:test';
import { UNIFORM_DISC_STAR_SCHEMA, parseUniformDiscStarMeasurements } from './uniform-disc-star.js';

const record = { schema: UNIFORM_DISC_STAR_SCHEMA, radiusKm: 100, shape: { path: 'sphere.tab', stepDegrees: 5 }, citation: 'paper' };
test('uniform-disc measurements preserve extra cited fields and authoring diagnostics', () => {
  assert.equal(UNIFORM_DISC_STAR_SCHEMA, 'cssearth-uniform-disc-star@1');
  assert.deepEqual(parseUniformDiscStarMeasurements(record, 'Star', 'sphere.tab'), record);
  assert.throws(() => parseUniformDiscStarMeasurements({ ...record, schema: 'other' }, 'Star', 'sphere.tab'), { message: 'Unexpected Star measurements schema.' });
  assert.throws(() => parseUniformDiscStarMeasurements(record, 'Star', 'other.tab'), { message: 'Star sphere path differs from the authoring tool.' });
  assert.throws(() => parseUniformDiscStarMeasurements({ ...record, radiusKm: NaN }, 'Star', 'sphere.tab'), TypeError);
  assert.throws(() => parseUniformDiscStarMeasurements({ ...record, shape: { path: 'sphere.tab', stepDegrees: '5' } }, 'Star', 'sphere.tab'), TypeError);
  // Geometry validity belongs to sphere generation; the historical reader admits finite negatives.
  assert.equal(parseUniformDiscStarMeasurements({ ...record, radiusKm: -1 }, 'Star', 'sphere.tab').radiusKm, -1);
});
