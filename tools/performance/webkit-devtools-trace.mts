// `node tools/performance/webkit-devtools-trace.mts <capture dir>…`: write trace.devtools.json beside an ios-capture
// trace.json, so Chrome DevTools' Performance panel can open a Safari (WebKit) recording.
//
// DevTools draws a trace only when it looks like Chrome's: a TracingStartedInBrowser record naming the page's frame, a
// renderer main thread called CrRendererMain whose work sits inside RunTask slices, and Chrome's event names. WebKit's
// timeline records map onto those names one to one (the table below); the copy keeps WebKit's own name in args.webkit.
// No converter exists upstream (searched 2026-09-26), so this is the smallest one: names, threads and frames only.
// The USB device counters stay in trace.json (Perfetto); DevTools has no track for them. A capture taken with --screens
// carries screens/<epoch ms>.jpg, the iPad's real screen, which becomes DevTools' screenshot filmstrip.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

/** WebKit timeline record type → Chrome trace event name. Unlisted types keep their WebKit name. */
export const DEVTOOLS_NAMES: Readonly<Record<string, string>> = {
  RecalculateStyles: 'UpdateLayoutTree', ScheduleStyleRecalculation: 'ScheduleStyleRecalculation', InvalidateLayout: 'InvalidateLayout',
  Layout: 'Layout', Paint: 'Paint', Composite: 'Commit', FireAnimationFrame: 'FireAnimationFrame', RequestAnimationFrame: 'RequestAnimationFrame',
  CancelAnimationFrame: 'CancelAnimationFrame', TimerFire: 'TimerFire', TimerInstall: 'TimerInstall', TimerRemove: 'TimerRemove',
  EventDispatch: 'EventDispatch', FunctionCall: 'FunctionCall', EvaluateScript: 'EvaluateScript', TimeStamp: 'TimeStamp',
};

const PID = 1, MAIN = 1, COMPOSITOR = 2, FRAME = 'F1', CATEGORY = 'devtools.timeline';

/** The DevTools-shaped copy of an ios-capture trace.json, with the device's screen grabs (epoch ms, base64 JPEG) as its filmstrip. */
export function devtoolsTrace(trace: unknown, screens: readonly { epochMs: number; jpeg: string }[] = []): { traceEvents: Record<string, unknown>[]; metadata: Record<string, unknown> } {
  const source = requireRecord(trace, 'trace'), events = requireArray(source.traceEvents, 'traceEvents').filter(isRecord);
  const metadata = isRecord(source.metadata) ? source.metadata : {}, url = typeof metadata.url === 'string' ? metadata.url : '';
  const page = events.filter(event => event.pid === 1 && typeof event.ts === 'number' && (event.ph === 'X' || event.ph === 'i'));
  const start = Math.min(...page.map(event => event.ts as number));
  const out: Record<string, unknown>[] = [
    { ph: 'M', name: 'process_name', pid: PID, tid: MAIN, args: { name: 'Renderer' } },
    { ph: 'M', name: 'thread_name', pid: PID, tid: MAIN, args: { name: 'CrRendererMain' } },
    { ph: 'M', name: 'thread_name', pid: PID, tid: COMPOSITOR, args: { name: 'Compositor' } },
    { ph: 'I', s: 't', name: 'TracingStartedInBrowser', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts: start,
      args: { data: { frameTreeNodeId: 1, persistentIds: true, frames: [{ frame: FRAME, url, name: '', processId: PID, isInPrimaryMainFrame: true, isOutermostMainFrame: true }] } } },
    { ph: 'I', s: 't', name: 'SetLayerTreeId', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts: start, args: { data: { frame: FRAME, layerTreeId: 1 } } },
  ];
  let frame = 0;
  for (const event of page) {
    const type = String(event.name), ts = event.ts as number, dur = typeof event.dur === 'number' ? event.dur : 0;
    const data: Record<string, unknown> = { ...(isRecord(event.args) && isRecord(event.args.data) ? event.args.data : {}), frame: FRAME };
    // A WebKit frame lasts until the next one: it becomes the frame boundary on the compositor, not a main-thread task.
    if (type === 'RenderingFrame') {
      frame++;
      out.push({ ph: 'I', s: 't', name: 'BeginFrame', cat: 'disabled-by-default-devtools.timeline.frame', pid: PID, tid: COMPOSITOR, ts, args: { layerTreeId: 1, frameSeqId: frame } });
      continue;
    }
    const name = DEVTOOLS_NAMES[type] ?? type;
    if (type === 'FunctionCall') Object.assign(data, { url: data.scriptName ?? '', lineNumber: data.scriptLine, columnNumber: data.scriptColumn, functionName: '' });
    if (event.ph === 'i') { out.push({ ph: 'I', s: 't', name, cat: CATEGORY, pid: PID, tid: MAIN, ts, args: { data, webkit: type } }); continue; }
    // Chrome's main thread runs everything inside a RunTask; a top-level WebKit record is one task.
    const depthZero = !page.some(other => other !== event && other.ph === 'X' && other.name !== 'RenderingFrame' && typeof other.dur === 'number'
      && (other.ts as number) <= ts && (other.ts as number) + other.dur >= ts + dur && ((other.ts as number) < ts || other.dur > dur));
    if (depthZero) out.push({ ph: 'X', name: 'RunTask', cat: 'disabled-by-default-devtools.timeline', pid: PID, tid: MAIN, ts, dur, args: {} });
    out.push({ ph: 'X', name, cat: CATEGORY, pid: PID, tid: MAIN, ts, dur,
      args: name === 'Layout' ? { beginData: { frame: FRAME }, endData: {}, webkit: type } : { data, webkit: type } });
    if (type === 'Composite') out.push({ ph: 'I', s: 't', name: 'DrawFrame', cat: 'disabled-by-default-devtools.timeline.frame', pid: PID, tid: COMPOSITOR, ts: ts + dur, args: { layerTreeId: 1, frameSeqId: frame } });
  }
  if (screens.length) {
    const epoch = requireFiniteNumber(metadata.stopwatchEpochMs, 'trace metadata stopwatchEpochMs');
    for (const screen of screens) out.push({ ph: 'O', name: 'Screenshot', cat: 'disabled-by-default-devtools.screenshot', id: '0x1', pid: PID, tid: MAIN,
      ts: Math.round((screen.epochMs - epoch) * 1e3), args: { snapshot: screen.jpeg } });
  }
  return { traceEvents: out, metadata: { source: 'cssearth webkit-devtools-trace', ...metadata } };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) throw new TypeError('Usage: webkit-devtools-trace.mts <capture dir>…');
  for (const dir of dirs) {
    const files = await readdir(resolve(dir, 'screens')).then(names => names.filter(name => /^\d+\.jpg$/u.test(name)).sort(), () => []);
    const screens = await Promise.all(files.map(async name => ({ epochMs: Number(name.slice(0, -4)), jpeg: (await readFile(resolve(dir, 'screens', name))).toString('base64') })));
    const copy = devtoolsTrace(JSON.parse(await readFile(resolve(dir, 'trace.json'), 'utf8')), screens);
    await writeFile(resolve(dir, 'trace.devtools.json'), JSON.stringify(copy) + '\n');
    console.log(`${dir}/trace.devtools.json: ${copy.traceEvents.length} events`);
  }
}
