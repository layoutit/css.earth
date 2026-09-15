import assert from 'node:assert/strict';
import test from 'node:test';
import { createSymmetryGroups, inferEmission, positiveGroupProx, projectEmission } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';

test('positive group prox clips peaks together, rather than averaging or independent soft thresholding', () => {
  const input = new Float32Array([-2, 1, 4, 5]);
  positiveGroupProx(input, 3);
  assert.deepEqual([...input], [0, 1, 3, 3]);
  positiveGroupProx(input, 7);
  assert.deepEqual([...input], [0, 0, 0, 0]);
});

test('all voxels belong to exactly one cylindrical group', () => {
  const groups = createSymmetryGroups({ width: 8, height: 7, depth: 6 }, { axis: [1, 0, 0], center: [3.5, 3, 2.5], binWidth: 1 });
  assert.equal(new Set(groups.indices).size, 8 * 7 * 6);
  assert.equal(groups.offsets.at(-1), 8 * 7 * 6);
});

test('a projected hollow cylindrical shell recovers radial depth instead of a photograph extrusion', () => {
  const grid = { width: 12, height: 25, depth: 25 };
  const prior = { axis: [1, 0, 0] as const, center: [5.5, 12, 12] as const, binWidth: 1 };
  const truth = new Float32Array(grid.width * grid.height * grid.depth);
  for (let z = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 2; x < 10; x++) {
    const radius = Math.hypot(y - 12, z - 12);
    if (radius >= 7 && radius < 9) truth[(z * grid.height + y) * grid.width + x] = 0.3;
  }
  const image = projectEmission(truth, grid);
  const result = inferEmission({ grid, prior, image, tau: 0.001, iterations: 100 });
  assert.ok(result.volume.every(v => Number.isFinite(v) && v >= 0));
  assert.ok(result.report.relativeProjectionError < 0.05, JSON.stringify(result.report));
  const center = result.volume[(12 * grid.height + 12) * grid.width + 5]!;
  const wall = result.volume[(20 * grid.height + 12) * grid.width + 5]!;
  assert.ok(wall > 3 * center, `wall=${wall}, hollow center=${center}`);
  const extrusion = inferEmission({ grid, prior, image, tau: 0, iterations: 10 });
  assert.equal(extrusion.volume[(12 * grid.height + 12) * grid.width + 5], extrusion.volume[(20 * grid.height + 12) * grid.width + 5]);
});
