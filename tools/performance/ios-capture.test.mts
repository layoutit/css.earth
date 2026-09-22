import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { comparePixels, parseSteps, schedulingStacks, summariseCpu, summariseInitiators, summariseSamples, summariseTimeProfile, summariseTimeline } from './ios-capture.mts';

test('steps are validated before anything records', () => {
  assert.deepEqual(parseSteps([{ tap: [194, 94] }, { type: 'saturn' }, { wait: 1.5 }, { screenshot: 'after' },
    { drag: { from: [100, 380], to: [320, 400], seconds: 1.5 } }]).length, 5);
  assert.throws(() => parseSteps([{ tap: [1] }]), /\[x, y\]/);
  assert.throws(() => parseSteps([{ tap: [1, 2], wait: 1 }]), /exactly one action/);
  assert.throws(() => parseSteps([{ pinch: 2 }]), /unknown action/);
  assert.throws(() => parseSteps([{ screenshot: '../escape' }]), /lowercase/);
});

test('JavaScript samples count each function once per stack, by top frame and anywhere on it', () => {
  const frame = (name: string) => ({ name, url: '', line: 1, column: 1 });
  const summary = summariseSamples([[frame('filter'), frame('search')], [frame('filter'), frame('filter')], [frame('lower'), frame('search')]], f => f.name);
  assert.equal(summary.samples, 3);
  assert.deepEqual(summary.self[0], { label: 'filter', count: 2 });
  assert.deepEqual(summary.inclusive.find(entry => entry.label === 'filter'), { label: 'filter', count: 2 });
  assert.deepEqual(summary.inclusive.find(entry => entry.label === 'search'), { label: 'search', count: 2 });
});

test('timeline time counts nested records of one type once and lists rendering frames', () => {
  const summary = summariseTimeline([
    { type: 'RenderingFrame', startTime: 0, endTime: 0.06, children: [
      { type: 'FunctionCall', startTime: 0, endTime: 0.02, children: [{ type: 'FunctionCall', startTime: 0.005, endTime: 0.01 }] },
      { type: 'Layout', startTime: 0.02, endTime: 0.03 }] },
    { type: 'RenderingFrame', startTime: 0.1, endTime: 0.11 },
  ]);
  assert.deepEqual(summary.byType.find(entry => entry.type === 'FunctionCall'), { type: 'FunctionCall', ms: 20, count: 2 });
  // The first frame's work is its children's union (0-30 ms), not its 60 ms span; the second has no work inside.
  assert.deepEqual(summary.renderingFrames, { count: 2, over16ms: 1, over50ms: 0, longestMs: 30, totalMs: 30 });
});

test('CPU is averaged per thread and names workers by their script', () => {
  const summary = summariseCpu([
    { usage: 50, threads: [{ name: 'Main Thread', usage: 40 }, { name: 'WebCore: Worker', usage: 10, targetId: 'worker:1' }] },
    { usage: 30, threads: [{ name: 'Main Thread', usage: 20 }, { name: 'WebCore: Worker', usage: 0, targetId: 'worker:1' }] },
  ], new Map([['worker:1', 'planner.js']]));
  assert.equal(summary.averagePercent, 40);
  assert.deepEqual(summary.threads, [{ thread: 'Main Thread', averagePercent: 30, peakPercent: 40 }, { thread: 'worker planner.js', averagePercent: 5, peakPercent: 10 }]);
});

test('the Time Profiler table resolves id and ref compression and ranks the web content process', () => {
  const xml = '<row><process id="1" fmt="com.apple.WebKit.WebContent (7)"/><weight id="2" fmt="1 ms">1000000</weight>' +
    '<backtrace id="3"><frame id="4" name="collectMatchingRules"/><frame id="5" name="updateRendering"/></backtrace></row>' +
    '<row><process ref="1"/><weight ref="2"/><backtrace ref="3"/></row>' +
    '<row><process id="6" fmt="WindowServer (1)"/><weight ref="2"/><backtrace id="7"><frame ref="5"/></backtrace></row>';
  const summary = summariseTimeProfile(xml);
  assert.equal(summary.webContentProcess, 'com.apple.WebKit.WebContent (7)');
  assert.equal(summary.webContentMs, 2);
  assert.deepEqual(summary.self, [{ frame: 'collectMatchingRules', ms: 2 }]);
  assert.deepEqual(summary.processes.map(entry => entry.process), ['com.apple.WebKit.WebContent (7)', 'WindowServer (1)']);
});

test('style and layout scheduling is attributed to the first script frame of its stack', () => {
  const frame = (functionName: string) => ({ functionName, url: 'http://x/a.js', lineNumber: 3, columnNumber: 7 });
  const stacks = schedulingStacks([{ type: 'RenderingFrame', children: [
    { type: 'ScheduleStyleRecalculation', stackTrace: { callFrames: [{ functionName: 'native', url: '' }, frame('publish')] } },
    { type: 'ScheduleStyleRecalculation', data: { stackTrace: [frame('publish')] } },
    { type: 'InvalidateLayout', stackTrace: [frame('measure')] },
    { type: 'ScheduleStyleRecalculation' },
  ] }]);
  const summary = summariseInitiators(stacks, f => f.name);
  assert.deepEqual(summary.ScheduleStyleRecalculation, [{ label: 'publish', count: 2 }, { label: '(no script frame)', count: 1 }]);
  assert.deepEqual(summary.InvalidateLayout, [{ label: 'measure', count: 1 }]);
});

test('pixel comparison counts differing pixels, 0 for identical screenshots', () => {
  const a = new Uint8Array(2 * 2 * 4).fill(255), b = Uint8Array.from(a);
  assert.equal(comparePixels(a, b, 2, 2).differing, 0);
  b.set([0, 0, 0, 255], 4);
  assert.deepEqual({ ...comparePixels(a, b, 2, 2), diff: undefined }, { differing: 1, total: 4, diff: undefined });
  assert.throws(() => comparePixels(a, b.subarray(4), 2, 2), /size/);
});
