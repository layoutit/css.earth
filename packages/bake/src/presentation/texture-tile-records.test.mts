import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { textureTileVariables, withTextureTileRecords, withoutTextureTileRecords } from './texture-tile-records.ts';

// Earth's variable form (paged-ellipsoid globe/scene-leaves.ts): the body, node 1, writes page 0's image and initial sheet
// tile; its two leaves read them. The cutaway body, node 3, writes the same page with no initial tile; its leaf reads the
// fallbacks.
const leaf = (x: number, y: number, width: number) => [
  { name: 'backgroundPosition', value: `calc(-1px * var(--page-0-x, 0) - ${x}px) calc(-1px * var(--page-0-y, 0) - ${y}px)`, custom: false },
  { name: 'backgroundSize', value: `calc(${width}px * var(--page-0-scale, 1)) auto`, custom: false },
  { name: 'transform', value: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', custom: false },
];
const properties = [
  { name: '--page-0', value: 'url("/sheet.webp")', custom: true },
  ...textureTileVariables('--page-0', { x: 168, y: 0, scale: 7 }).map(([name, value]) => ({ name, value, custom: true })),
  ...leaf(0.25, 0.25, 168), ...leaf(84.0625, 0.25, 168), ...leaf(0.25, 42, 168),
];
const style = (x: number, y: number) => `transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);--polycss-atlas-width:83.3125px;background-position:calc(-1px * var(--page-0-x, 0) - ${x}px) calc(-1px * var(--page-0-y, 0) - ${y}px);background-size:calc(168px * var(--page-0-scale, 1)) auto;background-image:var(--page-0)`;
const variable = () => ({
  id: 'fixture',
  variants: [{ writes: [{ kind: 'texture' as const, target: 1, name: '--page-0', resource: 'page:normal:0', quoted: true }, { kind: 'texture' as const, target: 3, name: '--page-0', resource: null, quoted: true }] }],
  textureLevels: { hysteresis: 0.2, levels: [{ minimumDiameter: 0, resources: { 'page:normal:0': 'sheet' }, tiles: { 'page:normal:0': { x: 168, y: 0, scale: 7 } } }, { minimumDiameter: 230, resources: { 'page:normal:0': 'page' } }] },
  tree: {
    nodes: [
      { parent: -1, style: '', properties: [] },
      { parent: 0, style: 'transform:rotateZ(-128deg)', properties: [0, 1, 2, 3] },
      { parent: 1, style: style(0.25, 0.25), properties: [4, 5, 6] },
      { parent: 0, style: '', properties: [] },
      { parent: 3, style: style(84.0625, 0.25), properties: [7, 8, 9] },
      { parent: 1, style: style(0.25, 42), properties: [10, 11, 12] },
    ],
    properties,
    textureBindings: [{ target: 1, name: '--page-0', leaves: [2, 5] }, { target: 3, name: '--page-0', leaves: [4] }],
  },
});
const value = (tree: { nodes: readonly { properties: readonly number[] }[]; properties: readonly { name: string; value: string }[] }, node: number, name: string) =>
  tree.nodes[node]!.properties.map(id => tree.properties[id]!).find(property => property.name === name)?.value;

test('tiled page leaves ship literal values at their initial tile, with one record per texture write', () => {
  const recorded = withTextureTileRecords(variable());
  assert.deepEqual(recorded.textureLevels.tileLeaves, [
    { target: 1, name: '--page-0', unit: -1, width: 168, initial: { x: 168, y: 0, scale: 7 }, leaves: [[2, 0.25, 0.25], [5, 0.25, 42]] },
    { target: 3, name: '--page-0', unit: -1, width: 168, leaves: [[4, 84.0625, 0.25]] },
  ]);
  // The body's leaves resolve the body's initial tile; the cutaway's leaf the fallbacks, the page itself.
  assert.equal(value(recorded.tree, 2, 'backgroundPosition'), '-168.25px -0.25px');
  assert.equal(value(recorded.tree, 2, 'backgroundSize'), '1176px auto');
  assert.equal(value(recorded.tree, 5, 'backgroundPosition'), '-168.25px -42px');
  assert.equal(value(recorded.tree, 4, 'backgroundPosition'), '-84.0625px -0.25px');
  assert.equal(value(recorded.tree, 4, 'backgroundSize'), '168px auto');
  // No tile variable, calc() or duplicate static declaration is left; the image and the leaf's other values stay.
  assert.doesNotMatch(JSON.stringify(recorded.tree), /--page-0-(?:x|y|scale)|calc\(/);
  assert.equal(value(recorded.tree, 1, '--page-0'), 'url("/sheet.webp")');
  assert.equal(recorded.tree.nodes[2]!.style, 'transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);--polycss-atlas-width:83.3125px;background-image:var(--page-0);');
  assert.equal(value(recorded.tree, 2, 'transform'), 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
});

test('the inverse restores the variable form the bindings measure, and records again identically', () => {
  const recorded = withTextureTileRecords(variable());
  const restored = withoutTextureTileRecords(recorded);
  const original = variable().tree;
  assert.equal(restored.textureLevels.tileLeaves, undefined);
  for (const node of [2, 4, 5]) for (const name of ['backgroundPosition', 'backgroundSize'])
    assert.equal(value(restored.tree, node, name), value(original, node, name), `node ${node} ${name}`);
  for (const [name, expected] of textureTileVariables('--page-0', { x: 168, y: 0, scale: 7 })) assert.equal(value(restored.tree, 1, name), expected);
  assert.equal(value(restored.tree, 3, '--page-0-x'), undefined);
  assert.deepEqual(withTextureTileRecords(restored), recorded);
  // A presentation with no tiled leaf passes through unchanged.
  assert.equal(withTextureTileRecords(recorded), recorded);
  assert.equal(withoutTextureTileRecords(restored), restored);
});

test('a tile chain the records cannot carry is refused with its node and value', () => {
  const unbound = variable();
  unbound.tree.textureBindings = [{ target: 1, name: '--page-0', leaves: [2] }, { target: 3, name: '--page-0', leaves: [4] }];
  assert.throws(() => withTextureTileRecords(unbound), /fixture: prepared node 5 background: a leaf reads texture tile variables but draws no bound texture/);
  const widths = variable();
  widths.tree.properties = widths.tree.properties.map((property, id) => id === 11 ? { ...property, value: 'calc(120px * var(--page-0-scale, 1)) auto' } : property);
  assert.throws(() => withTextureTileRecords(widths), /prepared node 5 background: --page-0 on node 1 has unit -1 and width 168, this leaf -1 and 120/);
  const other = variable();
  other.tree.properties = other.tree.properties.map((property, id) => id === 6 ? { ...property, value: 'translate(calc(var(--page-0-x, 0) * 1px))' } : property);
  assert.throws(() => withTextureTileRecords(other), /prepared node 2 transform: only the background position and size may read a tile variable/);
  const part = variable();
  part.tree.nodes[1] = { ...part.tree.nodes[1]!, properties: [0, 1, 2] };
  assert.throws(() => withTextureTileRecords(part), /prepared node 1 carries part of --page-0's tile/);
});
