import assert from 'node:assert/strict';
import test from 'node:test';
import { traceDurationEvents } from '../../browser/comets/trace-events.mts';
test('Chrome begin/end spans retain per-thread nesting and clip at interaction boundaries', () => {
  const at = (ph, ts, name, tid = 1, dur) => ({ pid: 1, tid, ph, ts, name, ...(dur === undefined ? {} : { dur }) });
  const events = [at('B', 0, 'frame'), at('B', 2, 'script'), at('B', 3, 'raster', 2),
    at('E', 8, undefined), at('E', 9, undefined, 2), at('E', 12), at('X', 11, 'complete', 2, 5),
    at('E', 20), at('B', 21, 'unpaired')];
  const spans = traceDurationEvents(events, 4, 14);
  assert.deepEqual(spans.map(({ name, ts, dur }) => [name, ts, dur]),
    [['script', 4, 4], ['raster', 4, 5], ['complete', 11, 3], ['frame', 4, 8]]);
});
