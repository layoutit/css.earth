import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedLeafBounds } from '@cssearth/objects';
import { compileLeafBounds } from './leaf-bounds.ts';

test('prepared image bounds include the compiled edge extension', () => {
  const bounds = compileLeafBounds('0,1,0,0,-2,0,0,0,0,0,1,0,10,20,30,1', 4, 3)!;
  assert.deepEqual(bounds, { min: [4,20,30], max: [10,24,30] });
  assert.doesNotThrow(() => validatePreparedLeafBounds(bounds));
  assert.equal(compileLeafBounds('1,0,0,0.1,0,1,0,0,0,0,1,0,0,0,0,1', 4, 3), undefined);
});
