import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partitionSurface, prepareDepthPartitions, restoreDepthSource } from './prepared-depth-partitions.mjs';
import { prepareActivationGroups } from './prepared-activation-groups.mjs';

const octants = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) octants.push([[x, 0, 0], [0, y, 0], [0, 0, z]]);

test('prepared order separates all original faces without a crossing or a duplicate', () => {
  const result = partitionSurface(octants, 1);
  assert.equal(result.groups.length, 8);
  assert.deepEqual(result.groups.flat().sort((a, b) => a - b), octants.map((_, i) => i));
  function visit(node, planes = []) {
    if ('group' in node) for (const face of result.groups[node.group]) for (const vertex of octants[face]) {
      for (const { plane, sign } of planes) assert.ok(sign * plane.slice(0, 3).reduce((sum, n, axis) => sum + n * vertex[axis], plane[3]) >= -1e-5);
    } else {
      visit(node.back, [...planes, { plane: node.plane, sign: -1 }]);
      visit(node.front, [...planes, { plane: node.plane, sign: 1 }]);
    }
  }
  visit(result.order);
  assert.deepEqual(partitionSurface(octants, 1), result);
});

test('an unpartitionable surface keeps its native depth space', () => {
  const triangle = [[-1, -1, 1], [1, -1, 1], [0, 1, 1]];
  assert.equal(partitionSurface([triangle, triangle, triangle], 1).groups.length, 1);
});

test('a partially separable surface cannot bypass the per-group face budget', () => {
  const source = { surfaceHit: { triangles: octants.flatMap(face => Array.from({ length: 65 }, () => face)) } };
  assert.ok(partitionSurface(source.surfaceHit.triangles).groups.length > 1);
  assert.equal(prepareDepthPartitions(source, {}), source);
});

test('compilation retains every original leaf and remaps selection, facing and activation ownership together', () => {
  const triangles = octants.flatMap(face => Array.from({ length: 16 }, () => face));
  const node = (parent, className, style = '') => ({ parent, className, style, tag: 'div', properties: [], attributes: {} });
  const source = { tree: { camera: 0, scene: 1, stageClasses: [], properties: [],
    nodes: [node(-1, 'polycss-camera'), node(0, 'polycss-scene source-scene'), node(1, 'body'),
      ...triangles.map((_, i) => node(2, null, `transform:translateZ(${i}px)`)), node(-1, 'overlay')] },
    surfaceHit: { target: 2, triangles },
    variants: [{ writes: [{ target: 2, kind: 'texture', name: '--texture', resource: 'map', quoted: true }], materials: [] }],
    materials: [], viewBindings: [{ target: 131, kind: 'silhouette-fit' }], animations: [],
    facing: triangles.map((_, i) => ({ target: i + 3, plane: [0, 0, 1, 0], tolerance: 1 })) };
  const original = JSON.stringify(source);
  const result = prepareDepthPartitions(source, { target: 2, leaves: triangles.map((_, i) => i + 3),
    bodyFromScene: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] });
  assert.equal(JSON.stringify(source), original);
  assert.equal(result.depthPartitions.groups.length, 2);
  for (const [i, face] of result.facing.entries()) assert.equal(result.tree.nodes[face.target].style, source.tree.nodes[i + 3].style);
  assert.equal(result.tree.nodes[result.viewBindings[0].target].className, 'overlay');
  assert.equal(result.variants[0].writes.length, 3);
  assert.equal(result.tree.nodes.filter(n => n.className?.split(' ').includes('polycss-scene')).length, 1);
  for (const [i, record] of result.tree.nodes.entries()) assert.ok(record.parent < i);
  const restored = restoreDepthSource(result);
  assert.deepEqual(restored, { ...source, tree: { ...source.tree, activationGroups: prepareActivationGroups(source) } });
});
