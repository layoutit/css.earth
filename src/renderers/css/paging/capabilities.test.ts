import { requireRecord, requireArray } from '../../../../tools/sources/source-values.mts';
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { preparedPagingFixture as runtime } from './__fixtures__/prepared-page.mts';
import { parsePreparedPagePlan } from './capabilities';

test('source-backed paged surface and noise plans retain every prepared field, including metadata stubs', () => {
  assert.equal(runtime.pageLayers.length, 2);
  for (const layer of runtime.pageLayers) assert.equal(parsePreparedPagePlan(layer.plan), layer.plan);
  assert.ok(runtime.pageLayers.some(layer => layer.plan.roots.some(root => root.stub && root.children === undefined)));
});
test('invalid page ownership, budgets, roots and matrix bindings fail before mount', () => {
  const plan = runtime.pageLayers[0].plan;
  const mutations: ((value: Record<string, unknown>) => void)[] = [
    value => { value.assetPath = '/'; },
    value => { value.poolSize = 513; },
    value => { value.maximumDecodedBytes = 1; },
    value => { requireRecord(value.initialLayer).frameMatrix = null; },
    value => { requireRecord(requireArray(value.roots)[0]).normal = [NaN, 0, 1]; },
    value => { requireRecord(requireArray(value.roots)[0]).corners = []; },
  ];
  for (const mutate of mutations) {
    const input = requireRecord(structuredClone(plan)); mutate(input);
    assert.throws(() => parsePreparedPagePlan(input), /Invalid/);
  }
});
