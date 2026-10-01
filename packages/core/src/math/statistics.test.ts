import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { median } from '../index.js';

it('median averages the middle pair, sorts in place and gives NaN for an empty sample', () => {
  const values = [3, 1, 2, 10];
  assert.equal(median(values), 2.5);
  assert.deepEqual(values, [1, 2, 3, 10]);
  assert.equal(median([5, 1, 3]), 3);
  assert.ok(Number.isNaN(median([])));
});
