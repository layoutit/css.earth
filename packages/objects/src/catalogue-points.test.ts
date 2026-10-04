import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogueCells } from './catalogue-points.js';

test('parsing refuses cells that lose a point, misplace it, leave a box empty or span levels', () => {
  const points = [[0, 0, 0], [1, 1, 1], [5, 5, 5]];
  const good = { boxes: [[0, 0, 0, 1, 1, 1], [5, 5, 5, 5, 5, 5]], of: [0, 0, 1] };
  assert.deepEqual(parseCatalogueCells(good, points, [3], 'bank').of, new Int32Array([0, 0, 1]));
  assert.throws(() => parseCatalogueCells({ ...good, of: [0, 0] }, points, [3], 'bank'), /bank: catalogue point bank field cells names 2 cells for 3 points/u);
  assert.throws(() => parseCatalogueCells({ ...good, of: [0, 1, 1] }, points, [3], 'bank'), /box 1 does not hold point 1 \(1, 1, 1\)/u);
  assert.throws(() => parseCatalogueCells({ ...good, of: [0, 0, 2] }, points, [3], 'bank'), /names cell 2 for point 2, outside its 2 boxes/u);
  assert.throws(() => parseCatalogueCells({ boxes: [...good.boxes, [9, 9, 9, 9, 9, 9]], of: good.of }, points, [3], 'bank'), /box 2 holds no point/u);
  assert.throws(() => parseCatalogueCells({ boxes: [[0, 0, 0, 5, 5, 5]], of: [0, 0, 0] }, points, [2, 1], 'bank'), /cell 0 spans levels 0 and 1/u);
  assert.throws(() => parseCatalogueCells({ boxes: [[1, 0, 0, 0, 1, 1]], of: [0, 0, 0] }, points, [3], 'bank'), /box 0 must be six finite bounds, each minimum at most its maximum/u);
});
