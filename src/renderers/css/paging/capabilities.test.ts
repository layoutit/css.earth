import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePreparedPagePlan } from './capabilities';

const runtime = JSON.parse(await readFile(new URL('../../../planets/earth/prepared/runtime.json', import.meta.url), 'utf8'));
test('actual base and geographic plans retain every prepared field, including metadata stubs', () => {
  assert.equal(runtime.pageLayers.length, 2);
  for (const layer of runtime.pageLayers) assert.equal(parsePreparedPagePlan(layer.plan, {lensIds:layer.lensIds,geographic:layer.geographic}), layer.plan);
  assert.ok(runtime.pageLayers.some(layer => layer.plan.roots.some(root => root.stub && root.children === undefined)));
});
test('invalid page ownership, budgets, roots and matrix bindings fail before mount', () => {
  const plan = runtime.pageLayers[0].plan;
  for (const mutate of [
    value => { value.assetPath = '/'; },
    value => { value.poolSize = 513; },
    value => { value.maximumDecodedBytes = 1; },
    value => { value.initialLayer.frameMatrix = null; },
    value => { value.roots[0].normal = [NaN, 0, 1]; },
    value => { value.roots[0].corners = []; },
    value => { value.opaqueDiscs = [{center:[0,0,0],normal:[0,0,2],radius:1}]; },
    value => { value.opaqueDiscs = [{center:[NaN,0,0],normal:[0,0,1],radius:1}]; },
    value => { value.opaqueDiscs = [{center:[0,0,0],normal:[0,0,1],radius:0}]; },
    value => { value.opaqueDiscs = Array(17).fill({center:[0,0,0],normal:[0,0,1],radius:1}); },
  ]) {
    const input = structuredClone(plan); mutate(input);
    assert.throws(() => parsePreparedPagePlan(input), /Invalid/);
  }
});
