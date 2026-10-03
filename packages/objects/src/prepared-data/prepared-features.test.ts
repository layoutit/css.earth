import assert from 'node:assert/strict';
import test from 'node:test';
import { PREPARED_FEATURES_SCHEMA, readPreparedFeaturePins } from './prepared-features.ts';

const descriptor = { schema: PREPARED_FEATURES_SCHEMA, url: '/catalogue.json', bytes: 100, count: 1 };
test('feature handoff keeps index and pre-build admission policies distinct', () => {
  assert.equal(PREPARED_FEATURES_SCHEMA, 'cssearth-prepared-features@1');
  for (const policy of ['index', 'inventory'] as const) {
    assert.deepEqual(readPreparedFeaturePins(descriptor, 'probe', policy), { descriptor, pins: [descriptor] });
    const banked = { ...descriptor, selection: { count: 1, banks: [{ url: '/bank.json', count: 1 }] } };
    assert.deepEqual(readPreparedFeaturePins(banked, 'probe', policy).pins, [banked, ...banked.selection.banks]);
  }
  const historical = { ...descriptor, selection: { banks: [] } };
  assert.equal(readPreparedFeaturePins(historical, 'probe', 'inventory').descriptor, historical);
  assert.throws(() => readPreparedFeaturePins(historical, 'probe'), { message: 'probe: feature selection descriptor is invalid.' });
  assert.throws(() => readPreparedFeaturePins({}, 'probe'), { message: 'probe: prepared features descriptor is invalid.' });
  assert.throws(() => readPreparedFeaturePins({}, 'probe', 'inventory'), { message: 'Invalid feature-index input: probe' });
  assert.throws(() => readPreparedFeaturePins({ ...descriptor, selection: { count: 1, banks: [null] } }, 'probe'), { message: 'probe: feature selection bank is invalid.' });
  assert.throws(() => readPreparedFeaturePins({ ...descriptor, selection: { banks: [null] } }, 'probe', 'inventory'), /Source value/);
});
