import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { createPreparedNodeTree } from './prepared-node-tree.ts';
import { PREPARED_LEAF_CLASS, PREPARED_LEAF_RULE, RASTER_TRIANGLE_ATTRIBUTES, cleanPreparedTree, preparedPropertyName, withCleanLeaves,
  withoutCleanLeaves } from './clean-leaves.ts';

const root = resolve(import.meta.dirname, '../../../..');
const LEAF = [
  { name: 'transformStyle', value: 'preserve-3d', custom: false }, { name: 'backgroundRepeat', value: 'no-repeat', custom: false },
  { name: 'backgroundOrigin', value: 'border-box', custom: false }, { name: 'backgroundClip', value: 'border-box', custom: false },
  { name: 'pointerEvents', value: 'none', custom: false },
];
const projection = { 'data-prepared-projection': 'single-leaf' };
// The builder's inline form: two projective leaves (one that also carries a `background` shorthand, one with padding), a raster
// triangle, and a mesh whose static transform a later property replaces.
const inline = () => ({
  id: 'fixture', viewBindings: [],
  tree: {
    camera: 0, scene: 0, stageClasses: [],
    properties: [...LEAF, { name: 'transform', value: 'rotate(2deg)', custom: false }, { name: 'transform', value: 'rotate(3deg)', custom: false }],
    nodes: [
      { parent: -1, tag: 'div', className: 'polycss-mesh', style: 'transform:rotate(1deg);width:0', properties: [5, 6], attributes: {} },
      { parent: 0, tag: 's', className: null, style: 'background-image:var(--x-surface-image);width:8px', properties: [0, 1, 2, 3, 4], attributes: { ...projection } },
      { parent: 0, tag: 's', className: 'x-polar', style: 'background:url(/a.webp)', properties: [0, 1, 2, 3, 4], attributes: { ...projection } },
      { parent: 0, tag: 's', className: null, style: 'padding:1px', properties: [0, 1, 2, 3, 4], attributes: { ...projection } },
      { parent: 0, tag: 'u', className: 'x-terrain-face', style: 'width:4px', properties: [], attributes: { ...RASTER_TRIANGLE_ATTRIBUTES, 'data-surface-model': 'shape' } },
    ],
  },
});
type Tree = ReturnType<typeof inline>['tree'];
const declared = (tree: Tree, index: number) => {
  const node = tree.nodes[index]!;
  return [...node.style.split(';').filter(Boolean).map(part => part.split(':')[0]!),
    ...node.properties.map(id => preparedPropertyName(tree.properties[id]!))];
};

test('each declaration ships once, and a projective leaf reads the shared rule unless another inline declaration needs its own', () => {
  const { tree } = withCleanLeaves(inline());
  // The mesh: its static transform and the first property are replaced by the last property.
  assert.equal(tree.nodes[0]!.style, 'width:0;');
  assert.deepEqual(tree.nodes[0]!.properties.map(id => tree.properties[id]!.value), ['rotate(3deg)']);
  // A plain leaf: the class, no marker attribute, none of the five declarations.
  assert.equal(tree.nodes[1]!.className, PREPARED_LEAF_CLASS);
  assert.deepEqual(tree.nodes[1]!.attributes, {});
  assert.deepEqual(declared(tree, 1), ['background-image', 'width']);
  // A `background` shorthand also sets the repeat, origin and clip: those stay inline, where they won before.
  assert.equal(tree.nodes[2]!.className, `x-polar ${PREPARED_LEAF_CLASS}`);
  assert.deepEqual(declared(tree, 2), ['background', 'background-repeat', 'background-origin', 'background-clip']);
  // Padding makes the origin mean something: it stays.
  assert.deepEqual(declared(tree, 3), ['padding', 'background-origin', 'background-clip']);
  // The raster triangle keeps only what runtime reads.
  assert.deepEqual(tree.nodes[4]!.attributes, { 'data-surface-model': 'shape' });
  assert.deepEqual(withCleanLeaves({ ...inline(), tree }).tree, tree, 'idempotent');
});

test('the inverse restores the markers and declarations the bindings and the leaf layout check read', () => {
  const restored = withoutCleanLeaves(withCleanLeaves(inline())).tree, source = inline().tree;
  for (const [index, node] of source.nodes.entries()) {
    assert.equal(restored.nodes[index]!.className, node.className);
    assert.deepEqual(restored.nodes[index]!.attributes, node.attributes);
    assert.deepEqual(new Set(declared(restored, index)), new Set(declared(source, index).filter(name => index !== 0 || name === 'transform' || name === 'width')));
  }
  assert.deepEqual(withCleanLeaves({ ...inline(), tree: restored }).tree, withCleanLeaves(inline()).tree);
});

test('the node builder finishes the clean form', () => {
  const builder = createPreparedNodeTree(), camera = builder.element(), scene = builder.element();
  builder.append(null, camera); builder.append(camera, scene);
  const leaf = builder.leaf({ style: 'width:32px;height:16px;background-position:-8px -12px;background-size:512px 256px;background-image:url(/prepared.webp)',
    projectiveTextureLayer: { schema: 'polycss-prepared-projective-texture-layer@1', frameMatrix: '1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1', textureMatrix: '1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1', rasterScale: 4 } });
  builder.append(scene, leaf);
  const { tree, index } = builder.finish({ camera, scene }), node = tree.nodes[index(leaf)]!;
  assert.equal(node.className, PREPARED_LEAF_CLASS);
  assert.deepEqual(node.attributes, {});
  // The layout replaced every static length and address; each ships once, as its property.
  assert.equal(node.style, 'background-image:url(/prepared.webp);');
  assert.deepEqual(node.properties.map(id => tree.properties[id]!.name).sort(), ['backgroundPosition', 'backgroundSize', 'height', 'transform', 'width']);
  assert.deepEqual(cleanPreparedTree(tree), tree);
});

test('the shell stylesheet gives the leaf class exactly the rule the bake removes from each leaf', async () => {
  const css = await readFile(resolve(root, 'site/object-shell.css'), 'utf8');
  const rule = new RegExp(String.raw`(?:^|\})\s*\.${PREPARED_LEAF_CLASS}\s*\{([^}]*)\}`, 'mu').exec(css.replace(/\/\*[\s\S]*?\*\//gu, ''));
  assert.ok(rule, `site/object-shell.css declares .${PREPARED_LEAF_CLASS}`);
  const declarations = Object.fromEntries(rule[1]!.split(';').map(part => part.trim()).filter(Boolean).map(part => part.split(/\s*:\s*/u) as [string, string]));
  assert.deepEqual(declarations, Object.fromEntries(Object.entries(PREPARED_LEAF_RULE).map(([name, value]) => [preparedPropertyName({ name, custom: false }), value])));
});
