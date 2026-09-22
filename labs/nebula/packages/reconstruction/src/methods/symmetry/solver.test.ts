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

test('a pixel with no weight does not pull the voxels it sees to zero: the symmetry groups fill them from the rest', () => {
  // A ring about the x axis, projected; then the image is blanked (written as zero) over one band of rows, as a coronagraph mask
  // would be. Weighted, the ring's voxels seen only through that band are recovered from the ring's other voxels; unweighted,
  // the zeros are fitted as data and pull them down.
  const grid = { width: 12, height: 25, depth: 25 };
  const prior = { axis: [1, 0, 0] as const, center: [5.5, 12, 12] as const, binWidth: 1 };
  const truth = new Float32Array(grid.width * grid.height * grid.depth);
  for (let z = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 2; x < 10; x++) {
    const radius = Math.hypot(y - 12, z - 12);
    if (radius >= 7 && radius < 9) truth[(z * grid.height + y) * grid.width + x] = 0.3;
  }
  const image = projectEmission(truth, grid), weights = new Float32Array(image.length).fill(1);
  for (let y = 10; y <= 14; y++) for (let x = 0; x < grid.width; x++) { image[y * grid.width + x] = 0; weights[y * grid.width + x] = 0; }
  // The ring's near and far walls on the line of sight through the blanked centre row.
  const hidden = (volume: Float32Array) => volume[(20 * grid.height + 12) * grid.width + 5]! + volume[(4 * grid.height + 12) * grid.width + 5]!;
  const weighted = inferEmission({ grid, prior, image, weights, tau: 0.001, iterations: 150 });
  const unweighted = inferEmission({ grid, prior, image, tau: 0.001, iterations: 150 });
  assert.ok(hidden(weighted.volume) > 0.3, `weighted hidden walls ${hidden(weighted.volume)}`);
  assert.ok(hidden(weighted.volume) > 3 * hidden(unweighted.volume), `weighted ${hidden(weighted.volume)}, unweighted ${hidden(unweighted.volume)}`);
});

test('only voxels of fillable pixels are filled: beyond the footprint the volume stays empty', () => {
  const grid = { width: 12, height: 25, depth: 25 };
  const prior = { axis: [1, 0, 0] as const, center: [5.5, 12, 12] as const, binWidth: 1 };
  const truth = new Float32Array(grid.width * grid.height * grid.depth);
  for (let z = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 2; x < 10; x++) {
    const radius = Math.hypot(y - 12, z - 12);
    if (radius >= 7 && radius < 9) truth[(z * grid.height + y) * grid.width + x] = 0.3;
  }
  const image = projectEmission(truth, grid), weights = new Float32Array(image.length).fill(1), fillable = new Uint8Array(image.length);
  // Rows 10-14 are a blank centre (fillable); rows 0-3 lie beyond the footprint (not fillable).
  for (let x = 0; x < grid.width; x++) {
    for (let y = 10; y <= 14; y++) { image[y * grid.width + x] = 0; weights[y * grid.width + x] = 0; fillable[y * grid.width + x] = 1; }
    for (let y = 0; y <= 3; y++) { image[y * grid.width + x] = 0; weights[y * grid.width + x] = 0; }
  }
  const result = inferEmission({ grid, prior, image, weights, fillable, tau: 0.001, iterations: 150 });
  const column = (y: number) => { let total = 0; for (let z = 0; z < grid.depth; z++) total += result.volume[(z * grid.height + y) * grid.width + 5]!; return total; };
  assert.ok(column(12) > 0.3, `blank centre filled: ${column(12)}`);
  assert.equal(column(2), 0, 'beyond the footprint nothing is filled');
});
