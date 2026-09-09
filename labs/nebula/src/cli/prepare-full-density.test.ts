import assert from 'node:assert/strict';
import test from 'node:test';
import { planFullDensityGrid, transformParticleBytes } from './prepare-full-density.js';

test('full-particle transform preserves every record and grid planning pads beyond smoothing support', () => {
  const input = Buffer.alloc(3 * 16);
  const records = [[-2, 3, 1, .5], [4, -1, 2, 1.5], [0, 2, -3, 2]];
  records.forEach((record, index) => record.forEach((value, field) => input.writeFloatLE(value, 16 * index + 4 * field)));
  const transformed = transformParticleBytes(input, [0, -1, 0, 1, 0, 0, 0, 0, 1], [10, 20, 30]);
  assert.equal(transformed.count, 3);
  assert.equal(transformed.mass, 4);
  assert.deepEqual(transformed.boundsKpc, { min: [7, 18, 27], max: [11, 24, 32] });
  for (let record = 0; record < 3; record++) assert.equal(transformed.bytes.readFloatLE(16 * record + 12), records[record]![3]);
  const plan = planFullDensityGrid(transformed.boundsKpc, { maximumVoxels: 8000,
    maximumAxisCells: 32, smoothingSigmaVoxels: .8, boundaryPaddingSigma: 4 });
  assert.ok(plan.dimensions.every(value => value <= 32));
  assert.ok(plan.dimensions.reduce((product, value) => product * value, 1) <= 8000);
  assert.ok(plan.paddingCells >= 5, 'outer faces remain beyond CIC plus the truncated smoothing kernel');
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(plan.boundsKpc.min[axis]! < transformed.boundsKpc.min[axis]!);
    assert.ok(plan.boundsKpc.max[axis]! > transformed.boundsKpc.max[axis]!);
    assert.ok(plan.paddingKpc.min[axis]! >= 4 * .8 * plan.cellWidthKpc);
    assert.ok(plan.paddingKpc.max[axis]! >= 4 * .8 * plan.cellWidthKpc);
  }
});
