import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { parsePdsPlanetocentricShape } from './obj-shape.mjs';
import { preparePdsConstraintMap } from './pds-constraint-map.mjs';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';

const table = `6 8
-90 0 1 3
0 0 2 1
0 90 3 2
0 180 4 3
0 270 5 1
90 0 6 2
0 2 1
0 3 2
0 4 3
0 1 4
5 1 2
5 2 3
5 3 4
5 4 1`;
const profile = { expectedVertices: 6, expectedFaces: 8, metersPerUnit: 1000 };
test('PDS comet plates preserve zero-indexed connectivity, units and every source confidence category', () => {
  const mesh = parsePdsPlanetocentricShape(table, profile);
  assert.deepEqual(mesh.indices[0], [0, 2, 1]);
  assert.equal(mesh.indices.length, 8, 'poorly constrained source estimates remain labelled, not replaced');
  assert.deepEqual(mesh.constraintFlags, [3, 1, 2, 3, 1, 2]);
  assert.deepEqual(mesh.coverage.vertexFlags, { 1: 2, 2: 2, 3: 2 });
  assert.ok(Math.abs(mesh.positions[2][1] - 3000) < 1e-9);
  assert.ok(Math.abs(mesh.positions[5][2] - 6000) < 1e-9);
  assert.throws(() => parsePdsPlanetocentricShape(table.replace('0 90 3 2', '0 90 3 4'), profile), /constraint flag/);
  assert.throws(() => parsePdsPlanetocentricShape(table.replace('\n0 2 1\n', '\n0 2 6\n'), profile), /connectivity/);
});

test('plate coverage preserves observed black and grids both ellipsoid and joining plates', async () => {
  const recipe = { kind: 'plate-coverage', width: 64, height: 32, observedColor: '#000000' };
  const mesh = { indices: [[0, 1, 2], [0, 2, 3], [0, 3, 1]], faceProvenance: [0, 1, 2],
    hit: longitude => ({ faceId: Math.floor(longitude / 120) }) };
  const { data, info } = await sharp(await preparePdsConstraintMap(mesh, recipe)).raw().toBuffer({ resolveWithObject: true });
  const sharedGrid = paintMissingCoverage(Buffer.alloc(data.length), info, new Uint8Array(info.width * info.height).fill(1));
  for (let y = 0; y < info.height; y++) for (const x of [10, 32, 53]) {
    const i = (y * info.width + x) * 3;
    assert.deepEqual(data.subarray(i, i + 3), x === 10 ? Buffer.alloc(3) : sharedGrid.subarray(i, i + 3));
  }
  await assert.rejects(preparePdsConstraintMap({ ...mesh, hit: () => null }, recipe), /Missing PDS plate coverage/);
  await assert.rejects(preparePdsConstraintMap({ ...mesh, faceProvenance: [0, 1, 3] }, recipe), /Invalid PDS plate coverage/);
});
test('constraint colors wrap east longitude and retain source pole flags without category interpolation', async () => {
  const mesh = parsePdsPlanetocentricShape(table, profile);
  const recipe = { width: 16, height: 8, stepDegrees: 90, colors: { 1: '#ff0000', 2: '#00ff00', 3: '#0000ff' } };
  const { data, info } = await sharp(await preparePdsConstraintMap(mesh, recipe)).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x + 1) * 3)];
  assert.deepEqual(at(0, 0), [0, 255, 0]);
  assert.deepEqual(at(0, 7), [0, 0, 255]);
  assert.deepEqual(at(0, 3), [255, 0, 0]);
  assert.deepEqual(at(4, 3), [0, 255, 0]);
  assert.deepEqual(at(8, 3), [0, 0, 255]);
  assert.deepEqual(at(15, 3), [255, 0, 0]);
  await assert.rejects(preparePdsConstraintMap({ ...mesh, coordinates: mesh.coordinates.slice(1), constraintFlags: mesh.constraintFlags.slice(1) }, recipe), /Missing PDS/);
});
