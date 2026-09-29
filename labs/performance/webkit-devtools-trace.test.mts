import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { devtoolsTrace } from './webkit-devtools-trace.mts';
const test = sourceTest();

test('the DevTools copy preserves memory evidence alongside native screenshots', () => {
  const counter = { ph: 'C', name: 'WebKit memory MiB', pid: 1, tid: 1, ts: 500000, args: { page: 120 } };
  const release = { objectId: 'earth', after: { connectedNodes: 1, resources: { releases: 3 } } };
  const copy = devtoolsTrace({ metadata: { stopwatchEpochMs: 1000 }, traceEvents: [counter,
    { ph: 'i', name: 'cssEarth scene released', cat: 'cssearth.memory', pid: 1, tid: 1, ts: 600000, args: { data: release } },
  ] }, [{ epochMs: 1700, jpeg: 'native-frame' }]);
  assert.deepEqual(copy.traceEvents.find(event => event.ph === 'C'), counter);
  const timestamp = copy.traceEvents.find(event => event.name === 'TimeStamp');
  assert.deepEqual(timestamp?.args, { data: { ...release, frame: 'F1', message: 'cssEarth scene released: earth' }, webkit: 'cssEarth scene released' });
  const screen = copy.traceEvents.find(event => event.name === 'Screenshot');
  assert.equal(screen?.ts, 700000);
});

test('large debug captures convert without spreading timestamps into function arguments', () => {
  const events = Array.from({ length: 150000 }, (_, i) => ({ name: 'TimeStamp', ts: i, ph: 'i', pid: 1, tid: 1, args: { data: {} } }));
  const trace = devtoolsTrace({ traceEvents: events });
  assert.equal(trace.traceEvents.filter(e => e.name === 'TimeStamp').length, events.length);
});

test('the interval sweep preserves top-level tasks and excludes nested style work', () => {
  const event = (name: string, ts: number, dur: number) => ({ name, ts, dur, ph: 'X', pid: 1, tid: 1 });
  const trace = devtoolsTrace({ traceEvents: [event('RenderingFrame', 0, 100), event('FunctionCall', 5, 50),
    event('RecalculateStyles', 5, 20), event('Layout', 25, 10), event('Composite', 60, 20), event('Paint', 62, 16)] });
  assert.deepEqual(trace.traceEvents.filter(e => e.name === 'RunTask').map(e => [e.ts, e.dur]), [[5, 50], [60, 20]]);
});
