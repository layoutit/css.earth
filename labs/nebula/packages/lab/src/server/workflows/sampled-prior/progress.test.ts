import { test } from 'node:test';
import { deepEqual, equal } from 'node:assert/strict';
import { sampledBakeProgress } from './progress.ts';

test('sampled bank progress never reverses when baker phase counters restart', () => {
  const values = (['volume', 'texture', 'compile'] as const).flatMap(phase =>
    [0, 1, 2].map(completed => sampledBakeProgress({ phase, completed, total: 2, message: '' })));
  deepEqual(values, [...values].sort((a, b) => a - b));
  equal(values[0], 0); equal(values.at(-1), 1);
});
