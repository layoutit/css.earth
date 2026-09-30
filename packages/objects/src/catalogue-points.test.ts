import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { catalogueCells, parseCatalogueCells } from './catalogue-points.js';

const grid = (count: number) => Array.from({ length: count }, (_, index) => [index % 10, Math.floor(index / 10) % 10, Math.floor(index / 100), index % 3]);

test('cells hold at most their share of points, each point in a box that holds it', () => {
  const points = grid(1000), cells = catalogueCells(points, undefined, 64);
  const sizes = new Map<number, number>();
  cells.of.forEach((cell, index) => {
    sizes.set(cell, (sizes.get(cell) ?? 0) + 1);
    const box = cells.boxes[cell]!;
    for (let axis = 0; axis < 3; axis++) assert.equal((points[index]![axis]! >= box[axis]! && points[index]![axis]! <= box[axis + 3]!), true);
  });
  assert.ok(Math.max(...sizes.values()) <= 64);
  assert.equal(sizes.size, cells.boxes.length);
  assert.deepEqual(catalogueCells(points, undefined, 64), cells, 'the same rows give the same cells');
});

test('a cell never spans two levels, and the parsed cells match the written ones', () => {
  const points = grid(300), cells = catalogueCells(points, [100, 200], 64);
  const levelOf = (index: number) => index < 100 ? 0 : 1, cellLevel = new Map<number, number>();
  cells.of.forEach((cell, index) => { assert.equal((cellLevel.get(cell) ?? levelOf(index)), levelOf(index)); cellLevel.set(cell, levelOf(index)); });
  const parsed = parseCatalogueCells(cells, points, [100, 200], 'bank');
  assert.deepEqual(([...parsed.of]), cells.of);
  assert.deepEqual(([...parsed.boxes]), cells.boxes.flat());
  assert.throws(() => catalogueCells(points, [100, 100]), /Levels of 100 \+ 100 points do not add up to the bank's 300/u);
});

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
