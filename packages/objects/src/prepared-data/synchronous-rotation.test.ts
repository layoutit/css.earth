import assert from 'node:assert/strict';
import test from 'node:test';
import { SYNCHRONOUS_ROTATION_SCHEMA, parseSynchronousRotation } from './synchronous-rotation.js';

const record = { schema: SYNCHRONOUS_ROTATION_SCHEMA, host: 'host', source: 'paper', qualification: '1:1 lock', coordinateSystem: 'ICRF' };
test('synchronous rotation admits cited records and leaves host identity to orbit evaluation', () => {
  assert.equal(SYNCHRONOUS_ROTATION_SCHEMA, 'cssearth-synchronous-rotation@1');
  assert.deepEqual(parseSynchronousRotation(record), record);
  for (const key of ['source', 'qualification', 'coordinateSystem']) for (const value of [undefined, '', ' ', 1])
    assert.throws(() => parseSynchronousRotation({ ...record, [key]: value }), { message: 'Invalid synchronous rotation source.' });
  assert.throws(() => parseSynchronousRotation({ ...record, schema: 'other' }), { message: 'Invalid synchronous rotation source.' });
  assert.equal(parseSynchronousRotation({ ...record, host: undefined }).host, undefined);
});
