import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { requireArray, requireRecord } from '@cssearth/core';
import { createCostIndex, diagnoseCosts } from './trace-costs.mts';
import { chartIdleGaps, averageFrames, renderAverageChart, validateSeries } from './trace-chart.mts';
import { alignRecorder, readCapture, compareCaptures } from './trace-capture.mts';
import { indexNodeOwners, summarizeInvalidations } from './trace-invalidations.mts';
import { correlateEvidence } from './trace-evidence.mts';
import type { EvidenceInput } from './trace-evidence.mts';
import { inspectBuild, main } from './trace-brief.mts';
import type { JsonRecord, TraceEvent } from './trace-model.mts';

const selection = { rendererPid: 1, rendererMainTid: 2 }, window = { startTs: 0, endTs: 100000, durationMs: 100 };
const event = (name: string, ts: number, dur = 0, data: JsonRecord = {}, more: Partial<TraceEvent> = {}): TraceEvent =>
  ({ pid: 1, tid: 2, name, ts, dur, ph: dur ? 'X' : 'I', args: { data }, ...more });
const makeBrief = (): EvidenceInput => ({ selection, window, displayBudgetMs: 16.667, evidenceGaps: [], busiestTasks: [{ atMs: 0, traceStartUs: 0, durationMs: 60, calls: [] }] });
test('exclusive work partitions nested JS, forced style, paint and GC with clipped task bounds', () => {
  const events = [event('RunTask', -5000, 65000), event('FunctionCall', 0, 60000),
    event('UpdateLayoutTree', 10000, 20000), event('MinorGC', 15000, 5000), event('Paint', 40000, 5000),
    event('PaintImage', 41000, 1000), event('RunTask', 0, 90000, {}, { tid: 3 })];
  const index = createCostIndex(events, selection, window), result = index.query(0, 100000);
  assert.equal(result.totalMs, 60);
  assert.equal(result.exclusiveMs.script, 35);
  assert.equal(result.exclusiveMs.style, 15);
  assert.equal(result.exclusiveMs.gc, 5);
  assert.equal(result.exclusiveMs.paint, 5);
  assert.equal(Object.values(result.exclusiveMs).reduce((a, b) => a + b, 0), 60);
  assert.equal(index.query(12000, 18000).exclusiveMs.style, 3);
  assert.equal(index.query(12000, 18000).exclusiveMs.gc, 3);
  assert.equal(index.query(70000, 90000).totalMs, 0);
});
test('missing task coverage stays explicit and overlapping observed slices count once', () => {
  const index = createCostIndex([event('FunctionCall', 0, 20000), event('Layout', 5000, 4000)], selection, window);
  assert.match(index.coverage, /task coverage unavailable/);
  assert.equal(index.query(0, 100000).totalMs, 20);
  assert.equal(index.query(0, 100000).exclusiveMs.script, 16);
});
test('busy frame ranking does not mistake a large low-work interval for the CPU bottleneck', () => {
  const brief = makeBrief();
  const costs = diagnoseCosts([event('RunTask', 0, 25000)], brief, { timeline: { frames: [
    { index: 1, startMs: 0, endMs: 30, intervalMs: 30 }, { index: 2, startMs: 30, endMs: 100, intervalMs: 70 },
  ] } });
  assert.equal(costs.worstBusyFrames[0]?.index, 1);
  assert.equal(costs.longestPresentationGaps[0]?.index, 2);
  assert.match(costs.longestPresentationGaps[0]?.classification ?? '', /alone does not explain/);
});

