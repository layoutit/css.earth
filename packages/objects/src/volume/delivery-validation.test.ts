import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPACT_DENSITY_DELIVERY_SCHEMA, parseCompactDensityDelivery, parseCompactDensityInputs } from './compact-density-delivery.js';
import { VOLUME_DATASET_MANIFEST_SCHEMA, parseVolumeDatasetManifest } from './volume-dataset-manifest.js';
const policy = { extraKeys: 'allow', assertion: assert } as const;
const valid = { schema: COMPACT_DENSITY_DELIVERY_SCHEMA, id: '', extra: true,
  delivery: { directory: '', method: 'finite-emission', compactInputs: { path: '', extra: true }, extra: true } };

test('compact delivery preserves historical admission and explicit assertion diagnostics', () => {
  const data = parseCompactDensityDelivery(valid, policy);
  assert.equal(data.id, '');
  assert.deepEqual(parseCompactDensityDelivery(valid, { assertion: assert }), data);
  assert.deepEqual(parseCompactDensityInputs(data.method, data.compactInputs, policy), { path: '' });
  for (const value of [null, [], {}, { ...valid, schema: 'other' }, { ...valid, id: 1 }, { ...valid, delivery: [] }]) {
    assert.throws(() => parseCompactDensityDelivery(value, policy), { name: 'AssertionError', message:
      "The expression evaluated to a falsy value:\n\n  assert.ok(record(value) && value.schema === COMPACT_DENSITY_DELIVERY_SCHEMA && typeof value.id === 'string' && record(value.delivery))\n" });
  }
  assert.throws(() => parseCompactDensityDelivery({ ...valid, delivery: {} }, policy), { name: 'AssertionError', message:
    "The expression evaluated to a falsy value:\n\n  assert.ok(typeof data.directory === 'string')\n" });
  assert.throws(() => parseCompactDensityInputs('finite-emission', {}, policy), { name: 'AssertionError', message:
    "The expression evaluated to a falsy value:\n\n  assert.ok(record(value) && typeof value.path === 'string')\n" });
  assert.throws(() => parseCompactDensityInputs('other', {}, policy), { name: 'AssertionError', message:
    "Compact deliveries regenerate a finite-emission bank.\n+ actual - expected\n\n+ 'other'\n- 'finite-emission'\n" });
  assert.throws(() => parseCompactDensityDelivery(valid, { ...policy, extraKeys: 'reject' }), { message: 'Unexpected delivery fields.' });
  assert.throws(() => parseCompactDensityInputs('finite-emission', { path: '', extra: 1 }, { ...policy, extraKeys: 'reject' }), { message: 'Unexpected delivery fields.' });
});

test('manifest keeps native entries admission and leaves byte inspection to transport', () => {
  for (const outputs of [{ texture: { bytes: -1, extra: true } }, [null], 'ab', 3, false]) {
    assert.deepEqual(parseVolumeDatasetManifest({ schema: VOLUME_DATASET_MANIFEST_SCHEMA, outputs, extra: true }, policy), Object.entries(outputs));
  }
  for (const outputs of [null, undefined]) assert.throws(() => parseVolumeDatasetManifest({ schema: VOLUME_DATASET_MANIFEST_SCHEMA, outputs }, policy),
    { name: 'TypeError', message: 'Cannot convert undefined or null to object' });
  assert.throws(() => parseVolumeDatasetManifest(null, policy), { name: 'TypeError', message: "Cannot read properties of null (reading 'schema')" });
  assert.throws(() => parseVolumeDatasetManifest({ schema: 'other', outputs: {} }, policy), { name: 'AssertionError', message:
    "Expected values to be strictly equal:\n+ actual - expected\n\n+ 'other'\n- 'cssearth-volume-dataset-manifest@1'\n" });
  assert.throws(() => parseVolumeDatasetManifest({ schema: VOLUME_DATASET_MANIFEST_SCHEMA, outputs: [] }, { ...policy, outputs: 'record' }), { message: 'Delivery outputs must be a record.' });
  assert.throws(() => parseVolumeDatasetManifest({ schema: VOLUME_DATASET_MANIFEST_SCHEMA, outputs: {}, extra: 1 }, { ...policy, extraKeys: 'reject' }), { message: 'Unexpected delivery fields.' });
});
