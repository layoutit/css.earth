import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sampleStatistics } from './index.js';

test('two sample runs are counted, compared bit for bit and above the median, walking the samples twice', async () => {
  const first = [1, 2, NaN, 4, 8, 16], second = [1, 2.5, 3, NaN, 8, 12];
  let walks = 0;
  const statistics = await sampleStatistics(visit => { walks++; first.forEach((value, index) => visit(value, second[index]!)); }, first.length);
  assert.equal(walks, 2);
  assert.deepEqual({ ...statistics, aboveMedian: undefined }, { samples: 6, both: 4, identical: 2, onlyFirst: 1, onlySecond: 1, identicalShare: 0.5,
    medianLevel: 2.5, medianAbsoluteDifferenceOverMedian: 0 / 2.5, aboveMedian: undefined });
  assert.equal(statistics.aboveMedian.samples, 2);
  assert.deepEqual(statistics.aboveMedian.relativeDifference, { median: 0, p99: 0, largest: 1 / 3 });
  const empty = await sampleStatistics(() => undefined, 0, Float32Array);
  assert.equal(empty.identicalShare, null);
  assert.equal(empty.aboveMedian.correlation, null);
  assert.equal(empty.aboveMedian.relativeDifference, null);
});
