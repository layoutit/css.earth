import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseImageDem } from './image-dem.mts';
import { inspectOpenSurface } from './open-surface.mts';

const profile = { columns: 3, step: 1, xyTransform: [2, 0, 10, 0, -2, 20],
  zOffsetMeters: -5, expectedVertices: 8, expectedFaces: 4 };
// The missing central post leaves a diamond-shaped hole, not a filled cell.
const samples = '0 0 -1\n1 0 0\n2 0 1\n0 1 0\n2 1 2\n0 2 1\n1 2 2\n2 2 3';

test('image DEM preserves holes, source heights and metre frame through reflection', () => {
  const mesh = parseImageDem(samples, profile);
  assert.deepEqual(mesh.positions[0], [10, 20, -6]);
  assert.equal(mesh.heightAt(10, 20), -1);
  assert.equal(mesh.heightAt(11, 19), 0);
  assert.equal(mesh.heightAt(12, 18), null);
  assert.equal(mesh.heightAt(9.99, 20), null);
  assert.equal(mesh.heightAt(14, 16), 3);
  const closest = mesh.closestPoint([10, 20, -6], 1);
  assert.ok(closest);
  assert.equal(closest.normal[2] > 0, true);
  const topology = inspectOpenSurface(Uint32Array.from(mesh.indices.flat()), mesh.positions).report;
  assert.equal(topology.windingConflicts.length, 0);
  assert.equal(topology.faces, 4);
});

test('image DEM rejects changed counts, duplicate posts and implicit frame guesses', () => {
  assert.throws(() => parseImageDem(samples, { ...profile, expectedFaces: 5 }), /dimensions/);
  assert.throws(() => parseImageDem(samples.replace('1 0 0', '0 0 0'), profile), /Duplicate/);
  assert.throws(() => parseImageDem(samples.replace('1 0 0', '0.5 0 0'), profile), /Off-grid/);
  assert.throws(() => parseImageDem(samples, { ...profile, xyTransform: [0, 0, 0, 0, 0, 0] }), /singular/);
  assert.throws(() => parseImageDem(samples, { ...profile, zOffsetMeters: undefined }), /frame/);
});
