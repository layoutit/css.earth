import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { CALIBRATION_POINTS, captureMetrics, compareCaptures, solveAffine, touchPlan, comparePixels, formatComparison, options, parseSteps, requireStepsFor, summariseNumericSamples, schedulingStacks, summariseCpu, summariseInitiators, summariseSamples, summariseTimeProfile, summariseTimeline } from './ios-capture.mts';

test('steps are validated before anything records', () => {
  assert.deepEqual(parseSteps([{ tap: [194, 94] }, { type: 'saturn' }, { wait: 1.5 }, { screenshot: 'after' },
    { drag: { from: [100, 380], to: [320, 400], seconds: 1.5 } }]).length, 5);
  assert.throws(() => parseSteps([{ tap: [1] }]), /\[x, y\]/);
  assert.throws(() => parseSteps([{ tap: [1, 2], wait: 1 }]), /exactly one action/);
  assert.throws(() => parseSteps([{ pinch: 2 }]), /unknown action/);
  assert.throws(() => parseSteps([{ screenshot: '../escape' }]), /lowercase/);
});

test('a device capture finds its device on USB, records no native trace by default and refuses touch steps', () => {
  const device = options(['--device', '--name', 'ipad', '--seconds', '15', '--open', '/jupiter/']);
  assert.deepEqual([device.device, device.native, device.inspectorScreenshots, device.open], [{ udid: null }, 'off', true, '/jupiter/']);
  assert.deepEqual(options(['--device', '00008120-000A', '--name', 'ipad', '--seconds', '5']).device, { udid: '00008120-000A' });
  const simulator = options(['--name', 'sim', '--seconds', '5']);
  assert.deepEqual([simulator.device, simulator.native, simulator.inspectorScreenshots], [null, 'page', false]);
  const drag = parseSteps([{ drag: { from: [1, 2], to: [3, 4], seconds: 1 } }]);
  assert.throws(() => requireStepsFor({ kind: 'device', udid: 'x' }, drag), /needs the simulator/);
  assert.doesNotThrow(() => requireStepsFor({ kind: 'simulator', udid: 'x' }, drag));
  assert.doesNotThrow(() => requireStepsFor({ kind: 'device', udid: 'x' }, parseSteps([{ script: 'void 0' }, { screenshot: 'end' }])));
});

test('a comparison averages the runs on each side and says which way each metric moved', () => {
  const report = (frames: number, work: number, composite: number, layersMb: number, fps?: number) => ({
    timeline: { renderingFrames: { count: frames, totalMs: work * frames, over16ms: 10, over50ms: 0, longestMs: 30 }, byType: [{ type: 'Composite', ms: composite * frames }] },
    layers: { memoryMb: layersMb, count: 800 }, ...(fps === undefined ? {} : { deviceMetrics: { graphics: { CoreAnimationFramesPerSecond: { mean: fps } }, webContent: { footprintMb: { max: 900 } } } }),
  });
  const rows = compareCaptures([captureMetrics(report(190, 9, 5.4, 487)), captureMetrics(report(200, 9.2, 5.6, 487))], [captureMetrics(report(198, 8.2, 4.9, 173))]);
  const row = (label: string) => rows.find(entry => entry.label === label);
  assert.deepEqual([row('Work per frame (ms)')?.before, row('Work per frame (ms)')?.after, row('Work per frame (ms)')?.verdict], [9.1, 8.2, 'better']);
  assert.equal(row('Layer memory (MB)')?.verdict, 'better');
  assert.equal(row('Frames over 16.7 ms')?.verdict, 'same');
  assert.equal(row('Device frames per second'), undefined, 'simulator runs have no device rows');
  assert.equal(captureMetrics(report(60, 10, 5, 100, 58.5)).deviceFps, 58.5);
  assert.match(formatComparison(rows, { before: 2, after: 1 }, [{ name: 'loaded', differing: 739, total: 3162132 }]), /\| Layer memory \(MB\) \| 487 \| 173 \| -64% better \|[\s\S]*loaded: 739 of 3162132/u);
});

test('three calibration taps give the page-to-display map, and a recording becomes one finger of timed contacts', () => {
  // A page offset 60 points down on a 402-point-wide screen, displayed in 0..65535 units: display = page * 163.02 + offset.
  const scale = 65535 / 402, toPage = ([x, y]: readonly [number, number]) => [x / scale, y / scale - 60] as const;
  const affine = solveAffine(CALIBRATION_POINTS.map(display => ({ page: toPage(display), display })));
  assert.ok(Math.abs(affine[0] - scale) < 1e-6 && Math.abs(affine[1]) < 1e-6 && Math.abs(affine[5] - 60 * scale) < 1e-3);
  assert.throws(() => solveAffine([{ page: [0, 0], display: [0, 0] }, { page: [1, 1], display: [1, 1] }, { page: [2, 2], display: [2, 2] }]), /in a line/);
  const plan = touchPlan({ pointers: [
    [100, 'pointerdown', 1, 'touch', 10, 20], [116, 'pointermove', 1, 'touch', 20, 20],
    [120, 'pointerdown', 2, 'touch', 200, 200], [125, 'pointermove', 2, 'touch', 210, 200],
    [130, 'pointermove', 7, 'mouse', 5, 5], [140, 'pointerup', 1, 'touch', 20, 20], [150, 'pointerup', 2, 'touch', 210, 200],
  ] }, affine);
  assert.deepEqual(plan.events.map(([at, kind]) => [at, kind]), [[0, 'contact'], [16, 'contact'], [40, 'release']]);
  assert.deepEqual(plan.events[0]!.slice(2), [Math.round(10 * scale), Math.round(80 * scale)]);
  assert.equal(plan.skippedFingers, 1);
});

test('device samples summarise every numeric field the device reports', () => {
  assert.deepEqual(summariseNumericSamples([{ fps: 60, name: 'x' }, { fps: 30, util: 12.34 }, 'noise']),
    { fps: { mean: 45, min: 30, max: 60, count: 2 }, util: { mean: 12.3, min: 12.3, max: 12.3, count: 1 } });
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

test('a probe step records the page state under a name', () => {
  assert.deepEqual(parseSteps([{ probe: 'after-flight' }]), [{ probe: 'after-flight' }]);
  assert.throws(() => parseSteps([{ probe: 'After Flight' }]), /lowercase/);
});

test('a script step carries the expression it runs', () => {
  assert.deepEqual(parseSteps([{ script: 'document.title' }]), [{ script: 'document.title' }]);
  assert.throws(() => parseSteps([{ script: 5 }]), /must be a string/);
});
