import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
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
