import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rebuildPropertyTable } from './property-table.ts';

const a = { name: 'width', value: '2px', custom: false };
const duplicate = { ...a };
const b = { name: '--x', value: '1', custom: true };

test('rebuild drops unused entries, remaps in reference order and retains tree/node fields', () => {
  const tree = { scene: 7, nodes: [{ parent: -1, properties: [2, 0, 3, 2] }, { parent: 0, properties: [3] }],
    properties: [a, { name: 'unused', value: '', custom: false }, b, duplicate] };
  const rebuilt = rebuildPropertyTable(tree);
  assert.deepEqual(rebuilt, { scene: 7, nodes: [{ parent: -1, properties: [0, 1, 1, 0] }, { parent: 0, properties: [1] }], properties: [b, a] });
  assert.equal(rebuilt.properties[1], a);
  assert.deepEqual(tree.nodes[0]!.properties, [2, 0, 3, 2]);
  assert.equal(tree.properties.length, 4);
  assert.deepEqual(rebuildPropertyTable(rebuilt), rebuilt);
});

test('rebuild uses supplied transformed nodes and table, including an empty tree', () => {
  const tree = { nodes: [{ properties: [0] }], properties: [a] };
  assert.deepEqual(rebuildPropertyTable(tree, [{ properties: [1, 0] }], [b, a]), { nodes: [{ properties: [0, 1] }], properties: [a, b] });
  assert.deepEqual(rebuildPropertyTable(tree, []), { nodes: [], properties: [] });
});

test('JSON field order remains part of identity', () => {
  const reordered = { custom: false, value: '2px', name: 'width' };
  assert.deepEqual(rebuildPropertyTable({ nodes: [{ properties: [0, 1] }], properties: [a, reordered] }).nodes[0]!.properties, [0, 1]);
});
