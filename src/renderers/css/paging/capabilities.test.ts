import { test } from 'vitest';
import assert from 'node:assert/strict';
import { earthPagingFixture as runtime } from '../../../../tests/objects/unit/earth/paging-fixture.mts';
import { parsePreparedPagePlan } from './capabilities';

test('retained paged surface and noise fixtures preserve every prepared field, including metadata stubs', () => {
  assert.equal(runtime.pageLayers.length, 2);
  for (const layer of runtime.pageLayers) assert.equal(parsePreparedPagePlan(layer.plan), layer.plan);
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
  ]) {
    const input = structuredClone(plan); mutate(input);
    assert.throws(() => parsePreparedPagePlan(input), /Invalid/);
  }
});
