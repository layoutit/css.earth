import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sliceDevtoolsTrace, navigationAnalysis } from './webkit-trace-slices.mts';
import { restoreSchedulingStacks, traceClues } from './webkit-trace-clues.mts';
import { devtoolsTrace } from './webkit-devtools-trace.mts';
const event = (name: string, ts: number, dur = 0, data = {}) => ({ name, ts, dur, ph: dur ? 'X' : 'I', pid: 1, tid: 1, args: { data } });
const mark = (phase: string, ts: number) => event('TimeStamp', ts, 0, { message: 'cssEarth:navigation:' + phase });

test('slices clip work, preserve metadata and native state, and rebase both clocks', () => {
  const trace = { metadata: { stopwatchEpochMs: 1000 }, traceEvents: [
    { name: 'thread_name', ph: 'M', pid: 1, tid: 1 }, event('TracingStartedInBrowser', 100),
    { ...event('Screenshot', 80), ph: 'O', args: { snapshot: 'before' } },
    { ...event('counter', 90), ph: 'C', args: { bytes: 7 } }, event('RunTask', 90, 50),
    { ...event('Screenshot', 125), ph: 'O', args: { snapshot: 'after' } }, event('outside', 130),
  ] };
  const out = sliceDevtoolsTrace(trace, { startTs: 100, endTs: 130 });
  assert.equal(out.metadata.stopwatchEpochMs, 1000.1);
  assert.deepEqual(out.traceEvents.filter(e => e.name === 'RunTask').map(e => [e.ts, e.dur]), [[0, 30]]);
  assert.deepEqual(out.traceEvents.filter(e => e.name === 'Screenshot').map(e => e.ts).sort((a, b) => Number(a) - Number(b)), [0, 25]);
  assert.ok(out.traceEvents.some(e => e.ph === 'M'));
  assert.equal(out.traceEvents.some(e => e.name === 'outside'), false);
  assert.throws(() => sliceDevtoolsTrace(trace, { startTs: 10, endTs: 0 }));
});

test('navigation mismatches stay unnamed, incomplete flights stay incomplete, and mounted is not approach-ready', () => {
  const trace = { traceEvents: [mark('requested', 100), mark('handoff', 200), mark('mounted', 300), event('RunTask', 310, 40)] };
  const analysis = navigationAnalysis(trace, { url: 'invalid', steps: [] });
  assert.match(analysis.naming, /unavailable/);
  assert.equal(analysis.views.find(v => v.phase === 'flight')?.outcome, 'incomplete');
  assert.equal(analysis.views.some(v => v.phase === 'approach'), false);
});

test('exclusive costs do not double-charge paint inside composite inside a script', () => {
  const analysis = navigationAnalysis({ traceEvents: [event('RunTask', 100, 10000), event('FunctionCall', 100, 10000),
    event('Commit', 200, 8000), event('Paint', 300, 6000)] }, {});
  const full = analysis.views[0]!;
  assert.equal(full.totalMs, 10);
  assert.equal(full.exclusiveMs.paint, 6);
  assert.equal(full.exclusiveMs.commit, 2);
  assert.equal(full.exclusiveMs.script, 2);
});

test('raw scheduling stacks survive conversion and join the next style pass without claiming causality', () => {
  const trace = devtoolsTrace({ traceEvents: [{ ...event('ScheduleStyleRecalculation', 1000), ph: 'i' }, event('RecalculateStyles', 2000, 20000)] });
  const raw = { moment: [{ method: 'Timeline.eventRecorded', params: { record: { type: 'ScheduleStyleRecalculation', startTime: 0.001,
    stackTrace: { callFrames: [{ url: 'https://x/a.js', lineNumber: 2, columnNumber: 3 }] } } } }] };
  assert.equal(restoreSchedulingStacks(trace, raw), 1);
  const clues = traceClues(trace, raw, []);
  assert.equal(clues.coverage.styleSchedulingStacks, 1);
  assert.equal(clues.tasks[0]?.renderingPasses?.[0]?.triggers[0]?.stack[0]?.url, 'https://x/a.js');
});

test('callback ID joins respect cancellation and do not join a later reused ID backwards', () => {
  const trace = { traceEvents: [event('RequestAnimationFrame', 1, 0, { id: 1 }), event('CancelAnimationFrame', 2, 0, { id: 1 }),
    event('RunTask', 10, 20000), event('FireAnimationFrame', 10, 20000, { id: 1 }),
    event('RequestAnimationFrame', 30000, 0, { id: 1 }), event('RunTask', 40000, 20000), event('FireAnimationFrame', 40000, 20000, { id: 1 })] };
  const clues = traceClues(trace, null, []);
  assert.equal(clues.tasks[0]?.scheduling.length, 0);
  assert.equal(clues.tasks[1]?.scheduling[0]?.requestUs, 30000);
});

