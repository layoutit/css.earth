import assert from 'node:assert/strict';
import test from 'node:test';
import { testTypecheckBatches } from './typecheck-tests.mts';

test('compiler batches retain every discovered root once, including a partial final group', () => {
  const roots = Array.from({ length: 205 }, (_, index) => `tests/object-${String(index).padStart(3, '0')}.mts`);
  const groups = testTypecheckBatches([...roots].reverse().concat(roots[0]), 96);
  assert.deepEqual(groups.map(group => group.length), [96, 96, 13]);
  assert.deepEqual(groups.flat(), roots);
});

test('invalid compiler batch sizes fail instead of silently skipping files', () => {
  for (const size of [0, -1, 0.5, Infinity, NaN]) assert.throws(() => testTypecheckBatches(['test.mts'], size), /batch size/u);
});
