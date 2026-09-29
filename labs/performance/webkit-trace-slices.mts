import { paintClues, paintTraceEvents } from './webkit-paint-clues.mts';
/** Semantic navigation windows and exclusive cost pivots for every exported iPad trace. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { isRecord, requireArray, requireRecord } from '@cssearth/core';
import { createCostIndex } from './trace-costs.mts';
import { dataOf, isTraceEvent, type TraceEvent } from './trace-model.mts';
import { traceCauses, causeTraceEvents } from './webkit-trace-causes.mts';
import { traceClues } from './webkit-trace-clues.mts';
import { inspectBuild } from './trace-sources.mts';
import { compositorClues, compositorTraceEvents } from './webkit-compositor-clues.mts';
import { analysisHtml } from './webkit-trace-report.mts';

type Trace = { traceEvents: Record<string, unknown>[]; metadata: Record<string, unknown> };
type Bounds = { startTs: number; endTs: number };
interface View extends Bounds { id: string; label: string; phase: string; path: string; outcome: string; }
const navigationPrefix = 'cssEarth:navigation:';
const round = (value: number) => Math.round(value * 1000) / 1000;

const message = (e: { args?: Readonly<Record<string, unknown>>; name: string; ts: number }) => String(dataOf(e).message);

function parsedTrace(value: unknown): Trace {
  const root = requireRecord(value, 'DevTools trace');
  const traceEvents = requireArray(root.traceEvents, 'traceEvents').map((event, index) => requireRecord(event, `event ${index}`));
  for (const event of traceEvents) if (event.ph !== 'M' && (!isTraceEvent(event) || !Number.isFinite(event.ts) ||
    (event.dur !== undefined && (!Number.isFinite(event.dur) || event.dur < 0)))) throw new TypeError('Invalid timed trace event');
  return { traceEvents, metadata: isRecord(root.metadata) ? root.metadata : {} };
}

/** Rebase a window while preserving thread/frame metadata, native images, and counter state. */
export function sliceDevtoolsTrace(value: unknown, bounds: Bounds): Trace {
  const source = parsedTrace(value), { startTs, endTs } = bounds;
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) throw new TypeError('Invalid slice bounds');
  const out: Record<string, unknown>[] = [], previous = new Map<string, Record<string, unknown>>();
  for (const event of source.traceEvents) {
    if (event.ph === 'M') { out.push(event); continue; }
    if (!isTraceEvent(event)) continue;
    if (event.name === 'TracingStartedInBrowser' || event.name === 'SetLayerTreeId') { out.push({ ...event, ts: 0 }); continue; }
    if (event.ts < startTs && (event.name === 'Screenshot' || event.ph === 'C')) {
      const key = `${event.pid}:${event.tid}:${event.name}`;
      const prior = previous.get(key);
      if (!prior || Number(prior.ts) < event.ts) previous.set(key, event);
    }
    if (event.ph === 'X' && event.dur !== undefined) {
      const lo = Math.max(startTs, event.ts), hi = Math.min(endTs, event.ts + event.dur);
      if (hi > lo) out.push({ ...event, ts: lo - startTs, dur: hi - lo });
    } else if (event.ts >= startTs && event.ts < endTs) out.push({ ...event, ts: event.ts - startTs });
  }
  for (const event of previous.values()) if (!out.some(e => e.ts === 0 && e.name === event.name && e.pid === event.pid && e.tid === event.tid)) out.push({ ...event, ts: 0 });
  out.sort((a, b) => Number(a.ts ?? 0) - Number(b.ts ?? 0));
  return { traceEvents: out, metadata: { ...source.metadata,
    ...(typeof source.metadata.stopwatchEpochMs === 'number' ? { stopwatchEpochMs: source.metadata.stopwatchEpochMs + startTs / 1000 } : {}),
    slice: { sourceStartUs: startTs, sourceEndUs: endTs, timestampsRebased: true,
      carriedState: [...previous.values()].map(event => ({ name: event.name, sourceTimestampUs: event.ts })) } } };
}

