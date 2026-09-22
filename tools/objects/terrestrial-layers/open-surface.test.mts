import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { inspectOpenSurface, orientObservedSurface, validateObservedReduction } from './open-surface.mts';

const positions = [[0,0,1],[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]];
const sides = [[0,1,2],[0,2,3],[0,3,4],[0,4,1]];

test('open observations repair plate ordering without closing the missing base', () => {
  const input = sides.map((face,i) => i === 2 ? [face[0],face[2],face[1]] : face);
  const mesh = orientObservedSurface({positions,indices:input});
  assert.equal(mesh.positions,positions);
  assert.deepEqual(mesh.indices,sides);
  assert.deepEqual(mesh.sourceOrientation.reorientedFaces,[2]);
  const indices = Uint32Array.from(mesh.indices.flat());
  const report = validateObservedReduction(indices,indices,positions);
  assert.equal(report.boundaryEdges,4);
  assert.equal(report.edgeComponents,1);
  assert.equal(report.eulerCharacteristic,1);
  assert.throws(() => validateObservedReduction(indices,indices.slice(3),positions), /boundaries or topology/);
  // Filling the missing region is invalid even when all source vertices remain.
  assert.throws(() => validateObservedReduction(indices,Uint32Array.from([...indices,1,4,3,1,3,2]),positions), /source boundaries/);
});

test('nonmanifold edges, degenerate plates and ambiguous source orientation fail', () => {
  assert.throws(() => inspectOpenSurface(Uint32Array.from([0,1,2,0,2,3,0,2,4]),positions), /Nonmanifold/);
  assert.throws(() => inspectOpenSurface(Uint32Array.from([0,1,1]),positions), /Invalid/);
  assert.throws(() => orientObservedSurface({positions,indices:[[0,1,2],[0,3,2]]}), /ambiguous/);
});
