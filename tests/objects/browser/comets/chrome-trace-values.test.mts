import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChromeTrace, hasDuration, hasFrameReporter } from './chrome-trace-values.mts';

const trace = () => ({ traceEvents: [
  { name: 'RunTask', ph: 'X', ts: 1200, dur: 80, pid: 1, tid: 2, args: { source: 'fixture' } },
  { name: 'PipelineReporter', ph: 'b', ts: 1300, pid: 1, tid: 2, args: { frame_reporter: {
    frame_source: 4294967296, frame_sequence: 4, state: 'STATE_PRESENTED_ALL', affects_smoothness: false,
  } } },
  { ph: 'E', ts: 1400, pid: 1, tid: 2 },
], metadata: { source: 'Chrome CDP shape' } });

test('Chrome trace decoding preserves metadata, unnamed ends, and measured event kinds', () => {
  const source = trace(), checked = parseChromeTrace(source);
  assert.deepEqual(checked, source);
  assert.equal(checked.traceEvents.filter(hasDuration).length, 1);
  assert.equal(checked.traceEvents.filter(hasFrameReporter).length, 1);
});

test('Chrome trace decoding rejects mistyped clocks and pipeline measurements', () => {
  const badClock = trace(); Object.assign(badClock.traceEvents[0], { ts: '1200' });
  assert.throws(() => parseChromeTrace(badClock), /ts/);
  const badDuration = trace(); Object.assign(badDuration.traceEvents[0], { dur: NaN });
  assert.throws(() => parseChromeTrace(badDuration), /dur/);
  const badReporter = trace(); Object.assign(badReporter.traceEvents[1], { args: { frame_reporter: { affects_smoothness: 1 } } });
  assert.throws(() => parseChromeTrace(badReporter), /affects_smoothness/);
});