export function navigationAnalysis(value: unknown, receipt: unknown) {
  const trace = parsedTrace(value), events = trace.traceEvents.filter((e): e is Record<string, unknown> & TraceEvent => isTraceEvent(e));
  if (!events.length) throw new TypeError('Trace contains no timed events');
  const startTs = events.reduce((n, e) => Math.min(n, e.ts), Infinity);
  const endTs = events.reduce((n, e) => Math.max(n, e.ts + (e.dur ?? 0)), -Infinity) + 1;
  const marks = events.filter(e => e.name === 'TimeStamp' && typeof dataOf(e).message === 'string' &&
    String(dataOf(e).message).startsWith(navigationPrefix)).sort((a, b) => a.ts - b.ts);
  const phase = (e: typeof events[number]) => message(e).slice(navigationPrefix.length);
  const starts = marks.filter(e => phase(e) === 'requested');
  const report = isRecord(receipt) ? receipt : {};
  const steps = Array.isArray(report.steps) ? report.steps.filter(isRecord) : [];
  const flights = steps.map(s => s.value).filter(isRecord).filter(v => v.action === 'fly' && typeof v.objectId === 'string');
  // A count mismatch must not silently shift object names onto unrelated gestures.
  const named = starts.length > 0 && flights.length === starts.length;
  let from = 'start';
  if (typeof report.url === 'string') { try { from = new URL(report.url).pathname.split('/').filter(Boolean)[0] ?? 'start'; } catch { /* Unknown start stays explicit. */ } }
  const views: View[] = [{ id: 'full', label: 'Full journey', phase: 'full', startTs, endTs, path: 'trace.devtools.json', outcome: 'recorded' }];
  const screens = events.filter(e => e.name === 'Screenshot').sort((a, b) => a.ts - b.ts);
  const add = (id: string, label: string, phase: string, lo: number | undefined, hi: number | undefined, outcome: string) => {
    if (lo !== undefined && hi !== undefined && hi > lo) views.push({ id, label, phase, startTs: lo, endTs: hi,
      path: `slices/${id}.trace.devtools.json`, outcome });
  };
  for (const [index, first] of starts.entries()) {
    const until = starts[index + 1]?.ts ?? endTs;
    const own = marks.filter(e => e.ts >= first.ts && e.ts < until);
    const at = (name: string) => own.find(e => phase(e) === name)?.ts;
    const terminal = own.find(e => ['finished', 'failed', 'cancelled'].includes(phase(e)));
    const outcome = terminal ? phase(terminal) : 'incomplete';
    const last = terminal?.ts ?? until;
    const windowEnd = terminal ? Math.min(until, last + 1) : until;
    const to = named ? String(flights[index]!.objectId) : `navigation ${index + 1}`;
    const id = String(index + 1).padStart(2, '0');
    const label = named ? `${id} ${from} → ${to}` : `${id} Navigation`;
    add(`${id}-flight`, label, 'flight', first.ts, windowEnd, outcome);
    const ready = at('approach-ready');
    add(`${id}-handoff`, `${label} · handoff`, 'handoff', at('handoff'), ready ?? at('mounted'), outcome);
    add(`${id}-approach`, `${label} · remaining approach`, 'approach', ready, windowEnd, outcome);
    const reveal = at('billboard-removed');
    if (reveal !== undefined) {
      const before = screens.filter(e => e.ts < reveal).at(-1)?.ts ?? ready;
      const after = screens.find(e => e.ts >= reveal)?.ts;
      add(`${id}-reveal`, `${label} · reveal`, 'reveal', before, after === undefined ? windowEnd : Math.min(until, after + 1), outcome);
    }
    from = to;
  }
  const main = events.filter(e => e.pid === 1 && e.tid === 1 && e.ph === 'X');
  const costs = createCostIndex(events, { rendererPid: 1, rendererMainTid: 1 }, { startTs, endTs });
  const tasks = main.filter(e => e.name === 'RunTask' && e.dur !== undefined);
  // Cost pivots select a whole containing task, retaining the cause and children.
  for (const [category, name] of [['style', 'UpdateLayoutTree'], ['layout', 'Layout'], ['paint', 'Paint'], ['composite', 'Commit'], ['script', 'FunctionCall']] as const) {
    const worst = main.filter(e => e.name === name).sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))[0];
    if (!worst || !worst.dur) continue;
    const task = tasks.find(e => e.ts <= worst.ts && e.ts + e.dur! >= worst.ts + worst.dur!) ?? worst;
    add(`worst-${category}`, `Worst ${category} task`, category, task.ts, task.ts + (task.dur ?? 0), 'recorded');
  }
  return { schema: 'cssearth-ipad-analysis@1', naming: named ? 'ordered successful CLI flights matched to navigation requests' : 'navigation names unavailable; no inferred mapping',
    nominalBudgetMs: 1000 / 60,
    interpretation: 'Exclusive categories partition observed main-thread task time; Paint inside Composite counts once. Over-budget tasks use a nominal 60 Hz budget, not measured dropped display frames. WebKit presentation feedback is unavailable. Slice clocks start at zero; source offsets and carried screenshots/counters remain in metadata.',
    marks: marks.map(e => ({ phase: phase(e), sourceUs: e.ts })),
    views: views.map(view => {
      const within = tasks.filter(e => e.ts < view.endTs && e.ts + (e.dur ?? 0) > view.startTs);
      const ranked = within.map(e => ({ name: e.name, sourceUs: e.ts,
        ...costs.query(Math.max(e.ts, view.startTs), Math.min(e.ts + (e.dur ?? 0), view.endTs)) })).sort((a, b) => b.totalMs - a.totalMs);
      const breakdown = costs.query(view.startTs, view.endTs);
      return { ...view, durationMs: round((view.endTs - view.startTs) / 1000), ...breakdown,
        worstTaskMs: ranked[0]?.totalMs ?? 0, overBudgetTasks: ranked.filter(t => t.totalMs > 1000 / 60).length,
        worstTasks: ranked.slice(0, 5), nativeFrames: screens.filter(e => e.ts >= view.startTs && e.ts < view.endTs).length };
    }) };
}

