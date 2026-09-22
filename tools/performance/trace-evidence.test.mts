import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { collectSamples, sampledHotspots, correlateEvidence, navigationSpans } from './trace-evidence.mts';
import type { EvidenceInput } from './trace-evidence.mts';
import type { JsonRecord, TraceEvent } from './trace-model.mts';

const event = (name: string, ts: number, args: JsonRecord = {}, more: Partial<TraceEvent> = {}): TraceEvent => ({ name, ts, args, pid: 1, tid: 2, ph: 'I', ...more });
const frame = (column: number) => ({ url: 'http://localhost/a.js', functionName: 'publish', lineNumber: 0, columnNumber: column, codeType: 'JS' });

test('sample ownership uses profile ID and full function location, including the column', () => {
  const events = [
    event('Profile', 0, { data: { startTime: 0 } }, { ph: 'P', id: 'a' }),
    event('ProfileChunk', 5000, { data: { cpuProfile: { nodes: [
      { id: 1, callFrame: frame(10) }, { id: 2, callFrame: frame(20) },
    ], samples: [1, 2] }, timeDeltas: [1000, 2000] } }, { ph: 'P', tid: 99, id: 'a' }),
    event('ProfileChunk', 5000, { data: { cpuProfile: { nodes: [{ id: 1, callFrame: frame(100) }], samples: [1] }, timeDeltas: [9000] } }, { ph: 'P', id: 'other' }),
  ];
  const hot = sampledHotspots(collectSamples(events, 1, 2), 500, 2000);
  assert.equal(hot.length, 2);
  assert.deepEqual(hot.map(h => [h.columnNumber, h.sampledMs]), [[21, 1], [11, .5]]);
});

test('navigation ignores backdated async measures and keeps incomplete captures explicit', () => {
  const mark = (phase: string, ts: number, ph = 'I') => event('cssEarth:navigation:' + phase, ts, {
    data: { detail: JSON.stringify({ id: 1, from: 'sun', to: 'mars', phase }) },
  }, { ph });
  const { navigations } = navigationSpans([mark('requested', 0), mark('first-motion', 0, 'b'), mark('first-motion', 44000), mark('first-motion', 44000, 'e')], 0, 100000);
  assert.equal(navigations[0]?.phases.length, 2);
  assert.equal(navigations[0]?.phases[1]?.sinceRequestMs, 44);
  assert.equal(navigations[0]?.incomplete, true);
});

test('rendering joins same-document scheduling stacks and does not reuse a consumed trigger', () => {
  const stack = [{ url: 'http://localhost/a.js', lineNumber: 1, columnNumber: 11, functionName: 'setTransform' }];
  const events = [
    event('ScheduleStyleRecalculation', 100, { data: { frame: 'main', stackTrace: stack } }),
    event('ScheduleStyleRecalculation', 110, { data: { frame: 'iframe', stackTrace: [frame(99)] } }),
    event('UpdateLayoutTree', 200, { beginData: { frame: 'main' }, elementCount: 8000 }, { ph: 'X', dur: 20000 }),
    event('UpdateLayoutTree', 30000, { beginData: { frame: 'main' }, elementCount: 9000 }, { ph: 'X', dur: 10000 }),
    event('SchedulePostMessage', 100, { data: { traceId: 'A', stackTrace: stack } }),
    event('SchedulePostMessage', 200, { data: { traceId: 'B' } }),
    event('HandlePostMessage', 500, { data: { traceId: 'A' } }, { tid: 99, ph: 'X', dur: 50 }),
  ];
  const brief: EvidenceInput = { selection: { rendererPid: 1, rendererMainTid: 2 }, window: { startTs: 0, endTs: 50000 },
    displayBudgetMs: 16.667, evidenceGaps: [], busiestTasks: [{ traceStartUs: 0, atMs: 0, durationMs: 45, calls: [] }] };
  const correlated = correlateEvidence({ events }, brief);
  const passes = correlated.busiestTasks[0]?.renderingPasses;
  assert.ok(passes);
  assert.equal(passes[0]?.triggers[0]?.stack[0]?.functionName, 'setTransform');
  assert.equal(passes[0]?.triggerCount, 1);
  assert.equal(passes[1]?.triggerCount, 0);
  assert.equal(correlated.styleInitiators[0]?.totalMs, 20);
  assert.equal(correlated.styleInitiators[0]?.passCount, 1);
  assert.equal(correlated.messageDelivery.slowest[0]?.deliveryDelayMs, .4);
  assert.equal(correlated.messageDelivery.slowest[0]?.traceId, 'A');
});
