import { expect, test } from 'vitest';
import { catalogueCells, parseCatalogueCells } from './catalogue-points.js';

const grid = (count: number) => Array.from({ length: count }, (_, index) => [index % 10, Math.floor(index / 10) % 10, Math.floor(index / 100), index % 3]);

test('cells hold at most their share of points, each point in a box that holds it', () => {
  const points = grid(1000), cells = catalogueCells(points, undefined, 64);
  const sizes = new Map<number, number>();
  cells.of.forEach((cell, index) => {
    sizes.set(cell, (sizes.get(cell) ?? 0) + 1);
    const box = cells.boxes[cell]!;
    for (let axis = 0; axis < 3; axis++) expect(points[index]![axis]! >= box[axis]! && points[index]![axis]! <= box[axis + 3]!).toBe(true);
  });
  expect(Math.max(...sizes.values())).toBeLessThanOrEqual(64);
  expect(sizes.size).toBe(cells.boxes.length);
  expect(catalogueCells(points, undefined, 64), 'the same rows give the same cells').toEqual(cells);
});

test('a cell never spans two levels, and the parsed cells match the written ones', () => {
  const points = grid(300), cells = catalogueCells(points, [100, 200], 64);
  const levelOf = (index: number) => index < 100 ? 0 : 1, cellLevel = new Map<number, number>();
  cells.of.forEach((cell, index) => { expect(cellLevel.get(cell) ?? levelOf(index)).toBe(levelOf(index)); cellLevel.set(cell, levelOf(index)); });
  const parsed = parseCatalogueCells(cells, points, [100, 200], 'bank');
  expect([...parsed.of]).toEqual(cells.of);
  expect([...parsed.boxes]).toEqual(cells.boxes.flat());
  expect(() => catalogueCells(points, [100, 100])).toThrow(/Levels of 100 \+ 100 points do not add up to the bank's 300/u);
});

test('parsing refuses cells that lose a point, misplace it, leave a box empty or span levels', () => {
  const points = [[0, 0, 0], [1, 1, 1], [5, 5, 5]];
  const good = { boxes: [[0, 0, 0, 1, 1, 1], [5, 5, 5, 5, 5, 5]], of: [0, 0, 1] };
  expect(parseCatalogueCells(good, points, [3], 'bank').of).toEqual(new Int32Array([0, 0, 1]));
  expect(() => parseCatalogueCells({ ...good, of: [0, 0] }, points, [3], 'bank')).toThrow(/bank: catalogue point bank field cells names 2 cells for 3 points/u);
  expect(() => parseCatalogueCells({ ...good, of: [0, 1, 1] }, points, [3], 'bank')).toThrow(/box 1 does not hold point 1 \(1, 1, 1\)/u);
  expect(() => parseCatalogueCells({ ...good, of: [0, 0, 2] }, points, [3], 'bank')).toThrow(/names cell 2 for point 2, outside its 2 boxes/u);
  expect(() => parseCatalogueCells({ boxes: [...good.boxes, [9, 9, 9, 9, 9, 9]], of: good.of }, points, [3], 'bank')).toThrow(/box 2 holds no point/u);
  expect(() => parseCatalogueCells({ boxes: [[0, 0, 0, 5, 5, 5]], of: [0, 0, 0] }, points, [2, 1], 'bank')).toThrow(/cell 0 spans levels 0 and 1/u);
  expect(() => parseCatalogueCells({ boxes: [[1, 0, 0, 0, 1, 1]], of: [0, 0, 0] }, points, [3], 'bank')).toThrow(/box 0 must be six finite bounds, each minimum at most its maximum/u);
});
