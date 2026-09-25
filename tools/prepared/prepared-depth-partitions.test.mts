import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { partitionSurface, prepareDepthPartitions, restoreDepthSource } from './prepared-depth-partitions.mts';
import { prepareActivationGroups } from './prepared-activation-groups.mts';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { requireObjectRuntimeDefinition } from '../contract/object-runtime-contract.mts';
import type { PreparedPresentationDefinition, PreparedTree } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PreparedDepthOrder } from '../../src/renderers/css/rendering/prepared-depth-partitions.ts';
import type { SurfacePoint, SurfaceTriangle } from '../../src/renderers/css/navigation/prepared-surface-hit.ts';

const runtimeRoot = fileURLToPath(new URL('../../', import.meta.url));
const mimasInput: unknown = JSON.parse(await readFile(join(runtimeRoot, 'src/objects/mimas/prepared/runtime.json'), 'utf8'));
const mimasRuntime = requireObjectRuntimeDefinition(mimasInput);
type Plane = readonly [number, number, number, number];
type PlaneBranch = { plane: Plane; sign: -1 | 1 };
const point = (x: number, y: number, z: number): SurfacePoint => [x, y, z];
const identityMatrix = (): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const octants: SurfaceTriangle[] = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) octants.push([point(x, 0, 0), point(0, y, 0), point(0, 0, z)]);

test('prepared order separates all original faces without a crossing or a duplicate', () => {
  const result = partitionSurface(octants, 1);
  assert.equal(result.groups.length, 8);
  assert.deepEqual(result.groups.flat().sort((a, b) => a - b), octants.map((_, i) => i));
  function visit(node: PreparedDepthOrder, planes: readonly PlaneBranch[] = []) {
    if ('group' in node) for (const face of result.groups[node.group]) for (const vertex of octants[face]) {
      for (const { plane, sign } of planes) assert.ok(sign * (plane[0] * vertex[0] + plane[1] * vertex[1] + plane[2] * vertex[2] + plane[3]) >= -1e-5);
    } else if ('sequence' in node) {
      for (const entry of node.sequence) visit(entry, planes);
    } else {
      visit(node.back, [...planes, { plane: node.plane, sign: -1 }]);
      visit(node.front, [...planes, { plane: node.plane, sign: 1 }]);
    }
  }
  visit(result.order);
  assert.deepEqual(partitionSurface(octants, 1), result);
});

test('an unpartitionable surface keeps its native depth space', () => {
  const triangle: SurfaceTriangle = [point(-1, -1, 1), point(1, -1, 1), point(0, 1, 1)];
  assert.equal(partitionSurface([triangle, triangle, triangle], 1).groups.length, 1);
});

test('a partially separable surface cannot bypass the per-group face budget', () => {
  const source = { camera: mimasRuntime.camera, tree: { camera: 0, scene: 0, stageClasses: [], properties: [], nodes: [{ tag: 'div', parent: -1, className: null, style: '', properties: [], attributes: {} }] }, variants: [], materials: [], viewBindings: [], animations: [], surfaceHit: { target: 0, triangles: octants.flatMap(face => Array.from({ length: 65 }, () => face)) } } satisfies PreparedPresentationDefinition;
  assert.ok(partitionSurface(source.surfaceHit.triangles).groups.length > 1);
  assert.equal(prepareDepthPartitions(source, null), source);
});

test('compilation retains every original leaf and remaps selection, facing and activation ownership together', () => {
  const triangles = octants.flatMap(face => Array.from({ length: 16 }, () => face));
  const node = (parent: number, className: string | null, style = ''): PreparedTree['nodes'][number] => ({ parent, className, style, tag: 'div', properties: [], attributes: {} });
  const source = { camera: mimasRuntime.camera, tree: { camera: 0, scene: 1, stageClasses: [], properties: [],
    nodes: [node(-1, 'polycss-camera'), node(0, 'polycss-scene source-scene'), node(1, 'body'),
      ...triangles.map((_, i) => node(2, null, `transform:translateZ(${i}px)`)), node(-1, 'overlay')] },
    surfaceHit: { target: 2, triangles },
    variants: [{ when: { lensId: null }, required: [], writes: [{ target: 2, kind: 'texture', name: '--texture', resource: 'map', quoted: true }], materials: [] }],
    materials: [], viewBindings: [{ target: 131, kind: 'silhouette-fit', minimumRadius: 0, unitScale: 1 }], animations: [] } satisfies PreparedPresentationDefinition;
  const original = JSON.stringify(source);
  const result = prepareDepthPartitions(source, { target: 2, leaves: triangles.map((_, i) => i + 3),
    bodyFromScene: identityMatrix() });
  assert.ok(result.depthPartitions);
  assert.equal(JSON.stringify(source), original);
  assert.equal(result.depthPartitions.groups.length, 2);
  // Every leaf keeps its own style: exactly one moved node carries each source triangle's transform.
  for (const [i] of triangles.entries()) assert.equal(result.tree.nodes.filter(n => n.style === source.tree.nodes[i + 3].style).length, 1);
  assert.equal(result.tree.nodes[result.viewBindings[0].target].className, 'overlay');
  assert.equal(result.variants[0].writes.length, 3);
  assert.equal(result.tree.nodes.filter(n => n.className?.split(' ').includes('polycss-scene')).length, 1);
  for (const [i, record] of result.tree.nodes.entries()) assert.ok(record.parent < i);
  const restored = restoreDepthSource(result);
  assert.deepEqual(restored, { ...source, tree: { ...source.tree, activationGroups: prepareActivationGroups(source) } });
});