test('repeated forced style is grouped by the innermost callback, independent of task ranking', () => {
  const trace = { traceEvents: [event('RunTask', 1, 50000), event('FunctionCall', 1, 50000, { url: 'outer.js' }),
    event('FunctionCall', 10, 40000, { url: 'read.js', lineNumber: 2 }), event('UpdateLayoutTree', 20, 30000),
    event('RunTask', 60000, 50000), event('FunctionCall', 60000, 40000, { url: 'read.js', lineNumber: 2 }), event('UpdateLayoutTree', 60010, 30000)] };
  const clues = traceClues(trace, null, []);
  assert.equal(clues.repeatedSynchronousRendering[0]?.caller.url, 'read.js');
  assert.equal(clues.repeatedSynchronousRendering[0]?.count, 2);
  assert.equal(clues.repeatedSynchronousRendering[0]?.totalMs, 60);
});

test('residency flags remaining owners but allows the shared stage; untimed JS samples never join a stall', () => {
  const release = (owners: number, ts: number) => ({ ...event('TimeStamp', ts, 0, { objectId: 'test', after: {
    lifetime: { disposed: true, ownerCount: owners }, connectedNodes: 1, resources: { pending: [], images: { entries: [] } },
  } }), args: { webkit: 'cssEarth scene released', data: { objectId: 'test', after: {
    lifetime: { disposed: true, ownerCount: owners }, connectedNodes: 1, resources: { pending: [], images: { entries: [] } },
  } } } });
  const clues = traceClues({ traceEvents: [event('RunTask', 1, 50000), release(0, 20), release(1, 30)] }, {
    moment: [{ method: 'ScriptProfiler.trackingComplete', source: 'page', params: { samples: { stackTraces: [
      { timestamp: 0, stackFrames: [] }, { timestamp: 0.01, stackFrames: [{ url: 'read.js' }] },
    ] } } }],
  }, []);
  assert.deepEqual(clues.releases.map(r => r.anomaly), [false, true]);
  assert.equal(clues.tasks[0]?.timedSamples.length, 1);
  assert.equal(clues.coverage.profileSamples, 2);
});

test('exact call IDs join the innermost setter to scheduling and reject adjacent writes', async () => {
  const { traceCauses, causeTraceEvents, javascriptStack } = await import('./webkit-trace-causes.mts');
  const stamp = (id: number, phase: string, ts: number) => event('TimeStamp', ts, 0, { message: `cssEarth:cause:${id}:${phase}` });
  const trace = { traceEvents: [stamp(1, 'begin', 100), stamp(2, 'begin', 120), event('ScheduleStyleRecalculation', 125),
    stamp(2, 'end', 130), stamp(1, 'end', 150), event('ScheduleStyleRecalculation', 170), event('UpdateLayoutTree', 200, 20000)] };
  const diagnostic = { schema: 'cssearth-trace-causes@1', targets: [{ id: 1, label: 'details', ancestors: [2] }], operations: [
    { id: 1, parentId: null, kind: 'children', property: 'replaceChildren', target: 1, stack: 'caller@http://x/app.js:2:10' },
    { id: 2, parentId: 1, kind: 'property', property: 'open', target: 1, before: true, after: false, stack: 'reset@http://x/app.js:4:5' },
    { id: 3, kind: 'property', property: 'unpaired', target: 1, startMs: 0, endMs: 999999 },
  ] };
  const c = traceCauses(trace, diagnostic), chain = c.forTask(200, 20200);
  assert.deepEqual(c.links.map(l => l.operationId), [2, null]);
  assert.equal(c.coverage.pairedOperations, 2);
  assert.equal(chain.operations.some(o => o.id === 3), false);
  assert.deepEqual(chain.passes[0]?.pendingOperationIds, [1, 2]);
  assert.equal(causeTraceEvents(c).filter(e => e.ph === 'X').length, 2);
  assert.equal(javascriptStack('reset@http://x/a.js:4:5')[0]?.lineNumber, 4);
});

test('paint chains retain preceding style but label rendering order without inventing causal edges', async () => {
  const { traceCauses } = await import('./webkit-trace-causes.mts');
  const c = traceCauses({ traceEvents: [event('Commit', 1, 10), event('UpdateLayoutTree', 20, 5),
    event('Commit', 30, 50000), event('Paint', 35, 30000)] }, null);
  const chain = c.forTask(30, 50030);
  assert.equal(chain.cycleStartUs, 11);
  assert.equal(chain.passes[0]?.name, 'UpdateLayoutTree');
  assert.equal(chain.passes[0]?.inTask, false);
  assert.match(chain.passes.find(p => p.name === 'Paint')!.relation, /does not expose/);
  assert.equal(c.coverage.enabled, false);
});

test('stall clues retain concurrent recorder and page native samples separately', () => {
  const sample = (pid: number, name: string, ts: number) => ({ ph: 'X', cat: 'native', pid, tid: 1, ts, dur: 1000,
    name: 'work', args: { process: name, sourcePid: pid + 100, thread: 'main', weightMs: 1 } });
  const clues = traceClues({ traceEvents: [event('RunTask', 1000, 20000), sample(3, 'Page', 2000),
    sample(4, 'Recorder', 2000), sample(4, 'Recorder', 3000), sample(4, 'Recorder', 22000)] }, null, []);
  const context = clues.tasks[0]!.nativeSamples;
  assert.deepEqual(context.threads.map(t => [t.process, t.samples, t.weightMs]), [['Recorder', 2, 2], ['Page', 1, 1]]);
  assert.match(context.relation, /not proof of causation/);
});
