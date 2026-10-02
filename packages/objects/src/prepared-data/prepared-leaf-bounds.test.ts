import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedLeafBounds } from './prepared-leaf-bounds.js';

test('reject malformed prepared bounds', () => {
  for (const b of [{min:[0,0,0],max:[-1,0,0]}, {min:[0,0,0],max:[Infinity,0,0]}, {min:[0,0],max:[1,1,1]}, {min:[0,0,0],max:[1,1,1], extra:true}]) assert.throws(() => validatePreparedLeafBounds(b), {
    name: 'TypeError', message: 'Prepared leaf bounds must be finite ordered CSS coordinates.',
  });
});
test('finite flat and ordered bounds remain valid', () => {
  assert.doesNotThrow(() => validatePreparedLeafBounds({ min: [-2, 0, 3], max: [-2, 4, 3] }));
});
