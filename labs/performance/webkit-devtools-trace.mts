// `node labs/performance/webkit-devtools-trace.mts <capture dir>… [--marks <prefix>]`: write trace.devtools.json beside
// an ios-capture trace.json, so Chrome DevTools' Performance panel can open a Safari (WebKit) recording. `--marks` keeps
// only the span between the first and last `console.timeStamp` whose message starts with the prefix, so the chart is
// the run and not the load before it or the still page after.
//
// DevTools draws a trace only when it looks like Chrome's: a TracingStartedInBrowser record naming the page's frame, a
// renderer main thread called CrRendererMain whose work sits inside RunTask slices, and Chrome's event names. WebKit's
// timeline records map onto those names one to one (the table below); the copy keeps WebKit's own name in args.webkit.
// No converter exists upstream (searched 2026-09-26), so this is the smallest one: names, threads and frames only.
// Counter events are preserved; Perfetto displays all category/device counters. A capture taken with --screens
// carries screens/<epoch ms>.jpg, the iPad's real screen, which becomes DevTools' screenshot filmstrip.
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { restoreSchedulingStacks } from './webkit-trace-clues.mts';
import { pathToFileURL } from 'node:url';
import { isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { writeNavigationAnalysis } from './webkit-trace-slices.mts';

/** WebKit timeline record type → Chrome trace event name. Unlisted types keep their WebKit name. */
export const DEVTOOLS_NAMES: Readonly<Record<string, string>> = {
  RecalculateStyles: 'UpdateLayoutTree', ScheduleStyleRecalculation: 'ScheduleStyleRecalculation', InvalidateLayout: 'InvalidateLayout',
  Layout: 'Layout', Paint: 'Paint', Composite: 'Commit', FireAnimationFrame: 'FireAnimationFrame', RequestAnimationFrame: 'RequestAnimationFrame',
  CancelAnimationFrame: 'CancelAnimationFrame', TimerFire: 'TimerFire', TimerInstall: 'TimerInstall', TimerRemove: 'TimerRemove',
  EventDispatch: 'EventDispatch', FunctionCall: 'FunctionCall', EvaluateScript: 'EvaluateScript', TimeStamp: 'TimeStamp',
};

const PID = 1, MAIN = 1, COMPOSITOR = 2, FRAME = 'F1', CATEGORY = 'devtools.timeline';

/** A quarter of a second kept on each side of the marked span. */
const MARK_MARGIN_US = 250_000;

/** The DevTools-shaped copy of an ios-capture trace.json, with the device's screen grabs (epoch ms, base64 JPEG) as its
 * filmstrip. With `marks`, only the span between the first and last time stamp whose message starts with it. */
export function devtoolsTrace(trace: unknown, screens: readonly { epochMs: number; jpeg: string }[] = [], marks: string | null = null): { traceEvents: Record<string, unknown>[]; metadata: Record<string, unknown> } {
  const source = requireRecord(trace, 'trace'), recorded = requireArray(source.traceEvents, 'traceEvents').filter(isRecord);
  const metadata = isRecord(source.metadata) ? source.metadata : {}, url = typeof metadata.url === 'string' ? metadata.url : '';
  const marked = marks === null ? [] : recorded.filter(event => event.name === 'TimeStamp' && typeof event.ts === 'number' && isRecord(event.args) && isRecord(event.args.data)
    && String(event.args.data.message ?? '').startsWith(marks)).map(event => Number(event.ts));
  if (marks !== null && !marked.length) throw new TypeError(`The trace has no time stamp starting with "${marks}".`);
  const from = marked.reduce((n, ts) => Math.min(n, ts), Infinity) - MARK_MARGIN_US, to = marks === null ? Infinity : marked.reduce((n, ts) => Math.max(n, ts), -Infinity) + MARK_MARGIN_US;
  const events = marks === null ? recorded : recorded.filter(event => typeof event.ts !== 'number' || (event.ts >= from && event.ts <= to));
  const page = events.filter(event => event.pid === 1 && typeof event.ts === 'number' && (event.ph === 'X' || event.ph === 'i'));
  const start = page.reduce((n, event) => Math.min(n, Number(event.ts)), Infinity);
  // A debug capture can contain hundreds of thousands of records. A sorted interval
  // sweep finds containing native calls without a quadratic scan or argument spreading.
  const roots = new Set<Record<string, unknown>>();
  let greatestEnd = -Infinity, greatestStart = Infinity;
  for (const event of page.filter(e => e.ph === 'X' && e.name !== 'RenderingFrame' && typeof e.dur === 'number')
    .sort((a, b) => Number(a.ts) - Number(b.ts) || Number(b.dur) - Number(a.dur))) {
    const ts = Number(event.ts), end = ts + Number(event.dur);
    if (!(greatestEnd > end || greatestEnd === end && greatestStart < ts)) roots.add(event);
    if (end > greatestEnd) { greatestEnd = end; greatestStart = ts; }
  }
  const out: Record<string, unknown>[] = [
    { ph: 'M', name: 'process_name', pid: PID, tid: MAIN, args: { name: 'Renderer' } },
    { ph: 'M', name: 'thread_name', pid: PID, tid: MAIN, args: { name: 'CrRendererMain' } },
    { ph: 'M', name: 'thread_name', pid: PID, tid: COMPOSITOR, args: { name: 'Compositor' } },
    { ph: 'I', s: 't', name: 'TracingStartedInBrowser', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts: start,
      args: { data: { frameTreeNodeId: 1, persistentIds: true, frames: [{ frame: FRAME, url, name: '', processId: PID, isInPrimaryMainFrame: true, isOutermostMainFrame: true }] } } },
    { ph: 'I', s: 't', name: 'SetLayerTreeId', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts: start, args: { data: { frame: FRAME, layerTreeId: 1 } } },
  ];
  let frame = 0;
  for (const event of events) if (event.ph === 'C' || (event.pid !== 1 && (event.ph === 'X' || event.ph === 'M'))) out.push({ ...event });
  for (const event of page) {
    const type = String(event.name), ts = event.ts as number, dur = typeof event.dur === 'number' ? event.dur : 0;
    const data: Record<string, unknown> = { ...(isRecord(event.args) && isRecord(event.args.data) ? event.args.data : {}), frame: FRAME };
    if (event.cat === 'cssearth.memory') {
      out.push({ ph: 'I', s: 't', name: 'TimeStamp', cat: CATEGORY, pid: PID, tid: MAIN, ts,
        args: { data: { ...data, message: `${type}: ${String(data.objectId ?? '')}` }, webkit: type } });
      continue;
    }
    // A WebKit frame becomes a frame on the compositor, not a main-thread task: it begins and is drawn where the record
    // starts and ends. Every frame is drawn in the chart, one that composited nothing too: drawn only where a Composite
    // ended, the Frames track was empty wherever the page was still or the main thread waited, which is where a long
    // frame hides (2026-10-04).
    if (type === 'RenderingFrame') {
      frame++;
      out.push({ ph: 'I', s: 't', name: 'BeginFrame', cat: 'disabled-by-default-devtools.timeline.frame', pid: PID, tid: COMPOSITOR, ts, args: { layerTreeId: 1, frameSeqId: frame } });
      // The last frame before a still page lasts until the page moves again: it ends with the marked span.
      out.push({ ph: 'I', s: 't', name: 'DrawFrame', cat: 'disabled-by-default-devtools.timeline.frame', pid: PID, tid: COMPOSITOR, ts: Math.min(ts + dur, to), args: { layerTreeId: 1, frameSeqId: frame } });
      continue;
    }
    const name = DEVTOOLS_NAMES[type] ?? type;
    if (type === 'FunctionCall') Object.assign(data, { url: data.scriptName ?? '', lineNumber: data.scriptLine, columnNumber: data.scriptColumn, functionName: '' });
    if (event.ph === 'i') { out.push({ ph: 'I', s: 't', name, cat: CATEGORY, pid: PID, tid: MAIN, ts, args: { data, webkit: type } }); continue; }
    // Chrome's main thread runs everything inside a RunTask; a top-level WebKit record is one task.
    const depthZero = roots.has(event);
    if (depthZero) out.push({ ph: 'X', name: 'RunTask', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts, dur, args: {} });
    out.push({ ph: 'X', name, cat: CATEGORY, pid: PID, tid: MAIN, ts, dur,
      args: name === 'Layout' ? { beginData: data, endData: {}, webkit: type } : { data, webkit: type } });
  }
  if (screens.length) {
    const epoch = requireFiniteNumber(metadata.stopwatchEpochMs, 'trace metadata stopwatchEpochMs');
    for (const screen of screens) {
      const ts = Math.round((screen.epochMs - epoch) * 1e3);
      if (marks === null || (ts >= from && ts <= to)) out.push({ ph: 'O', name: 'Screenshot', cat: 'disabled-by-default-devtools.screenshot', id: '0x1', pid: PID, tid: MAIN, ts, args: { snapshot: screen.jpeg } });
    }
  }
  return { traceEvents: out, metadata: { source: 'cssearth webkit-devtools-trace', ...metadata } };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2), flag = args.indexOf('--marks'), marks = flag >= 0 ? args[flag + 1] ?? null : null;
  const dirs = flag >= 0 ? [...args.slice(0, flag), ...args.slice(flag + 2)] : args;
  if (!dirs.length || (flag >= 0 && !marks)) throw new TypeError('Usage: webkit-devtools-trace.mts <capture dir>… [--marks <prefix>]');
  for (const dir of dirs) {
    const files = await readdir(resolve(dir, 'screens')).then(names => names.filter(name => /^\d+\.jpg$/u.test(name)).sort(), () => []);
    const screens = await Promise.all(files.map(async name => ({ epochMs: Number(name.slice(0, -4)), jpeg: (await readFile(resolve(dir, 'screens', name))).toString('base64') })));
    const copy = devtoolsTrace(JSON.parse(await readFile(resolve(dir, 'trace.json'), 'utf8')), screens, marks);
    const receipt: unknown = await readFile(resolve(dir, 'report.json'), 'utf8').then(JSON.parse, () => null);
    copy.metadata.capture = { directory: resolve(dir), screenSource: screens.length ? 'device-screen' : 'none', screenFrames: screens.length,
      ...(isRecord(receipt) ? { checkout: receipt.checkout ?? null, checkoutRole: receipt.checkoutRole ?? null,
        revision: receipt.revision ?? null, trackedChanges: receipt.trackedChanges ?? null, debug: receipt.debug === true } : {}) };
    if (!screens.length) console.error(`${dir}: no native device-screen frames; DevTools will have no screenshot filmstrip. Inspect existing device PNGs or record a visual trace with --screens.`);
    const raw: unknown = await readFile(resolve(dir, 'raw.json.gz')).then(bytes => JSON.parse(gunzipSync(bytes).toString('utf8')), () => null);
    restoreSchedulingStacks(copy, raw);
    const analysis = await writeNavigationAnalysis(copy, dir, receipt, raw);
    console.log(`${dir}/analysis.json: ${analysis.views.length} prepared views`);
    // The live viewer discovers only complete exports, including their slices.
    const temporary = resolve(dir, `trace.devtools.${process.pid}.tmp`);
    await writeFile(temporary, JSON.stringify(copy) + '\n');
    await rename(temporary, resolve(dir, 'trace.devtools.json'));
    console.log(`${dir}/trace.devtools.json: ${copy.traceEvents.length} events, ${screens.length} device-screen frames`);
  }
}