const seriesOptions = { durationMs: 1000, label: 'test', sha256: 'abc', source: 'presentation' };
test('500ms mean uses interval end times, not averages of averages or invented zeroes', () => {
  const series = averageFrames([{ endMs: 100, intervalMs: 10 }, { endMs: 200, intervalMs: 30 }, { endMs: 1000, intervalMs: 800 }], seriesOptions);
  assert.equal(series.points.find(p => p.atMs === 200)?.meanMs, 20);
  assert.equal(series.points.find(p => p.atMs === 600)?.meanMs, 30);
  assert.equal(series.points.find(p => p.atMs === 700)?.meanMs, null);
  assert.equal(series.points.at(-1)?.meanMs, 800);
  assert.equal(series.points.at(-1)?.intervals, 1);
  validateSeries(series);
});
test('empty observations produce a broken line; short partial windows and final endpoint are retained', () => {
  const empty = averageFrames([], { ...seriesOptions, durationMs: 255 });
  assert.deepEqual(empty.points.map(p => p.atMs), [0, 100, 200, 255]);
  assert.ok(empty.points.every(p => p.meanMs === null));
  assert.doesNotThrow(() => renderAverageChart([empty]));
});
test('comparison draws one line per trace, escapes labels and rejects inconsistent smoothing', () => {
  const a = averageFrames([{ endMs: 100, intervalMs: 25 }], { ...seriesOptions, label: '<script>alert(1)</script>' });
  const b = { ...a, label: 'second', sha256: 'def' };
  const svg = renderAverageChart([a, b]);
  assert.equal((svg.match(/data-trace=/g) ?? []).length, 2);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.equal(svg.includes('<script>'), false);
  assert.throws(() => validateSeries({ ...a, windowMs: 1000 }), /same 500 ms/);
  assert.throws(() => validateSeries({ ...a, points: [{ atMs: 0, meanMs: 0, intervals: 1 }] }), /Invalid comparison/);
});

const recording = { id: 'r', metadata: { sampleIntervalMs: 100 }, events: [
  { name: 'cssEarth:recording:started', time: 10, detail: { recordingId: 'r' } },
  { name: 'cssEarth:recording:stopped', time: 110, detail: { recordingId: 'r' } },
], samples: [{ time: 20, state: { active: 'sun', mountedObjects: 1 } }, { time: 80, state: { active: 'earth' } }] };
const anchors = [event('cssEarth:recording:started', 100000, 0, { detail: JSON.stringify({ recordingId: 'r' }) }),
  event('cssEarth:recording:stopped', 200000, 0, { detail: JSON.stringify({ recordingId: 'r' }) })];
