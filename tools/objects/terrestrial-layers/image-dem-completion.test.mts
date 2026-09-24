import { required } from '../../contract/test-values.mts';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import assert from 'node:assert/strict';
import { completeImageDem } from './image-dem-completion.mts';
import { validateClosedMesh } from './radial-mesh.mts';
import { createIndexedShape } from './obj-shape.mts';
const test = sourceTest();

const recipe = { method: 'outline-depth-envelope', depthMeters: 3, faceBudget: 100 };
function closedMesh(front: { vertices: number[][]; }[], added: { vertices: (readonly number[])[]; normal: number[]; estimated: boolean; }[]) {
  const positions: number[][] = [], known = new Map();
  const triangles = [...front, ...added].map(f => f.vertices.map(p => {
    const key = p.join(',');
    if (!known.has(key)) { known.set(key, positions.length); positions.push([...p]); }
    return known.get(key);
  }));
  const topology = validateClosedMesh(triangles.flat(), positions);
  assert.equal(topology.eulerCharacteristic, 2);
  assert.equal(topology.components, 1);
  return createIndexedShape(positions, triangles, { metersPerUnit: 1, expectedVertices: positions.length, expectedFaces: triangles.length });
}

test('closes a boundary-only diagonal without moving the observation or pinching the rear', () => {
  const a = [-2,-2,1], b = [2,-2,1], c = [2,2,1], d = [-2,2,1];
  const front = [{ vertices: [a,b,c] }, { vertices: [a,c,d] }], original = structuredClone(front);
  const completion = completeImageDem(front, recipe, 1);
  assert.deepEqual(front, original);
  assert.ok(completion.faces.every(f => f.estimated));
  const mesh = closedMesh(front, completion.faces);
  assert.equal(required(mesh.intersect([0,0,10], [0,0,-1])).radius, 9);
  assert.equal(required(mesh.intersect([0,0,-10], [0,0,1])).radius, 8);
  assert.equal(mesh.intersect([3,0,10], [0,0,-1]), null);
});

test('fills an internal gap as estimated while preserving its observed rim', () => {
  const p = [[-2,-2,1],[2,-2,1],[2,2,1],[-2,2,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const front = [[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]].map(ids => ({vertices: ids.map(i => p[i])}));
  const completion = completeImageDem(front, recipe, 1);
  assert.equal(completion.report.gapFaces, 2);
  assert.equal(completion.report.boundaryVertices, 4);
  assert.equal(required(closedMesh(front, completion.faces).intersect([0,0,10], [0,0,-1])).radius, 9);
  assert.throws(() => completeImageDem(front, { ...recipe, faceBudget: 4 }, 1), /budget/);
});
