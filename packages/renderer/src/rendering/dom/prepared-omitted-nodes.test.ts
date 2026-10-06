import { type PreparedTree, type PreparedVariant } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { omittedPreparedNodes, preparedMeshLeaves } from './prepared-omitted-nodes.js';

test('a selection omits the descendants of its hidden subtrees and the leaves of every mesh but its own', () => {
  const record = (parent: number) => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} });
  // Node 1 holds two meshes: `a` is leaves 2 and 3, `b` is leaf 4. Node 5 is a hidden subtree with one child.
  const tree = { nodes: [record(-1), record(0), record(1), record(1), record(1), record(0), record(5)], properties: [], camera: 0, scene: 0, stageClasses: [],
    meshes: [{ name: 'a', leaves: [[2, 2]] }, { name: 'b', leaves: [[4, 1]] }] } as unknown as PreparedTree;
  const variant = (mesh: string) => ({ when: {}, required: [], materials: [], hiddenSubtrees: [5], writes: [], mesh }) as unknown as PreparedVariant;
  assert.deepEqual([...omittedPreparedNodes(tree, variant('a'))], [4, 6]);
  assert.deepEqual([...omittedPreparedNodes(tree, variant('b'))], [2, 3, 6]);
  // Without a selection nothing is known to be hidden.
  assert.deepEqual([...omittedPreparedNodes(tree, undefined)], []);
  assert.deepEqual([...preparedMeshLeaves(tree)], [[2, 'a'], [3, 'a'], [4, 'b']]);
});
