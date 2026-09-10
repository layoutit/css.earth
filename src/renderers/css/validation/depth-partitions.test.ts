import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedObjectRuntime } from './index.js';
import { prepareActivationGroups } from '../../../../tools/prepared-activation-groups.mjs';

const source = JSON.parse(await readFile(new URL('../../../planets/deimos/prepared/runtime.json', import.meta.url), 'utf8'));
// The published Deimos package can retain native depth. Validate the optional
// partition transport against explicit carriers, independent of that bake choice.
const prepared = structuredClone(source), groups: { root: number; scene: number }[] = [];
const node = (parent: number) => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} });
prepared.facing = [];
for (let index = 0; index < 2; index++) {
  const root = prepared.tree.nodes.length, scene = root + 1, leaf = root + 2;
  prepared.tree.nodes.push(node(prepared.tree.camera), node(root), node(scene));
  groups.push({ root, scene });
  prepared.facing.push({ target: leaf, plane: [0, 0, 1, 0], tolerance: 1 });
}
prepared.depthPartitions = { groups, order: { plane: [1, 0, 0, 0], back: { group: 0 }, front: { group: 1 } } };
prepared.tree.activationGroups = prepareActivationGroups(prepared);

test('the published package and explicit grouped carriers validate before DOM construction', () => {
  expect(parsePreparedObjectRuntime(source)).toBe(source);
  const plan = parsePreparedObjectRuntime(prepared);
  expect(plan.depthPartitions?.groups.length).toBeGreaterThan(1);
  expect(plan.tree.camera).toBe(source.tree.camera);
  expect(plan.facing?.length).toBe(2);
});

// Each malformed transport is independent. Do not charge eight full-package
// validations to one test timeout on slower CI runners.
test.each([
  ['scene used as carrier', (plan: typeof prepared) => { plan.depthPartitions.groups[0].root = plan.tree.scene; }],
  ['duplicated carrier', (plan: typeof prepared) => { plan.depthPartitions.groups[1] = plan.depthPartitions.groups[0]; }],
  ['missing ordered group', (plan: typeof prepared) => { plan.depthPartitions.order = { group: 0 }; }],
  ['empty sequence', (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [] }; }],
  ['duplicated sequence group', (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [{ group: 0 }, { group: 0 }] }; }],
  ['duplicated plane side', (plan: typeof prepared) => { plan.depthPartitions.order = { plane: [0,0,1,0], back: { group: 0 }, front: { group: 0 } }; }],
  ['nonunit plane', (plan: typeof prepared) => { plan.depthPartitions.order.plane = [0,0,2,0]; }],
  ['missing depth ownership', (plan: typeof prepared) => { delete plan.depthPartitions; }],
] as const)('transport rejects %s', (_name, mutate) => {
  const plan = structuredClone(prepared); mutate(plan);
  expect(() => parsePreparedObjectRuntime(plan)).toThrow(/depth|facing/);
});

test('fixed visibility sequences cover every retained carrier', () => {
  const plan = structuredClone(prepared);
  plan.depthPartitions.order = { sequence: plan.depthPartitions.groups.map((_: unknown, group: number) => ({ group })) };
  expect(parsePreparedObjectRuntime(plan).depthPartitions?.groups.length).toBe(plan.depthPartitions.groups.length);
});
