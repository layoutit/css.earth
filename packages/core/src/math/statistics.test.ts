import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { medianAveraged } from '../index.js';

it('medianAveraged averages the middle pair, sorts in place and gives NaN for an empty sample', () => {
  const values = [3, 1, 2, 10];
  assert.equal(medianAveraged(values), 2.5);
  assert.deepEqual(values, [1, 2, 3, 10]);
  assert.equal(medianAveraged([5, 1, 3]), 3);
  assert.ok(Number.isNaN(medianAveraged([])));
});

it('named medianAveraged policies preserve distinct even, empty and mutation behavior', async () => {
  const { medianAveraged, medianUpperMiddle } = await import('../index.js');
  assert.equal(medianAveraged([1, 2]), 1.5);
  assert.equal(medianUpperMiddle([1, 2]), 2);
  const values = [10, 1, 3, 2];
  assert.equal(medianUpperMiddle(Object.freeze(values)), 3);
  assert.deepEqual(values, [10, 1, 3, 2]);
  for (const [input, averaged, upper] of [
    [[5, 1, 3], 3, 3], [[Number.MIN_VALUE], Number.MIN_VALUE, Number.MIN_VALUE],
    [[1e300, 1e300], 1e300, 1e300], [[NaN], NaN, NaN],
    [[Infinity, -Infinity], NaN, Infinity], [[-0], -0, -0],
  ] as const) {
    assert.ok(Object.is(medianAveraged([...input]), averaged));
    assert.ok(Object.is(medianUpperMiddle(input), upper));
  }
  assert.ok(Number.isNaN(medianAveraged([])));
  assert.throws(() => medianUpperMiddle([]), { name: 'TypeError', message: 'Cannot take the upper-middle median of an empty sample.' });
});
