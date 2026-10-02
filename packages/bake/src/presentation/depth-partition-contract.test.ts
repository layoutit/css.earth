import { parsePreparedObjectRuntime } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prepareActivationGroups } from '@cssearth/bake/presentation';

// The mutable fixture keeps the parsed-JSON shape the mutations below rely on.
const source: ReturnType<typeof JSON.parse> = JSON.parse(await readFile(new URL('../../../../src/objects/deimos/prepared/runtime.json', import.meta.url), 'utf8'));
// The published Deimos package can retain native depth. Validate the optional
// partition transport against explicit carriers, independent of that bake choice.
const prepared = structuredClone(source), groups: { root: number; scene: number }[] = [];
const node = (parent: number) => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} });
for (let index = 0; index < 2; index++) {
  const root = prepared.tree.nodes.length, scene = root + 1;
  prepared.tree.nodes.push(node(prepared.tree.camera), node(root), node(scene));
  groups.push({ root, scene });
}
prepared.depthPartitions = { groups, order: { plane: [1, 0, 0, 0], back: { group: 0 }, front: { group: 1 } } };
prepared.tree.activationGroups = prepareActivationGroups(prepared);

test('the published package and explicit grouped carriers validate before DOM construction', () => {
  assert.equal(parsePreparedObjectRuntime(source), source);
  const plan = parsePreparedObjectRuntime(prepared);
  assert.ok((plan.depthPartitions?.groups.length ?? 0) > 1);
  assert.equal(plan.tree.camera, source.tree.camera);
});

for (const { mutate } of [
  { name: 'scene root used as depth owner', mutate: (plan: typeof prepared) => { plan.depthPartitions.groups[0].root = plan.tree.scene; } },
  { name: 'duplicated depth owner', mutate: (plan: typeof prepared) => { plan.depthPartitions.groups[1] = plan.depthPartitions.groups[0]; } },
  { name: 'group omitted from depth order', mutate: (plan: typeof prepared) => { plan.depthPartitions.order = { group: 0 }; } },
  { name: 'empty depth sequence', mutate: (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [] }; } },
  { name: 'duplicated group in depth sequence', mutate: (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [{ group: 0 }, { group: 0 }] }; } },
  { name: 'same group on both sides of separating plane', mutate: (plan: typeof prepared) => { plan.depthPartitions.order = { plane: [0,0,1,0], back: { group: 0 }, front: { group: 0 } }; } },
  { name: 'non-unit separating plane', mutate: (plan: typeof prepared) => { plan.depthPartitions.order.plane = [0,0,2,0]; } },
]) test(`transport rejects $name`, () => {
  const plan = structuredClone(prepared); mutate(plan);
  assert.throws(() => parsePreparedObjectRuntime(plan), /depth/);
});

test('fixed visibility sequences cover every retained carrier', () => {
  const plan = structuredClone(prepared);
  plan.depthPartitions.order = { sequence: plan.depthPartitions.groups.map((_: unknown, group: number) => ({ group })) };
  assert.equal(parsePreparedObjectRuntime(plan).depthPartitions?.groups.length, plan.depthPartitions.groups.length);
});