test('recorder alignment requires both unique anchors, identity, renderer and bounded clock drift', () => {
  const [started, stopped] = anchors;
  assert.ok(started && stopped);
  assert.equal(alignRecorder(anchors, recording, 1).valid, true);
  assert.equal(alignRecorder(anchors, { ...recording, id: 'other' }, 1).valid, false);
  assert.equal(alignRecorder(anchors, recording, 5).valid, false);
  assert.equal(alignRecorder([...anchors, started], recording, 1).valid, false);
  assert.equal(alignRecorder([started, { ...stopped, ts: 250000 }], recording, 1).valid, false);
});
test('capture state joins only preceding samples; failed capture disables cross-artifact attribution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-capture-'));
  const report = { loadedFiles: {}, milestones: [], errors: [], traceDataLoss: false, videoEnabled: false };
  try {
    await writeFile(join(root, 'report.json'), JSON.stringify(report));
    await writeFile(join(root, 'cssearth-diagnostics-r.json'), JSON.stringify(recording));
    const capture = await readCapture(join(root, 'trace.json'), anchors, selection);
    assert.equal(capture.summary.status, 'matched capture');
    assert.equal(capture.summary.protocol?.screencast, false);
    assert.equal(capture.summary.video, null);
    assert.equal(capture.stateAt(100000), null);
    assert.equal(capture.stateAt(140000)?.active, 'sun');
    assert.equal(capture.stateAt(140000)?.ageMs, 30);
    assert.equal(capture.stateAt(201000), null);
    await writeFile(join(root, 'report.json'), JSON.stringify({ ...report, traceDataLoss: true }));
    const invalid = await readCapture(join(root, 'trace.json'), anchors, selection);
    assert.equal(invalid.summary.status, 'invalid');
    assert.equal(invalid.stateAt(140000), null);
    assert.equal(invalid.servedDirectory, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('trace-only comparison is descriptive and absent metrics are null, never zero', () => {
  const compared = compareCaptures({ input: {} }, { input: {} });
  assert.equal(compared.comparability, 'descriptive only');
  assert.ok(compared.metrics.every(m => m.before === null && m.after === null && m.change === null));
});

function snapshot(name = 'before', owner = 'context-orbit-block') {
  return { name, snapshot: { strings: ['main', 'iframe', 'DIV', 'S', 'class', owner, 'polycss-scene'], documents: [
    { frameId: 0, nodes: { backendNodeId: [10, 11], parentIndex: [-1, 0], attributes: [[4, 5], []] } },
    { frameId: 1, nodes: { backendNodeId: [10, 11], parentIndex: [-1, 0], attributes: [[4, 6], []] } },
  ] } };
}
test('DOM ownership uses frame plus backend ID, follows ancestors and refuses conflicting snapshots', () => {
  const nodes = indexNodeOwners([snapshot()]);
  assert.equal(nodes.get(JSON.stringify(['main', 11]))?.owner, 'orbits');
  assert.equal(nodes.get(JSON.stringify(['iframe', 11]))?.owner, 'detailed PolyCSS surface');
  const conflict = indexNodeOwners([snapshot(), snapshot('after', 'space-minimap')]);
  assert.equal(conflict.get(JSON.stringify(['main', 11]))?.owner, 'ambiguous DOM');
});
test('first scheduler survives many node invalidations, stacks are bounded and propagation stays separate', () => {
  const stack = Array.from({ length: 1000 }, (_, i) => ({ url: 'http://localhost/a.js', lineNumber: 1, columnNumber: i + 1, functionName: 'scheduler' }));
  const events = [event('ScheduleStyleRecalculation', 100, 0, { frame: 'main', stackTrace: stack }),
    ...Array.from({ length: 30 }, (_, i) => event('StyleRecalcInvalidationTracking', 200 + i, 0, { frame: 'main', nodeId: 11, reason: 'set style' })),
    event('UpdateLayoutTree', 1000, 10000, {}, { args: { beginData: { frame: 'main' }, elementCount: 10 } }),
    event('StyleRecalcInvalidationTracking', 2000, 0, { frame: 'main', nodeId: 11, reason: 'propagation' }),
    event('StyleRecalcInvalidationTracking', 2100, 0, { frame: 'iframe', nodeId: 11 }),
    event('StyleRecalcInvalidationTracking', 2200, 0, { frame: 'main', nodeId: 999 }),
  ];
  const brief = correlateEvidence({ events }, makeBrief());
  const invalidations = summarizeInvalidations(events, brief, [snapshot()]);
  const pass = brief.busiestTasks[0]?.renderingPasses?.[0];
  assert.ok(pass);
  assert.equal(pass.triggers[0]?.traceStartUs, 100);
  assert.equal(pass.triggers[0]?.stack.length, 8);
  assert.equal(pass.triggers[0]?.omittedStackFrames, 992);
  assert.equal(pass.invalidationEvidence?.queued.events, 30);
  assert.equal(pass.invalidationEvidence?.duringPass.events, 2);
  assert.equal(invalidations.owners.find(g => g.owner === 'orbits')?.distinctNodes, 1);
  assert.equal(invalidations.owners.find(g => g.owner === 'unresolved')?.events, 1);
});
test('missing DOM snapshots retain invalidation counts but leave ownership unresolved', () => {
  const result = summarizeInvalidations([event('StyleRecalcInvalidationTracking', 100, 0, { frame: 'main', nodeId: 11 })], makeBrief());
  assert.equal(result.events, 1);
  assert.equal(result.domOwnership, 'unavailable');
  assert.equal(result.owners[0]?.owner, 'unresolved');
});
test('CLI produces a useful raw-trace report without sidecars or presentation events', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-cli-'));
  try {
    const input = join(root, 'raw.json');
    const events = [event('thread_name', 0, 0, {}, { ph: 'M', args: { name: 'CrRendererMain' } }),
      event('thread_name', 0, 0, {}, { ph: 'M', tid: 3, args: { name: 'Compositor' } })];
    for (let i = 0; i < 12; i++) events.push(event('RunTask', i * 16667, 3000), event('FireAnimationFrame', i * 16667, 3000),
      event('DrawFrame', i * 16667 + 4000, 0, {}, { tid: 3 }));
    await writeFile(input, JSON.stringify({ traceEvents: events }));
    const result = await main([input, '--out', join(root, 'report'), '--label', 'Raw fixture']);
    assert.ok(result);
    const { output, brief } = result;
    assert.equal(brief.capture.status, 'trace-only');
    assert.equal(brief.averageSeries.source, 'DrawFrame fallback');
    assert.ok(brief.averageSeries.points.some(p => (p.meanMs ?? 0) > 0));
    assert.equal(brief.busiestTasks[0]?.recorder, null);
    const diagnosis = requireRecord(JSON.parse(await readFile(join(output, 'diagnosis.json'), 'utf8')));
    assert.equal(diagnosis.status, 'PARTIAL evidence');
    assert.ok(requireArray(diagnosis.missing).some(m => typeof m === 'string' && m.includes('recorder')));
    assert.equal(((await readFile(join(output, 'performance.svg'), 'utf8')).match(/data-trace=/g) ?? []).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('source attribution verifies bytes and refuses symlink escapes or wrong bundles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-source-'));
  try {
    const bytes = 'const version = 1;', sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(root, 'bundle.js'), bytes);
    const brief = { sourceUrls: ['http://localhost/bundle.js'], sampledJsSelf: [], busiestTasks: [] };
    assert.equal((await inspectBuild(brief, root, { '/bundle.js': { bytes: bytes.length, sha256 } }))[0]?.verification, 'matches capture manifest');
    const bad = await inspectBuild(brief, root, { '/bundle.js': { bytes: 1, sha256: 'wrong' } });
    assert.match(bad[0]?.verification ?? '', /MISMATCH/);
    assert.equal(bad[0]?.sourceMap, undefined);
    await symlink('/etc/hosts', join(root, 'outside.js'));
    const unavailable = (await inspectBuild({ ...brief, sourceUrls: ['http://localhost/outside.js'] }, root))[0]?.unavailable;
    assert.ok(typeof unavailable === 'string');
    assert.match(unavailable, /leaves supplied build/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('chart omits explicitly idle gaps but preserves dropped frames, work and uncertain gaps', () => {
  const brief = { selection: { rendererPid: 1, rendererMainTid: 1 }, window: { startTs: 0, endTs: 1e6 }, displayBudgetMs: 16.667 };
  const frame = { index: 0, startMs: 0, endMs: 400, intervalMs: 400, mainBusyMs: .4 };
  const idle = [
    { pid: 1, tid: 2, name: 'NeedsBeginFrameChanged', ts: 1000, args: { layerTreeId: 1, data: { needsBeginFrame: 0 } } },
    { pid: 1, tid: 2, name: 'PipelineReporter', ts: 1000, args: { frame_reporter: { state: 'STATE_NO_UPDATE_DESIRED' } } },
    { pid: 1, tid: 2, name: 'NeedsBeginFrameChanged', ts: 399000, args: { layerTreeId: 1, data: { needsBeginFrame: 1 } } },
  ];
  const excludedGaps = chartIdleGaps(idle, [frame], brief);
  assert.equal(excludedGaps.length, 1);
  const series = averageFrames([frame], { ...seriesOptions, excludedGaps });
  assert.ok(series.points.every(p => p.meanMs === null));
  assert.equal(series.excludedGaps[0]?.intervalMs, 400);
  assert.deepEqual(chartIdleGaps([], [frame], brief), []);
  assert.deepEqual(chartIdleGaps(idle, [{ ...frame, mainBusyMs: 150 }], brief), []);
  assert.deepEqual(chartIdleGaps([...idle, { pid: 1, tid: 2, name: 'PipelineReporter', ts: 5000,
    args: { frame_reporter: { state: 'STATE_DROPPED', affects_smoothness: true } } }], [frame], brief), []);
  assert.deepEqual(chartIdleGaps([...idle, { pid: 1, tid: 1, name: 'FunctionCall', ts: 5000, dur: 2000 }], [frame], brief), []);
});
