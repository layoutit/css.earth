import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { loadTrace } from '../../performance/load-trace.mts';
import { occupiedMs } from '../../performance/trace-brief.mts';
import { arrayOf, hasDuration, isTraceEvent, isFiniteNumber, present, recordOf } from '../../performance/trace-model.mts';

const directory = 'output/playwright/native-resize/saturn-transparent';
const numeric = (value: unknown) => { assert.ok(isFiniteNumber(value)); return value; };
const rec = (value: unknown) => present(recordOf(value), 'record');
const quantile = (values: readonly number[], p: number) => {
  assert.ok(values.length); const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
};
const comparison = rec(JSON.parse(await readFile(`${directory}/comparison.json`, 'utf8')));
const results: { mode: string; trial: number; durationMs: number; mainTaskMs: number; styleMs: number; layoutMs: number;
  layoutPasses: number; paintMs: number; frameCallbackMs: number; cameraRequests: number; cameraUpdates: number;
  cameraIntervalP50Ms: number; cameraIntervalP95Ms: number; cameraUpdatesPerSecond: number;
  presentationP95Ms: number; droppedMarkers: number; endpointDifferenceDegrees: number; retained: unknown; traceSha256: string }[] = [];
for (const item of present(arrayOf(comparison.results), 'comparison results')) {
  const run = rec(item); assert.ok(typeof run.mode === 'string'); const trial = numeric(run.trial);
  const name = `${run.mode}-${trial}`;
  const brief = rec(JSON.parse(await readFile(`${directory}/${name}-analysis/agent-brief.json`, 'utf8')));
  const selection = rec(brief.selection);
  const trace = await loadTrace(`${directory}/${name}.json.gz`);
  assert.equal(trace.sha256, run.traceSha256);
  const events = trace.events.filter(isTraceEvent);
  const start = present(events.find(event => event.name === 'clock_sync' && event.args?.sync_id === `${name}:drag-start`), 'start marker').ts;
  const end = present(events.find(event => event.name === 'clock_sync' && event.args?.sync_id === `${name}:drag-end`), 'end marker').ts;
  const main = events.filter(event => event.pid === selection.rendererPid && event.tid === selection.rendererMainTid && event.ph === 'X')
    .filter(hasDuration).filter(event => event.ts < end && event.ts + event.dur > start);
  const durations = (name: string) => occupiedMs(main.filter(event => event.name === name), start, end);
  const times = present(arrayOf(rec(run.sceneFrames).times), 'camera times').map(numeric);
  const intervals = times.slice(1).map((time, i) => time - times[i]);
  const before = rec(run.before), after = rec(run.after);
  results.push({ mode: run.mode, trial, durationMs: (end - start) / 1000,
    mainTaskMs: durations('RunTask'), styleMs: durations('UpdateLayoutTree'), layoutMs: durations('Layout'),
    layoutPasses: main.filter(event => event.name === 'Layout').length,
    paintMs: durations('Paint'), frameCallbackMs: durations('FireAnimationFrame'),
    cameraRequests: numeric(rec(after.cameraStats).publications) - numeric(rec(before.cameraStats).publications),
    cameraUpdates: times.length, cameraIntervalP50Ms: quantile(intervals, .5), cameraIntervalP95Ms: quantile(intervals, .95),
    cameraUpdatesPerSecond: (times.length - 1) * 1000 / (times.at(-1)! - times[0]),
    presentationP95Ms: numeric(rec(brief.presentation).p95Ms), droppedMarkers: numeric(rec(brief.pipeline).dropOrSmoothnessMarkers),
    endpointDifferenceDegrees: numeric(run.endpointDifferenceDegrees),
    retained: rec(run.sceneFrames).retained,
    traceSha256: trace.sha256,
  });
}
const summary = ['js', 'resize', 'size'].map(mode => {
  const runs = results.filter(run => run.mode === mode); assert.equal(runs.length, 3);
  const median = (read: (run: typeof runs[number]) => number) => quantile(runs.map(read), .5);
  return { mode, trials: runs.length,
    mainTaskMs: median(run => run.mainTaskMs), styleMs: median(run => run.styleMs), layoutMs: median(run => run.layoutMs),
    layoutPasses: median(run => run.layoutPasses), cameraRequests: median(run => run.cameraRequests),
    cameraUpdates: median(run => run.cameraUpdates), cameraIntervalP50Ms: median(run => run.cameraIntervalP50Ms),
    cameraIntervalP95Ms: median(run => run.cameraIntervalP95Ms), cameraUpdatesPerSecond: median(run => run.cameraUpdatesPerSecond),
    presentationP95Ms: median(run => run.presentationP95Ms),
    totalDroppedMarkers: runs.reduce((sum, run) => sum + run.droppedMarkers, 0),
    maximumEndpointDifferenceDegrees: Math.max(...runs.map(run => run.endpointDifferenceDegrees)),
  };
});
await writeFile(`${directory}/summary.json`, JSON.stringify({ browser: comparison.browser, qualification: comparison.qualification, summary, results }, null, 2));
const labels: Record<string, string> = { js: 'JS pointer input', resize: 'Invisible native resize sensor', size: 'Native resize + contain: size' };
const rows = summary.map(run => `| ${labels[run.mode]} | ${run.mainTaskMs.toFixed(1)} ms | ${run.layoutMs.toFixed(1)} ms | ${run.layoutPasses} | ${run.cameraUpdatesPerSecond.toFixed(1)} | ${run.cameraIntervalP95Ms.toFixed(1)} ms | ${run.totalDroppedMarkers} |`);
const markdown = `# Saturn input performance comparison

This measures an invisible native resize sensor against JS pointer input on the
same complete, live Saturn scene. The existing shared trackball, camera and
renderer run in every case. Renderer JavaScript remains active in the native
cases; this is an input-cost comparison, not a completed CSS-only camera.

Measured in ${String(comparison.browser)}, 1280×900, DPR 1, three interleaved
trials per case. Each trial follows the same integer-coordinate, 216-point drag,
approximately 3.6 seconds of movement followed by a held endpoint and release.
Values are the median of three trials except dropped markers, which are totals.

| Input | Main-thread task time | Layout time | Layout passes | Camera updates/s | Camera update p95 | Dropped markers, 3 runs |
|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

Native resize added about 3% to median main-thread task time and about 34% to
layout time in this sample. Frame cadence was similar. Size containment did not
reduce layout cost. Native cases recorded more compositor dropped-frame markers;
the small number of trials does not establish a precise long-run drop rate.

Main-thread task time is the union of RunTask wall-clock intervals between the
explicit drag markers. It is not a sum of nested script, style and layout slices,
and it is not hardware CPU utilization. The camera-update timestamps observe
actual changes to the retained scene transform; compositor presentation events
alone may include unchanged camera frames. All variants produced about 30 actual
camera updates/second in this browser test. No claim about every device follows.

## Validity checks

- All nine trials retained the same 972 prepared nodes and exactly one body scene.
- Warm-up is followed by restoration of the same starting physical camera pose.
- The endpoint orientation differs by at most ${Math.max(...summary.map(run => run.maximumEndpointDifferenceDegrees)).toFixed(6)} degrees from the JS reference.
- Both Saturn and the sky changed orientation. Before/after screenshots passed
  the declared whole-image tolerance against the JS reference: mean channel
  difference below 0.5/255 and less than 1% of channels differing by over 12/255.
- All trials reported no trace data loss or page errors.
- Raw traces, served renderer module, adapter and SHA-256 hashes are retained.
- CPU sampling was disabled consistently. Same input and scene observers run in
  every mode. The native bridge additionally transports dimensions with a
  MutationObserver; its cost is included.

An earlier attempt was invalid because the native corner painted over Saturn.
Those files are separately marked INVALID in ../saturn-matched/. They are not
included here. Opacity zero keeps the corrected sensor invisible and interactive.

## Evidence

- [Per-run timings and medians](summary.json)
- [Camera, input samples, visual checks and trace hashes](comparison.json)
- [JS trial 1 trace report](js-1-analysis/report.html)
- [Native resize trial 1 trace report](resize-1-analysis/report.html)
- [Size containment trial 1 trace report](size-1-analysis/report.html)
- [JS final scene](js-1-after.png), [native final scene](resize-1-after.png)

All nine raw .json.gz traces and their analyses are beside this file.

## Why the proposed GPU hack does not remove layout

The sensor changes actual width/height, which still requires layout. A separate
transformed visual avoids resizing that visual's own layout box. The supplied
snippet leaves the binding unimplemented: --sensor-width is constant, :has()
only tests for the sensor's existence, and the final rule is empty. will-change
is a hint, not a command to bypass layout. Chromium's Resize() explicitly calls
UpdateStyleAndLayout after publishing the new dimensions.
`;
await writeFile(`${directory}/RESULTS.md`, markdown);
console.log(JSON.stringify(summary, null, 2));
