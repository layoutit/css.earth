import assert from 'node:assert/strict';
import test from 'node:test';
import { occupiedMs } from './trace-sources.mts';

test('nested and overlapping slices are counted once inside the selected window', () => {
  assert.equal(occupiedMs([{ ts: 0, dur: 6000 }, { ts: 1000, dur: 3000 }, { ts: 5000, dur: 4000 }], 2000, 8000), 6);
});
