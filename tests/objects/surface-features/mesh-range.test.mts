import assert from 'node:assert/strict';
import { sourceTest } from '../source-test.mts';
import { selectFeatureMeshRange } from '@cssearth/bake/objects/surface-features';
const test = sourceTest();
const ranges = [{ lensId: 'shape', start: 0, count: 100 }, { lensId: 'photo', start: 100, count: 200 },
  { lensId: 'regions', start: 100, count: 200 }, { lensId: 'science', start: 300, count: 150 }];
test('places share a picking mesh across datasets only when every declared range is identical', () => {
  assert.deepEqual(selectFeatureMeshRange(['photo', 'regions'], ranges, 450), ranges[1]);
  assert.deepEqual(selectFeatureMeshRange(['shape'], ranges, 450), ranges[0]);
  for (const ids of [['photo', 'science'], ['photo', 'missing'], ['photo', 'photo'], []])
    assert.throws(() => selectFeatureMeshRange(ids, ranges, 450), /matching mesh range/);
  assert.throws(() => selectFeatureMeshRange(['photo'], [...ranges, ranges[1]!], 450));
  assert.throws(() => selectFeatureMeshRange(['science'], ranges, 449), /Invalid feature mesh range/);
});
