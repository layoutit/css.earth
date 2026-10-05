import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { withMeshRecords, withoutMeshRecords } from './mesh-records.ts';

// The variable form, as the radial model builder writes it: node 1 is the body; leaves 2 and 3 are the `shape` mesh and
// leaf 4 the `photo` mesh; node 5 is not a mesh leaf. Each selection writes both displays after its texture write.
const texture = { kind: 'texture', target: 1, name: '--rock-surface-image', resource: 'surface:a', quoted: true };
const display = (model: string, value: string) => ({ kind: 'style', target: 1, name: `--rock-${model}-display`, value });
const color = { kind: 'style', target: 5, name: 'backgroundColor', value: '#484848' };
interface Fixture { id: string; tree: { nodes: { parent: number; style: string }[]; properties: never[]; meshes?: readonly { name: string; leaves: readonly (readonly [number, number])[] }[] };
  variants: { when: { datasetId: string }; required: never[]; writes: Record<string, unknown>[] & { kind: string; target: number; name: string }[]; materials: never[]; mesh?: string }[] }
const working = (): Fixture => ({
  id: 'rock',
  tree: { nodes: [
    { parent: -1, style: '' }, { parent: 0, style: 'transform:none' },
    { parent: 1, style: 'width:4px;height:5px;display:var(--rock-shape-display,block)' }, { parent: 1, style: 'width:6px;display:var(--rock-shape-display,block)' },
    { parent: 1, style: 'width:8px;display:var(--rock-photo-display,none)' }, { parent: 0, style: 'opacity:0' },
  ], properties: [] },
  variants: [
    { when: { datasetId: 'a' }, required: [], writes: [texture, display('shape', 'block'), display('photo', 'none'), color], materials: [] },
    { when: { datasetId: 'b' }, required: [], writes: [texture, display('shape', 'none'), display('photo', 'block'), color], materials: [] },
  ],
});

test('alternative meshes ship as records: runs of leaves, and the mesh each selection mounts', () => {
  const records = withMeshRecords(working());
  assert.equal(JSON.stringify({ nodes: records.tree.nodes, writes: records.variants.map(variant => variant.writes.filter(write => write.kind === 'style')) }).includes('--'), false);
  assert.deepEqual(records.tree.meshes, [{ name: 'rock-shape', leaves: [[2, 2]] }, { name: 'rock-photo', leaves: [[4, 1]] }]);
  assert.deepEqual(records.tree.nodes.map(node => node.style), ['', 'transform:none', 'width:4px;height:5px', 'width:6px', 'width:8px', 'opacity:0']);
  assert.deepEqual(records.variants.map(variant => variant.mesh), ['rock-shape', 'rock-photo']);
  assert.deepEqual(records.variants[0]!.writes, [texture, color]);
  assert.equal(withMeshRecords(records), records, 'records are left as they are');
});

test('the records expand back to the form the bindings measure and return to the same records', () => {
  const records = withMeshRecords(working()), expanded = withoutMeshRecords(records);
  assert.deepEqual(expanded, working());
  assert.equal(JSON.stringify(withMeshRecords(expanded)), JSON.stringify(records));
  const none = { id: 'ball', tree: { nodes: [{ parent: -1, style: '' }], properties: [] }, variants: [{ writes: [] }] };
  assert.equal(withMeshRecords(none), none);
  assert.equal(withoutMeshRecords(none), none);
});

test('a selection that does not show exactly one mesh is refused with its key and what it writes', () => {
  const both = working();
  both.variants[1]!.writes = [texture, display('shape', 'block'), display('photo', 'block'), color];
  assert.throws(() => withMeshRecords(both), /rock: selection \{"datasetId":"b"\} must show one mesh and hide the others; it writes --rock-shape-display=block, --rock-photo-display=block/u);
  const missing = working();
  missing.variants[0]!.writes = [texture, display('shape', 'block'), color];
  assert.throws(() => withMeshRecords(missing), /rock: selection \{"datasetId":"a"\} must show one mesh and hide the others; it writes --rock-shape-display=block/u);
});

test('meshes under two parents and a selection naming an unknown mesh are refused', () => {
  const split = working();
  split.tree.nodes[4] = { parent: 0, style: 'width:8px;display:var(--rock-photo-display,none)' };
  assert.throws(() => withMeshRecords(split), /rock: the alternative meshes --rock-shape-display, --rock-photo-display sit under 2 parents \(nodes 1, 0\); they must share one/u);
  const records = withMeshRecords(working());
  assert.throws(() => withoutMeshRecords({ ...records, variants: [{ ...records.variants[0]!, mesh: 'rock-radar' }] }), /rock: selection \{"datasetId":"a"\} names the mesh rock-radar; the tree lists rock-shape, rock-photo/u);
});
