import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedObjectRuntime } from './index.js';

const prepared = JSON.parse(await readFile(new URL('../../../../src/planets/deimos/prepared/object.json', import.meta.url), 'utf8')).data;

test('the actual grouped surface keeps one object camera and validates before DOM construction', () => {
  const plan = parsePreparedObjectRuntime(prepared);
  expect(plan.depthPartitions?.groups.length).toBeGreaterThan(1);
  expect(plan.facing?.length).toBe(plan.surfaceHit?.triangles.length);
});

test('transport rejects missing or duplicated depth ownership and invalid separating planes', () => {
  for (const mutate of [
    (plan: typeof prepared) => { plan.depthPartitions.groups[0].root = plan.tree.scene; },
    (plan: typeof prepared) => { plan.depthPartitions.groups[1] = plan.depthPartitions.groups[0]; },
    (plan: typeof prepared) => { plan.depthPartitions.order = { group: 0 }; },
    (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [] }; },
    (plan: typeof prepared) => { plan.depthPartitions.order = { sequence: [{ group: 0 }, { group: 0 }] }; },
    (plan: typeof prepared) => { plan.depthPartitions.order = { plane: [0,0,1,0], back: { group: 0 }, front: { group: 0 } }; },
    (plan: typeof prepared) => { plan.depthPartitions.order.plane = [0,0,2,0]; },
    (plan: typeof prepared) => { delete plan.depthPartitions; },
  ]) {
    const plan = structuredClone(prepared); mutate(plan);
    expect(() => parsePreparedObjectRuntime(plan)).toThrow(/depth|facing/);
  }
});

test('fixed visibility sequences cover the actual retained carriers', () => {
  const plan = structuredClone(prepared);
  plan.depthPartitions.order = { sequence: plan.depthPartitions.groups.map((_: unknown, group: number) => ({ group })) };
  expect(parsePreparedObjectRuntime(plan).depthPartitions?.groups.length).toBe(plan.depthPartitions.groups.length);
});
