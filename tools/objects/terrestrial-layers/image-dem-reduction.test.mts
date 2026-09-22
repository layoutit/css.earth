import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { repairImageDemDiagonals, measureImageDemReduction } from './image-dem-reduction.mts';
import { createIndexedShape } from './obj-shape.mts';
import { validateObservedReduction } from './open-surface.mts';

test('a vertical boundary triangle is retriangulated without moving points or filling gaps', () => {
  const positions = [[0, 0, 0], [1, 0, 0.1], [2, 0, 0], [1, 1, 0]];
  const input = Uint32Array.from([0, 1, 2, 0, 2, 3]);
  const result = repairImageDemDiagonals(input, positions);
  assert.equal(result.flips, 1);
  assert.deepEqual([...result.indices], [0, 1, 3, 1, 2, 3]);
  assert.equal(validateObservedReduction(input, result.indices, positions).boundaryPreserved, true);
  const mesh = createIndexedShape(positions, [[0, 1, 3], [1, 2, 3]],
    { metersPerUnit: 1, expectedVertices: 4, expectedFaces: 2 });
  const measured = measureImageDemReduction(mesh, result.indices, .2);
  assert.equal(measured.sourceToRetained.samples, 6);
  assert.ok(measured.sourceToRetained.maximumDistanceMeters < 1e-12);
  assert.throws(() => repairImageDemDiagonals(Uint32Array.from([0, 1, 2]), positions), /folded or vertical/);
});
