import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requireMeshes } from './meshes.js';
import type { PreparedTree } from '../presentation/runtime-presentation-types.js';

// Node 1 holds leaves 2, 3 and 4; node 5 is a second container with leaf 6.
const nodes = [-1, 0, 1, 1, 1, 0, 5].map(parent => ({ parent, tag: 'u', className: null, style: '', properties: [], attributes: {} })) as PreparedTree['nodes'];

test('alternative meshes are named runs of leaves under one parent, and each selection names one', () => {
  const meshes = [{ name: 'shape', leaves: [[2, 2]] }, { name: 'photo', leaves: [[4, 1]] }];
  assert.doesNotThrow(() => requireMeshes(meshes, nodes, ['shape', 'photo', 'shape']));
  assert.doesNotThrow(() => requireMeshes(undefined, nodes, [undefined, undefined]));
  assert.throws(() => requireMeshes(meshes, nodes, ['shape', 'radar']), /variant mesh radar is not one of the tree's meshes \(shape, photo\)/u);
  assert.throws(() => requireMeshes(meshes, nodes, ['shape', undefined]), /variant mesh undefined is not one of the tree's meshes/u);
  assert.throws(() => requireMeshes(undefined, nodes, ['shape']), /variant mesh shape is not one of the tree's meshes \(none\)/u);
});

test('a repeated name, a leaf in two meshes, a container, a second parent and a run outside the tree are refused', () => {
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [[2, 1]] }, { name: 'a', leaves: [[3, 1]] }], nodes), /mesh a is listed twice/u);
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [[2, 2]] }, { name: 'b', leaves: [[3, 1]] }], nodes), /mesh b node 3 must be a leaf of the meshes' one parent, in one mesh/u);
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [[1, 1]] }], nodes), /mesh a node 1 must be a leaf/u);
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [[2, 1]] }, { name: 'b', leaves: [[6, 1]] }], nodes), /mesh b node 6 must be a leaf of the meshes' one parent/u);
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [[6, 2]] }], nodes), /mesh a run \[6,2\] is not \[first node, count\] inside the tree/u);
  assert.throws(() => requireMeshes([{ name: 'a', leaves: [] }], nodes), /mesh a lists no leaves/u);
});