export async function writeNavigationAnalysis(trace: unknown, directory: string, receipt: unknown, raw: unknown = null) {
  const analysis = navigationAnalysis(trace, receipt);
  const styleWrites: unknown = await readFile(resolve(directory, 'style-writes.json'), 'utf8').then(JSON.parse, () => null);
  const causeData: unknown = await readFile(resolve(directory, 'causes.json'), 'utf8').then(JSON.parse, () => null);
  const layerLines = await readFile(resolve(directory, 'layers.jsonl'), 'utf8').catch(() => '');
  const layerSamples: unknown[] = layerLines.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const paint = paintClues(trace, causeData, layerSamples, isRecord(receipt) && typeof receipt.url === 'string' ? receipt.url : undefined);
  const compositor = compositorClues(trace, layerSamples, causeData);
  const clues = traceClues(trace, raw, analysis.views, styleWrites, causeData);
  // Maps annotate evidence once; saved annotations remain useful after dist is rebuilt.
  const locations = [...clues.tasks.flatMap(t => [...t.chain.operations.flatMap(o => o.stack), ...t.calls, ...t.timedSamples.flatMap(s => s.frames), ...t.scheduling.flatMap(s => s.stack),
    ...(t.renderingPasses ?? []).flatMap(p => p.triggers.flatMap(s => s.stack))]),
    ...clues.causes.motion.flatMap(m => m.stack), ...clues.styleInitiators.flatMap(s => s.initiators), ...clues.repeatedSynchronousRendering.map(g => g.caller), ...clues.network.requests.flatMap(r => r.initiator)];
  const locationKey = (v: unknown) => { const r = isRecord(v) ? v : {}; return JSON.stringify([r.url, r.lineNumber, r.columnNumber]); };
  const saved: unknown = await readFile(resolve(directory, 'analysis.sources.json'), 'utf8').then(JSON.parse, () => null);
  const prior = isRecord(saved) && Array.isArray(saved.locations) ? saved.locations.filter(isRecord) : [];
  const byLocation = new Map(prior.map(l => [locationKey(l), l.original]));
  let buildSources: unknown = isRecord(saved) && prior.length ? saved.buildSources : [];
  for (const l of locations) l.original = byLocation.get(locationKey(l));
  const missing = locations.filter(l => !byLocation.has(locationKey(l)));
  if (missing.length) {
    const maps = isRecord(receipt) && isRecord(receipt.sourceMaps) ? receipt.sourceMaps : {};
    // A supplied map is labeled as such: inspector records bundle/map/source hashes,
    // but does not claim independently verified response bytes for old captures.
    if (typeof maps.dist === 'string') buildSources = await inspectBuild({ sampledJsSelf: missing, busiestTasks: [],
      sourceUrls: [...new Set(missing.map(l => l.url))] }, maps.dist).catch(error => [{ unavailable: String(error) }]);
    await writeFile(resolve(directory, 'analysis.sources.json'), JSON.stringify({ buildSources, locations }, null, 2) + '\n');
  }
  const enriched = parsedTrace(trace);
  enriched.traceEvents.push(...causeTraceEvents(traceCauses(trace, causeData)), ...compositorTraceEvents(compositor), ...paintTraceEvents(paint));
  // Also enrich the full export; slices below use the same diagnostic lane.
  const original = requireRecord(trace, 'trace'); original.traceEvents = enriched.traceEvents;
  const events = enriched.traceEvents.filter((e): e is Record<string, unknown> & TraceEvent => isTraceEvent(e));
  const full = analysis.views[0]!;
  const costs = createCostIndex(events, { rendererPid: 1, rendererMainTid: 1 }, full);
  for (const task of clues.tasks) {
    const lo = task.contextStartUs, hi = task.contextEndUs;
    const tasks = events.filter(e => e.name === 'RunTask' && e.ts < hi && e.ts + (e.dur ?? 0) > lo);
    analysis.views.push({ id: task.id, label: `${task.flight ?? 'Recording'} · ${task.durationMs} ms task`,
      phase: 'task', path: `slices/${task.id}.trace.devtools.json`, outcome: 'recorded', startTs: lo, endTs: hi,
      durationMs: round((hi - lo) / 1000), ...costs.query(lo, hi),
      worstTaskMs: tasks.reduce((n, e) => Math.max(n, costs.query(Math.max(lo, e.ts), Math.min(hi, e.ts + (e.dur ?? 0))).totalMs), 0),
      overBudgetTasks: tasks.filter(e => Math.min(hi, e.ts + (e.dur ?? 0)) - Math.max(lo, e.ts) > 1e6 / 60).length,
      worstTasks: [], nativeFrames: events.filter(e => e.name === 'Screenshot' && e.ts >= lo && e.ts < hi).length });
  }
  await mkdir(resolve(directory, 'slices'), { recursive: true });
  for (const view of analysis.views) if (view.phase !== 'full') {
    const slice = sliceDevtoolsTrace(enriched, view);
    slice.metadata.analysis = { label: view.label, phase: view.phase };
    await writeFile(resolve(directory, view.path), JSON.stringify(slice) + '\n');
  }
  const manifest = { ...analysis, capture: basename(directory), clues, compositor, paint, buildSources };
  const pending = resolve(directory, `analysis.${process.pid}.tmp`);
  await writeFile(pending, JSON.stringify(manifest, null, 2) + '\n');
  await rename(pending, resolve(directory, 'analysis.json'));
  await writeFile(resolve(directory, 'analysis.html'), analysisHtml(manifest));
  return manifest;
}
