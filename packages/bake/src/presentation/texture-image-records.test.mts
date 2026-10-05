import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { withTextureImageRecords, withoutTextureImageRecords } from './texture-image-records.ts';

// The variable form, as the node builders write it and the bindings resolve it:
// - node 1, the source body the depth partitions emptied, keeps its surface write;
// - node 2, a partition carrier, holds the surface slot's first image; its leaves 3 and 4 read the surface variable, leaf 3
//   inline and leaf 4 as a property;
// - node 5, a limb plate with a child, draws its image itself;
// - nothing draws the pole write on node 2.
const texture = (target: number, name: string, resource: string | null) => ({ kind: 'texture' as const, target, name, resource, quoted: true });
const variable = () => ({
  id: 'fixture',
  variants: [{ writes: [texture(1, '--surface', 'surface:a'), texture(2, '--surface', 'surface:a'), texture(2, '--poles', 'poles:a'), texture(5, '--limb', 'limb:a'),
    { kind: 'style' as const, target: 5, name: 'opacity', value: '1' }] }],
  textureLevels: { levels: [], tileLeaves: [{ target: 2, name: '--surface', unit: -1, width: 168, leaves: [[3, 0, 0]] }],
    placements: { body: { center: [0, 0, 0], radius: 1 }, writes: { '--surface': { center: [0, 0, 1], radius: 1, normal: [0, 0, 1], spread: 0.1 } } } },
  tree: {
    properties: [
      { name: '--surface', value: 'url("/first.webp")', custom: true },
      { name: 'backgroundImage', value: 'var(--surface)', custom: false },
      { name: 'width', value: '32px', custom: false },
    ],
    nodes: [
      { parent: -1, style: '', properties: [] },
      { parent: 0, style: '', properties: [] },
      { parent: 0, style: 'transform:rotateZ(-128deg)', properties: [0] },
      { parent: 2, style: 'background-image:var(--surface);background-position:0px 0px;', properties: [2] },
      { parent: 2, style: 'background-position:32px 0px;', properties: [1, 2] },
      { parent: 0, style: '', properties: [] },
      { parent: 5, style: 'opacity:0.2', properties: [] },
    ],
    textureBindings: [{ target: 2, name: '--surface', leaves: [3, 4] }],
  },
});
const containers = [{ target: 5, name: '--limb', node: 5 }];

test('selected images ship as records that name no custom property', () => {
  const records = withTextureImageRecords(variable(), containers);
  assert.equal(JSON.stringify(records).includes('--'), false);
  // The slot lists its elements under a plain name; a write nothing draws keeps an empty slot.
  assert.deepEqual(records.tree.textureBindings, [
    { target: 2, name: 'surface', leaves: [3, 4] }, { target: 1, name: 'surface', leaves: [] }, { target: 2, name: 'poles', leaves: [] }]);
  // Each listed element holds the slot's first image as its own, and the carrier holds none.
  const own = (node: number) => records.tree.nodes[node]!.properties.map(id => records.tree.properties[id]!);
  assert.deepEqual(own(2), []);
  assert.equal(records.tree.nodes[3]!.style, 'background-position:0px 0px;');
  assert.deepEqual(own(3), [{ name: 'width', value: '32px', custom: false }, { name: 'backgroundImage', value: 'url("/first.webp")', custom: false }]);
  assert.deepEqual(own(4), own(3));
  // A write names its slot; the plate's image is the plate's own background.
  assert.deepEqual(records.variants[0]!.writes, [texture(1, 'surface', 'surface:a'), texture(2, 'surface', 'surface:a'), texture(2, 'poles', 'poles:a'),
    texture(5, 'backgroundImage', 'limb:a'), { kind: 'style', target: 5, name: 'opacity', value: '1' }]);
  assert.equal((records.textureLevels.tileLeaves[0] as { name: string }).name, 'surface');
  assert.deepEqual(Object.keys(records.textureLevels.placements.writes), ['surface']);
});

test('the records expand back to the variable form and return to the same records', () => {
  const records = withTextureImageRecords(variable(), containers);
  assert.equal(withTextureImageRecords(records), records, 'records are left as they are');
  const expanded = withoutTextureImageRecords(records);
  const own = (node: number) => expanded.tree.nodes[node]!.properties.map(id => expanded.tree.properties[id]!);
  assert.deepEqual(own(2), [{ name: '--surface', value: 'url("/first.webp")', custom: true }]);
  assert.deepEqual(own(3), [{ name: 'width', value: '32px', custom: false }, { name: 'backgroundImage', value: 'var(--surface)', custom: false }]);
  assert.deepEqual(expanded.variants[0]!.writes.slice(0, 4), [texture(1, '--surface', 'surface:a'), texture(2, '--surface', 'surface:a'), texture(2, '--poles', 'poles:a'),
    texture(5, 'backgroundImage', 'limb:a')]);
  assert.equal((expanded.textureLevels.tileLeaves[0] as { name: string }).name, '--surface');
  assert.deepEqual(Object.keys(expanded.textureLevels.placements.writes), ['--surface']);
  // The bindings find the same slots again; the plate's write already names its own background.
  const again = withTextureImageRecords({ ...expanded, tree: { ...expanded.tree, textureBindings: [{ target: 2, name: '--surface', leaves: [3, 4] }] } }, [{ target: 5, name: 'backgroundImage', node: 5 }]);
  assert.deepEqual(again, records);
});

test('an element that reads a selected image outside every slot is refused by node', () => {
  const stray = variable();
  stray.tree.textureBindings = [{ target: 2, name: '--surface', leaves: [3] }];
  assert.throws(() => withTextureImageRecords(stray, containers), /fixture: prepared node 4 reads a selected image's variable, but no texture slot lists it/u);
});

test('elements of one slot with different first images cannot share a carrier', () => {
  const records = withTextureImageRecords(variable(), containers);
  const properties = [...records.tree.properties, { name: 'backgroundImage', value: 'url("/other.webp")', custom: false }];
  const nodes = records.tree.nodes.map((node, index) => index === 4 ? { ...node, properties: [properties.length - 1] } : node);
  assert.throws(() => withoutTextureImageRecords({ ...records, tree: { ...records.tree, nodes, properties } }), /fixture: texture slot surface on node 2 has elements with different first images/u);
});
