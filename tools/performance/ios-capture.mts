#!/usr/bin/env node
// `node tools/performance/ios-capture.mts`: record one moment of cssEarth in Safari on the booted iOS Simulator, with everything both sides expose.
//
//   node tools/performance/ios-capture.mts --name saturn-flight --steps steps.json [--open <url>] [--dist dist] [--udid <udid>]
//   node tools/performance/ios-capture.mts --name hand-drag --seconds 15        (record while someone uses the app)
//
// Native side: an Instruments Time Profiler trace (`xcrun xctrace`) of the simulator's web content process holding the page
// (`--native page`, the default), of every process on the Mac (`--native all`, for compositor and GPU questions) or none
// (`--native off`), summarised for Safari's web content
// process. Page side, through Safari's Web Inspector (`ios_webkit_debug_proxy`): JavaScript samples for the page and each
// worker, named through the build's source maps; timeline records and rendering frames; CPU per thread; memory by
// category, sampled after collection before and after the moment; console messages and network requests.
// Steps drive the simulator with AXe (`brew install cameroncooke/axe/axe`), so input is real touch input.
// Output: output/performance/ios-captures/<name>-<time>/ with report.json, README.md, native.trace and screenshots.
// --compare <capture dir> pixelmatches each screenshot against the one of the same name there (a visual change that should
// not show gives 0 differing pixels) and writes <name>.diff.png. The status-bar clock is pinned so it never differs.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import type { SourceMapConsumer } from 'source-map-js';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';
import { readSourceMap } from './trace-brief.mts';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const wait = (ms: number) => new Promise(done => setTimeout(done, ms));

// ---- Steps ---------------------------------------------------------------------------------------------------------

export type Step =
  | { readonly tap: readonly [number, number] }
  | { readonly type: string }
  | { readonly drag: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly seconds: number } }
  | { readonly wait: number }
  | { readonly screenshot: string }
  | { readonly probe: string };

const point = (value: unknown, label: string): [number, number] => {
  const list = requireArray(value, label);
  if (list.length !== 2) throw new TypeError(`${label} must be [x, y] in simulator points.`);
  return [requireFiniteNumber(list[0], label), requireFiniteNumber(list[1], label)];
};
/** Steps are external JSON: validate every one before anything records. */
export function parseSteps(value: unknown): Step[] {
  return requireArray(value, 'steps').map((input, index) => {
    const step = requireRecord(input, `step ${index}`), keys = Object.keys(step);
    if (keys.length !== 1) throw new TypeError(`Step ${index} must have exactly one action.`);
    const label = `step ${index}`;
    if ('tap' in step) return { tap: point(step.tap, label) };
    if ('type' in step) return { type: requireString(step.type, label) };
    if ('wait' in step) return { wait: requireFiniteNumber(step.wait, label) };
    if ('probe' in step) {
      const name = requireString(step.probe, label);
      if (!/^[a-z0-9-]+$/u.test(name)) throw new TypeError(`${label}: probe names are lowercase words and dashes.`);
      return { probe: name };
    }
    if ('screenshot' in step) {
      const name = requireString(step.screenshot, label);
      if (!/^[a-z0-9-]+$/u.test(name)) throw new TypeError(`${label}: screenshot names are lowercase words and dashes.`);
      return { screenshot: name };
    }
    if ('drag' in step) {
      const drag = requireRecord(step.drag, label);
      return { drag: { from: point(drag.from, label), to: point(drag.to, label), seconds: requireFiniteNumber(drag.seconds, label) } };
    }
    throw new TypeError(`${label}: unknown action ${keys[0]}.`);
  });
}

/** What a probe step reads from the page: the scene router's state and the size of the document. */
const PROBE_EXPRESSION = `(() => {
  const app = window.__cssEarth, read = key => { try { return app ? app[key] : undefined; } catch (error) { return 'unreadable'; } };
  const error = read('error');
  return { path: location.pathname, ready: read('ready'), activeObjectId: read('activeObjectId'), selectedObjectId: read('selectedObjectId'),
    overview: read('overview'), mountedObjectCount: read('mountedObjectCount'), lifecycle: read('lifecycle'),
    error: error ? String(error.message ?? error) : null, elements: document.getElementsByTagName('*').length };
})()`;

async function perform(steps: readonly Step[], udid: string, out: string, marks: { label: string; at: number; value?: unknown }[], started: number,
  evaluate: (expression: string) => Promise<unknown>) {
  for (const step of steps) {
    const label = JSON.stringify(step);
    const mark: { label: string; at: number; value?: unknown } = { label, at: Date.now() - started };
    marks.push(mark);
    if ('probe' in step) mark.value = await evaluate(PROBE_EXPRESSION).catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
    else if ('tap' in step) await run('axe', ['tap', '-x', String(step.tap[0]), '-y', String(step.tap[1]), '--udid', udid]);
    else if ('type' in step) await run('axe', ['type', step.type, '--udid', udid]);
    else if ('wait' in step) await wait(step.wait * 1000);
    else if ('screenshot' in step) await run('axe', ['screenshot', '--output', resolve(out, `${step.screenshot}.png`), '--udid', udid]);
    else await run('axe', ['drag', '--start-x', String(step.drag.from[0]), '--start-y', String(step.drag.from[1]),
      '--end-x', String(step.drag.to[0]), '--end-y', String(step.drag.to[1]), '--duration', String(step.drag.seconds), '--udid', udid]);
  }
}

// ---- Simulator and proxy -------------------------------------------------------------------------------------------

async function bootedUdid() {
  const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
  const devices = Object.values(requireRecord(requireRecord(JSON.parse(stdout), 'simctl').devices, 'devices')).flatMap(list => requireArray(list, 'devices'));
  const booted = devices.map(device => requireRecord(device, 'device')).filter(device => device.state === 'Booted');
  if (booted.length !== 1) throw new Error(`Expected one booted simulator, found ${booted.length}; pass --udid.`);
  return requireString(booted[0]!.udid, 'udid');
}

/** The simulator's Web Inspector socket moves between boots; the live one is held open by launchd_sim. */
async function inspectorSocket() {
  const { stdout } = await run('lsof', ['-c', 'launchd_sim', '-a', '-U']).catch(() => ({ stdout: '' }));
  const socket = stdout.split('\n').map(line => line.trim().split(/\s+/u).at(-1) ?? '').find(path => path.endsWith('com.apple.webinspectord_sim.socket'));
  if (!socket) throw new Error('No live simulator Web Inspector socket; boot a simulator and open Safari.');
  return socket;
}

async function inspectorPages(port: number): Promise<{ url: string; webSocketDebuggerUrl: string }[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(3000) });
  return requireArray(await response.json(), 'proxy pages').map(page => {
    const record = requireRecord(page, 'proxy page');
    return { url: requireString(record.url, 'page url'), webSocketDebuggerUrl: requireString(record.webSocketDebuggerUrl, 'page socket') };
  });
}

/** The tab on screen: Safari lists background tabs too, and a hidden tab runs no animation frames. */
async function visiblePage(pages: readonly { url: string; webSocketDebuggerUrl: string }[]) {
  for (const page of pages) {
    const session = inspector(page.webSocketDebuggerUrl);
    try {
      await Promise.race([session.ready, wait(5000).then(() => { throw new Error('no page target'); })]);
      const reply = await session.send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true });
      const value = isRecord(reply.result) && isRecord(reply.result.result) ? reply.result.result.value : null;
      if (value === 'visible') return page;
    } catch { /* a tab that cannot answer is not the one on screen */ } finally { session.close(); }
  }
  throw new Error('No visible Safari tab; bring cssEarth to the front in the simulator.');
}

/** Reuse a running proxy that lists pages; otherwise start one on the live socket. Attaches to the visible tab. */
async function connectProxy(port: number): Promise<{ page: { url: string; webSocketDebuggerUrl: string }; proxy: ChildProcess | null }> {
  const listed = await inspectorPages(port).catch(() => []);
  if (listed.length) return { page: await visiblePage(listed), proxy: null };
  const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${await inspectorSocket()}`, '-c', `null:${port - 1},:${port}-${port + 100}`], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 20; attempt++) {
    await wait(500);
    const pages = await inspectorPages(port).catch(() => []);
    if (pages.length) return { page: await visiblePage(pages), proxy };
  }
  proxy.kill();
  throw new Error('Safari shows no inspectable page; open cssEarth in the simulator first.');
}

// ---- Web Inspector session -----------------------------------------------------------------------------------------

type Message = Record<string, unknown>;
/** One inspector connection: the page target, plus each worker reached through the page's Worker domain. */
function inspector(socketUrl: string) {
  const socket = new WebSocket(socketUrl);
  let sequence = 0, pageTarget: string | null = null;
  const pending = new Map<number, (message: Message) => void>(), listeners: ((source: string, message: Message) => void)[] = [];
  const ready = new Promise<void>((done, fail) => {
    socket.onerror = () => fail(new Error('Inspector socket failed.'));
    socket.onmessage = event => {
      const outer: unknown = JSON.parse(String(event.data));
      if (!isRecord(outer)) return;
      const params = isRecord(outer.params) ? outer.params : {};
      if (outer.method === 'Target.targetCreated' && isRecord(params.targetInfo) && params.targetInfo.type === 'page' && !pageTarget) {
        pageTarget = requireString(params.targetInfo.targetId, 'target'); done(); return;
      }
      if (outer.method !== 'Target.dispatchMessageFromTarget') return;
      const inner: unknown = JSON.parse(requireString(params.message, 'target message'));
      if (!isRecord(inner)) return;
      if (typeof inner.id === 'number' && pending.has(inner.id)) { pending.get(inner.id)!(inner); pending.delete(inner.id); return; }
      if (inner.method === 'Worker.dispatchMessageFromWorker' && isRecord(inner.params)) {
        const fromWorker: unknown = JSON.parse(requireString(inner.params.message, 'worker message'));
        if (!isRecord(fromWorker)) return;
        if (typeof fromWorker.id === 'number' && pending.has(fromWorker.id)) { pending.get(fromWorker.id)!(fromWorker); pending.delete(fromWorker.id); return; }
        for (const listener of listeners) listener(requireString(inner.params.workerId, 'worker'), fromWorker);
        return;
      }
      for (const listener of listeners) listener('page', inner);
    };
  });
  const post = (message: Message) => {
    if (!pageTarget) throw new Error('No page target.');
    socket.send(JSON.stringify({ id: ++sequence, method: 'Target.sendMessageToTarget', params: { targetId: pageTarget, message: JSON.stringify(message) } }));
  };
  /** A command that never answers resolves empty after 20 s, so one stuck domain cannot hang the capture. */
  const send = (method: string, params: Message = {}, worker?: string) => new Promise<Message>(done => {
    const id = ++sequence, message = { id, method, params };
    pending.set(id, done);
    setTimeout(() => { if (pending.delete(id)) done({ timeout: method }); }, 20000);
    if (worker) post({ id: ++sequence, method: 'Worker.sendMessageToWorker', params: { workerId: worker, message: JSON.stringify(message) } });
    else post(message);
  });
  return { ready, send, listen: (listener: (source: string, message: Message) => void) => listeners.push(listener), close: () => socket.close() };
}

/** Waits until the page has loaded and the app reports its body ready (window.__cssEarth.ready, as the other capture tools
 * wait for) or failed. Evaluations during the navigation itself can fail; they count as not ready. */
async function waitForApp(session: ReturnType<typeof inspector>, timeoutMs = 120_000): Promise<void> {
  const expression = "document.readyState === 'complete' && Boolean(window.__cssEarth && (window.__cssEarth.ready || window.__cssEarth.error))";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reply = await session.send('Runtime.evaluate', { expression, returnByValue: true }).catch(() => null);
    if (reply && isRecord(reply.result) && isRecord(reply.result.result) && reply.result.result.value === true) return;
    await wait(500);
  }
  throw new Error(`The page did not report ready within ${timeoutMs / 1000} s.`);
}

async function memorySample(session: ReturnType<typeof inspector>, events: Message[]) {
  await session.send('Heap.gc'); await wait(1000);
  const before = events.length;
  await session.send('Memory.startTracking'); await wait(1200); await session.send('Memory.stopTracking'); await wait(200);
  const update = events.slice(before).reverse().find(event => event.method === 'Memory.trackingUpdate');
  return update && isRecord(update.params) ? memoryCategories(update.params.event) : null;
}
const memoryCategories = (event: unknown) => Object.fromEntries(requireArray(requireRecord(event, 'memory event').categories, 'memory categories')
  .map(category => requireRecord(category, 'memory category')).map(category => [requireString(category.type, 'type'), Math.round(requireFiniteNumber(category.size, 'size') / 1048576)]));

// ---- Summaries -----------------------------------------------------------------------------------------------------

type Frame = { readonly name: string; readonly url: string; readonly line: number; readonly column: number };
export type NamedFrame = { readonly label: string };
const top = (counts: Map<string, number>, limit: number) => [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
const bump = (counts: Map<string, number>, key: string, by = 1) => counts.set(key, (counts.get(key) ?? 0) + by);

/** JavaScript samples by exclusive (top frame) and inclusive (anywhere on the stack) function, per target. */
export function summariseSamples(stacks: readonly (readonly Frame[])[], name: (frame: Frame) => string, limit = 30) {
  const self = new Map<string, number>(), inclusive = new Map<string, number>();
  for (const stack of stacks) {
    if (stack[0]) bump(self, name(stack[0]));
    for (const label of new Set(stack.map(name))) bump(inclusive, label);
  }
  return { samples: stacks.length, self: top(self, limit), inclusive: top(inclusive, limit) };
}

const span = (value: Record<string, unknown>) => {
  const start = typeof value.startTime === 'number' ? value.startTime : 0;
  return [start, typeof value.endTime === 'number' && value.endTime >= start ? value.endTime : start] as const;
};
/** Milliseconds of work inside a rendering frame: the union of its direct children's spans. */
export function frameWork(frame: Record<string, unknown>): number {
  const ranges = (Array.isArray(frame.children) ? frame.children : []).filter(isRecord).map(span).sort((a, b) => a[0] - b[0]);
  let until = -Infinity, total = 0;
  for (const [start, end] of ranges) { total += Math.max(0, end - Math.max(start, until)); until = Math.max(until, end); }
  return total * 1000;
}
/** Timeline records by type: time inside each type, counting nested records of the same type once. */
export function summariseTimeline(records: readonly unknown[]) {
  const time = new Map<string, number>(), count = new Map<string, number>(), frames: number[] = [];
  const walk = (value: unknown, open: ReadonlySet<string>) => {
    if (!isRecord(value)) return;
    const type = typeof value.type === 'string' ? value.type : 'unknown';
    // Instant records (timer install, removal) carry no end time and add no duration.
    const start = typeof value.startTime === 'number' ? value.startTime : 0, end = typeof value.endTime === 'number' && value.endTime >= start ? value.endTime : start;
    bump(count, type);
    if (!open.has(type)) bump(time, type, (end - start) * 1000);
    // A rendering frame stays open while nothing needs drawing, so its own span includes idle time. Its work is the
    // union of its top-level records.
    if (type === 'RenderingFrame') frames.push(frameWork(value));
    const next = new Set(open).add(type);
    for (const child of Array.isArray(value.children) ? value.children : []) walk(child, next);
  };
  for (const record of records) walk(record, new Set());
  const round = (value: number) => Math.round(value * 10) / 10;
  // The longest rendering frames, each with its own time by record type and the scripts it ran.
  const inside = (frame: Record<string, unknown>) => {
    const byType = new Map<string, number>(), scripts = new Map<string, number>();
    const visit = (value: unknown, open: ReadonlySet<string>) => {
      if (!isRecord(value)) return;
      const type = typeof value.type === 'string' ? value.type : 'unknown';
      const begin = typeof value.startTime === 'number' ? value.startTime : 0;
      const ms = (typeof value.endTime === 'number' && value.endTime >= begin ? value.endTime - begin : 0) * 1000;
      if (!open.has(type)) bump(byType, type, ms);
      const data = isRecord(value.data) ? value.data : {};
      if (type === 'FunctionCall' || type === 'EvaluateScript') bump(scripts, `${String(data.scriptName ?? data.url ?? '').split('/').pop()}:${String(data.scriptLine ?? data.lineNumber ?? '')}`, ms);
      const next = new Set(open).add(type);
      for (const child of Array.isArray(value.children) ? value.children : []) visit(child, next);
    };
    for (const child of Array.isArray(frame.children) ? frame.children : []) visit(child, new Set());
    return { byType: [...byType].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, ms]) => ({ type, ms: round(ms) })),
      scripts: [...scripts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([script, ms]) => ({ script, ms: round(ms) })) };
  };
  const rendering = records.filter(isRecord).filter(record => record.type === 'RenderingFrame');
  const firstStart = Math.min(...records.filter(isRecord).map(record => typeof record.startTime === 'number' ? record.startTime : Infinity));
  const longest = rendering.map(record => ({ record, ms: frameWork(record), wallMs: (span(record)[1] - span(record)[0]) * 1000 }))
    .sort((a, b) => b.ms - a.ms).slice(0, 5)
    .map(({ record, ms, wallMs }) => ({ ms: round(ms), wallMs: round(wallMs), atMs: round(((Number(record.startTime) || 0) - firstStart) * 1000), ...inside(record) }));
  return {
    longestFrames: longest,
    byType: [...time].sort((a, b) => b[1] - a[1]).map(([type, ms]) => ({ type, ms: round(ms), count: count.get(type) ?? 0 })),
    renderingFrames: { count: frames.length, over16ms: frames.filter(ms => ms > 16.7).length, over50ms: frames.filter(ms => ms > 50).length,
      longestMs: round(Math.max(0, ...frames)), totalMs: round(frames.reduce((sum, ms) => sum + ms, 0)) },
  };
}

/** The JavaScript that scheduled style and layout work: the top frame of each scheduling record's stack. */
export const SCHEDULING_TYPES = ['ScheduleStyleRecalculation', 'InvalidateLayout', 'ScheduleLayout'] as const;
export function schedulingStacks(records: readonly unknown[]): { type: string; frames: Frame[] }[] {
  const found: { type: string; frames: Frame[] }[] = [];
  const framesOf = (value: unknown): Frame[] => {
    const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.callFrames) ? value.callFrames : [];
    return list.filter(isRecord).map(frame => ({ name: typeof frame.functionName === 'string' ? frame.functionName : '',
      url: typeof frame.url === 'string' ? frame.url : '', line: typeof frame.lineNumber === 'number' ? frame.lineNumber : 0,
      column: typeof frame.columnNumber === 'number' ? frame.columnNumber : 0 }));
  };
  const walk = (value: unknown) => {
    if (!isRecord(value)) return;
    if (typeof value.type === 'string' && (SCHEDULING_TYPES as readonly string[]).includes(value.type)) {
      const frames = framesOf(value.stackTrace ?? (isRecord(value.data) ? value.data.stackTrace : undefined));
      found.push({ type: value.type, frames });
    }
    for (const child of Array.isArray(value.children) ? value.children : []) walk(child);
  };
  for (const record of records) walk(record);
  return found;
}
export function summariseInitiators(stacks: readonly { type: string; frames: readonly Frame[] }[], name: (frame: Frame) => string, limit = 20) {
  return Object.fromEntries(SCHEDULING_TYPES.map(type => {
    const counts = new Map<string, number>();
    for (const stack of stacks.filter(entry => entry.type === type)) {
      const frame = stack.frames.find(candidate => candidate.url);
      bump(counts, frame ? name(frame) : '(no script frame)');
    }
    return [type, top(counts, limit)];
  }));
}

/** Composited layers: how many, their backing memory, and why the largest were composited. */
async function layerTree(session: ReturnType<typeof inspector>) {
  const documentReply = await session.send('DOM.getDocument');
  const rootNode = isRecord(documentReply.result) && isRecord(documentReply.result.root) ? documentReply.result.root.nodeId : null;
  if (typeof rootNode !== 'number') return { error: 'no document' };
  await session.send('LayerTree.enable');
  const reply = await session.send('LayerTree.layersForNode', { nodeId: rootNode });
  const layers = isRecord(reply.result) && Array.isArray(reply.result.layers) ? reply.result.layers.filter(isRecord) : [];
  const memory = (layer: Record<string, unknown>) => typeof layer.memory === 'number' ? layer.memory : 0;
  const reasons = new Map<string, number>();
  const paints = (layer: Record<string, unknown>) => typeof layer.paintCount === 'number' ? layer.paintCount : 0;
  // The largest by backing memory, then the most repainted: a layer repainted every frame is re-sent every frame.
  const byMemory = [...layers].sort((a, b) => memory(b) - memory(a)).slice(0, 12);
  const byPaints = [...layers].sort((a, b) => paints(b) - paints(a)).filter(layer => !byMemory.includes(layer)).slice(0, 8);
  const largest = [...byMemory, ...byPaints];
  // Reasons for a sample of layers across the list, so the count by reason describes the whole tree.
  const sample = layers.filter((_, index) => index % Math.max(1, Math.ceil(layers.length / 300)) === 0);
  for (const layer of sample) {
    const why = await session.send('LayerTree.reasonsForCompositingLayer', { layerId: layer.layerId });
    const flags = isRecord(why.result) && isRecord(why.result.compositingReasons) ? why.result.compositingReasons : {};
    for (const [reason, on] of Object.entries(flags)) if (on === true) bump(reasons, reason);
  }
  // What each large layer is: resolve its node and read the element's identity and image.
  const describe = async (nodeId: unknown) => {
    if (typeof nodeId !== 'number') return null;
    const resolved = await session.send('DOM.resolveNode', { nodeId });
    const objectId = isRecord(resolved.result) && isRecord(resolved.result.object) ? resolved.result.object.objectId : null;
    if (typeof objectId !== 'string') return null;
    const call = await session.send('Runtime.callFunctionOn', { objectId, returnByValue: true, functionDeclaration: `function () {
      const element = this.nodeType === 1 ? this : this.parentElement; if (!element) return null;
      const style = getComputedStyle(element);
      const data = [...element.attributes].filter(attribute => attribute.name.startsWith('data-') || attribute.name === 'id').map(attribute => attribute.name + '=' + attribute.value.slice(0, 40));
      const path = []; for (let node = element; node && path.length < 4; node = node.parentElement) path.push(node.tagName.toLowerCase() + (node.className && typeof node.className === 'string' ? '.' + node.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''));
      return { path: path.join(' < '), data, image: style.backgroundImage.slice(0, 160), size: element.offsetWidth + 'x' + element.offsetHeight };
    }` });
    return isRecord(call.result) && isRecord(call.result.result) ? call.result.result.value ?? null : null;
  };
  const described = [];
  for (const layer of largest) described.push({ layer, element: await describe(layer.nodeId) });
  await session.send('LayerTree.disable');
  return { count: layers.length, memoryMb: Math.round(layers.reduce((sum, layer) => sum + memory(layer), 0) / 1048576 * 10) / 10,
    paints: layers.reduce((sum, layer) => sum + (typeof layer.paintCount === 'number' ? layer.paintCount : 0), 0),
    reasonsInSample: { sampled: sample.length, counts: top(reasons, 20) },
    largest: described.map(({ layer, element }) => ({ memoryKb: Math.round(memory(layer) / 1024), bounds: layer.bounds ?? null, paintCount: layer.paintCount ?? 0, element })) };
}

/** CPU per thread, averaged over the tracking updates, with each worker named by its script. */
export function summariseCpu(updates: readonly unknown[], workers: ReadonlyMap<string, string>) {
  const totals = new Map<string, { sum: number; peak: number }>();
  let overall = 0, peak = 0;
  for (const update of updates) {
    const event = requireRecord(update, 'cpu update');
    const usage = requireFiniteNumber(event.usage, 'cpu usage');
    overall += usage; peak = Math.max(peak, usage);
    for (const input of Array.isArray(event.threads) ? event.threads : []) {
      const thread = requireRecord(input, 'cpu thread');
      const target = typeof thread.targetId === 'string' ? workers.get(thread.targetId) ?? thread.targetId : null;
      const label = target ? `worker ${target}` : typeof thread.name === 'string' && thread.name ? thread.name : 'unnamed thread';
      const entry = totals.get(label) ?? { sum: 0, peak: 0 };
      const value = requireFiniteNumber(thread.usage, 'thread usage');
      entry.sum += value; entry.peak = Math.max(entry.peak, value); totals.set(label, entry);
    }
  }
  const n = Math.max(1, updates.length), round = (value: number) => Math.round(value * 10) / 10;
  return { updates: updates.length, averagePercent: round(overall / n), peakPercent: round(peak),
    threads: [...totals].map(([thread, { sum, peak: threadPeak }]) => ({ thread, averagePercent: round(sum / n), peakPercent: round(threadPeak) }))
      .filter(thread => thread.peakPercent > 0).sort((a, b) => b.averagePercent - a.averagePercent) };
}

/** Maps page URLs to the build's hidden source maps (`astro build --mode performance`). */
async function sourceNamer(dist: string | null) {
  const maps = new Map<string, SourceMapConsumer | null>();
  const distRoot = dist ? await realpath(resolve(dist)).catch(() => null) : null;
  const consumer = async (url: string) => {
    if (maps.has(url)) return maps.get(url)!;
    let found: SourceMapConsumer | null = null;
    if (distRoot) {
      try {
        const file = resolve(distRoot, '.' + decodeURIComponent(new URL(url).pathname)), rel = relative(distRoot, file);
        if (!rel.startsWith('..') && !isAbsolute(rel)) found = readSourceMap(await readFile(file + '.map', 'utf8'));
      } catch { found = null; }
    }
    maps.set(url, found); return found;
  };
  const chained = new Map<string, SourceMapConsumer>();
  return {
    async prepare(frames: readonly Frame[]) {
      for (const url of new Set(frames.map(frame => frame.url))) if (url) await consumer(url);
      // Sources that are themselves built JavaScript inside this checkout, with a map beside them.
      for (const map of maps.values()) for (const source of map?.sources ?? []) {
        const path = source.replace(/^(\.\.\/)+/u, '');
        if (chained.has(path) || !/\.m?js$/u.test(path)) continue;
        const file = resolve(root, path), rel = relative(root, file);
        if (rel.startsWith('..') || isAbsolute(rel)) continue;
        try { chained.set(path, readSourceMap(await readFile(file + '.map', 'utf8'))); } catch { /* no map beside it */ }
      }
    },
    mapped: () => [...maps].filter(([, map]) => map).length,
    name(frame: Frame) {
      const map = frame.url ? maps.get(frame.url) : null;
      let original = map && frame.line > 0 ? map.originalPositionFor({ line: frame.line, column: Math.max(0, frame.column - 1) }) : null;
      // A prebuilt package (the renderer's dist) carries its own map beside it: follow it to the TypeScript source.
      const source = original?.source ? original.source.replace(/^(\.\.\/)+/u, '') : null;
      const inner = source ? chained.get(source) : undefined;
      if (original && inner) {
        const deeper = inner.originalPositionFor({ line: original.line, column: original.column });
        if (deeper.source) original = { ...deeper, name: deeper.name ?? original.name };
      }
      if (original?.source) return `${original.name ?? (frame.name || '(anonymous)')} ${original.source.replace(/^(\.\.\/)+/u, '')}:${original.line}`;
      const file = frame.url ? frame.url.split('/').pop() : '(native)';
      return `${frame.name || '(anonymous)'} ${file}:${frame.line}:${frame.column}`;
    },
  };
}

// ---- Native trace --------------------------------------------------------------------------------------------------

/** The Time Profiler table, summarised: CPU per process, then the web content process's hottest native frames. */
export function summariseTimeProfile(xml: string, limit = 30) {
  const labels = new Map<string, string>(), weights = new Map<string, number>(), backtraces = new Map<string, string[]>();
  const perProcess = new Map<string, number>(), self = new Map<string, number>(), inclusive = new Map<string, number>();
  const rows = xml.split('<row>').slice(1);
  const rowProcess: { process: string; weight: number; frames: string[] }[] = [];
  for (const row of rows) {
    for (const m of row.matchAll(/<([\w-]+) id="(\d+)"(?: fmt="([^"]*)")?(?: name="([^"]*)")?/gu)) labels.set(m[2]!, m[4] ?? m[3] ?? m[1]!);
    for (const m of row.matchAll(/<weight id="(\d+)" fmt="[^"]*">(\d+)</gu)) weights.set(m[1]!, Number(m[2]));
    const processId = row.match(/<process (?:id|ref)="(\d+)"/u)?.[1];
    const weightMatch = row.match(/<weight (?:id="(\d+)"|ref="(\d+)")/u);
    const weight = weights.get(weightMatch?.[1] ?? weightMatch?.[2] ?? '') ?? 1e6;
    const backtrace = row.match(/<backtrace (?:id="(\d+)"|ref="(\d+)")/u);
    let frames = backtrace?.[2] ? backtraces.get(backtrace[2]) ?? [] : [];
    if (backtrace?.[1]) {
      const block = row.slice(row.indexOf('<backtrace'), row.indexOf('</backtrace>'));
      frames = [...block.matchAll(/<frame (?:id="(\d+)" name="([^"]*)"|ref="(\d+)")/gu)].map(m => m[2] ?? labels.get(m[3]!) ?? '?');
      backtraces.set(backtrace[1], frames);
    }
    rowProcess.push({ process: processId ? labels.get(processId) ?? '?' : '?', weight, frames });
  }
  for (const { process, weight } of rowProcess) bump(perProcess, process, weight);
  const web = [...perProcess].filter(([process]) => process.includes('WebContent')).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const decode = (text: string) => text.replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"');
  for (const { process, weight, frames } of rowProcess) {
    if (process !== web) continue;
    if (frames[0]) bump(self, decode(frames[0]), weight);
    for (const frame of new Set(frames)) bump(inclusive, decode(frame), weight);
  }
  const ms = (list: { label: string; count: number }[]) => list.map(({ label, count }) => ({ frame: label, ms: Math.round(count / 1e6) }));
  return { webContentProcess: web, webContentMs: Math.round((web ? perProcess.get(web) ?? 0 : 0) / 1e6),
    processes: ms(top(perProcess, 12)).map(({ frame, ms: time }) => ({ process: frame, ms: time })),
    self: ms(top(self, limit)), inclusive: ms(top(inclusive, limit)) };
}

// ---- Pixels ---------------------------------------------------------------------------------------------------------

/** The settings tools/investigations/compare-visual-evidence.mts uses; antialiased pixels count, so 0 means identical. */
export const PIXEL_SETTINGS = { threshold: 0.1, includeAA: true, alpha: 0.2, diffColor: [255, 0, 0] as [number, number, number] };

/** Differing pixels between two same-sized RGBA images, and the diff image pixelmatch draws. */
export function comparePixels(a: Uint8Array, b: Uint8Array, width: number, height: number) {
  if (a.length !== width * height * 4 || b.length !== a.length) throw new RangeError('Screenshots differ in size.');
  const diff = new Uint8Array(a.length);
  return { differing: pixelmatch(a, b, diff, width, height, PIXEL_SETTINGS), total: width * height, diff };
}

async function compareScreenshots(out: string, baseline: string, steps: readonly Step[]) {
  const decode = async (file: string) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const screenshots = [];
  for (const step of steps) {
    if (!('screenshot' in step)) continue;
    const name = step.screenshot;
    const reference = await decode(resolve(baseline, `${name}.png`)).catch(() => null);
    if (!reference) { screenshots.push({ name, differing: null, total: null }); continue; }
    const current = await decode(resolve(out, `${name}.png`));
    const { width, height } = current.info;
    const { differing, total, diff } = comparePixels(reference.data, current.data, width, height);
    await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(resolve(out, `${name}.diff.png`));
    screenshots.push({ name, differing, total });
  }
  return { baseline: relative(root, baseline), screenshots };
}

// ---- Native trace ---------------------------------------------------------------------------------------------------

function nativeMode(value: string) {
  if (value !== 'page' && value !== 'all' && value !== 'off') throw new TypeError('--native is page, all or off.');
  return value;
}

/** The simulator's web content process holding the page: the largest of Safari's in the simulator runtime. Recording only
 * it keeps the trace a fraction of an every-process one, whose export alone took 14 s. */
async function pageProcess(): Promise<number> {
  const { stdout } = await run('ps', ['-Ao', 'pid=,rss=,args=']);
  const candidates = stdout.split('\n').map(line => /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null && match[3]!.includes('CoreSimulator') && match[3]!.includes('WebKit.WebContent'))
    .map(match => ({ pid: Number(match[1]), rss: Number(match[2]) })).sort((a, b) => b.rss - a.rss);
  if (!candidates[0]) throw new Error('No web content process runs in the simulator.');
  return candidates[0].pid;
}

/** Stops a recording; xctrace has hung finalising, so after 30 s it is killed and the capture reports no native trace. */
async function stopRecording(xctrace: ChildProcess): Promise<boolean> {
  if (xctrace.exitCode !== null) return true;
  const exited = new Promise<boolean>(done => xctrace.once('exit', () => done(true)));
  xctrace.kill('SIGINT');
  const stopped = await Promise.race([exited, wait(30_000).then(() => false)]);
  if (!stopped) { xctrace.kill('SIGKILL'); await exited; }
  return stopped;
}

async function exportTimeProfile(native: string): Promise<ReturnType<typeof summariseTimeProfile> | { error: string }> {
  try {
    const { stdout } = await run('xcrun', ['xctrace', 'export', '--input', native, '--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]'], { maxBuffer: 2 ** 31 });
    return summariseTimeProfile(stdout);
  } catch (error) { return { error: error instanceof Error ? error.message.slice(0, 500) : String(error) }; }
}

// ---- Capture -------------------------------------------------------------------------------------------------------

function options(args: readonly string[]) {
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? null : null; };
  const name = value('--name');
  if (!name || !/^[a-z0-9-]+$/u.test(name)) throw new TypeError('Pass --name <lowercase-words-and-dashes>.');
  const stepsFile = value('--steps'), seconds = value('--seconds');
  if (!stepsFile === !seconds) throw new TypeError('Pass either --steps <file.json> or --seconds <n>.');
  return { name, stepsFile, seconds: seconds === null ? null : requireFiniteNumber(Number(seconds), '--seconds'),
    dist: value('--dist') ?? 'dist', udid: value('--udid'), port: Number(value('--port') ?? 9222), profile: value('--template') ?? 'Time Profiler',
    open: value('--open'), settle: Number(value('--settle') ?? 12), noCache: args.includes('--no-cache'), compare: value('--compare'), native: nativeMode(value('--native') ?? 'page') };
}

export async function captureIosMoment(args: readonly string[]) {
  const option = options(args);
  const steps = option.stepsFile ? parseSteps(JSON.parse(await readFile(resolve(option.stepsFile), 'utf8'))) : [];
  const udid = option.udid ?? await bootedUdid();
  const out = resolve(root, 'output/performance/ios-captures', `${option.name}-${new Date().toISOString().replace(/[:.]/gu, '-')}`);
  await mkdir(out, { recursive: true });
  const { page, proxy } = await connectProxy(option.port);
  const session = inspector(page.webSocketDebuggerUrl);
  await session.ready;
  // A fixed status-bar clock keeps screenshots of the same view identical across captures.
  await run('xcrun', ['simctl', 'status_bar', udid, 'override', '--time', '9:41']);
  const events: Message[] = [], workers = new Map<string, string>();
  let recording = false;
  session.listen((source, message) => {
    if (message.method === 'Worker.workerCreated' && isRecord(message.params)) {
      const worker = requireString(message.params.workerId, 'worker');
      workers.set(worker, requireString(message.params.url, 'worker url').split('/').pop() ?? '');
      // With the Worker domain on, WebKit holds each new worker paused until Worker.initialized ("required to allow
      // execution in the worker", Worker.json). Profile it first when a recording is running, then let it run.
      void (async () => {
        if (recording) await session.send('ScriptProfiler.startTracking', { includeSamples: true }, worker);
        await session.send('Worker.initialized', { workerId: worker });
      })();
    }
    events.push({ ...message, source });
  });
  // Page.enable starts the inspector stopwatch every timestamp reads (WebKit InspectorPageAgent::enable); without it all are 0.
  for (const domain of ['Page', 'Console', 'Network', 'Timeline', 'Worker']) await session.send(`${domain}.enable`);
  // Real visits keep Safari's cache; --no-cache measures a cold load (it also refetches repeated images).
  if (option.noCache) await session.send('Network.setResourceCachingDisabled', { disabled: true });
  // --open loads the page in this same tab, so each capture starts from a fresh load in the tab on screen.
  // --settle then counts from the moment the app reports its body loaded, not from the navigation.
  if (option.open) { workers.clear(); await session.send('Page.navigate', { url: option.open }); await waitForApp(session); await wait(option.settle * 1000); }
  const location = await session.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const url = isRecord(location.result) && isRecord(location.result.result) && typeof location.result.result.value === 'string' ? location.result.result.value : page.url;
  await wait(500);
  const memoryBefore = await memorySample(session, events);
  const recordingStart = events.length;

  // Instruments first, so the native trace covers the whole moment.
  const native = resolve(out, 'native.trace');
  const target = option.native === 'all' ? ['--all-processes'] : option.native === 'page' ? ['--attach', String(await pageProcess())] : null;
  const xctrace = target ? spawn('xcrun', ['xctrace', 'record', '--template', option.profile, '--device', udid, ...target, '--output', native, '--no-prompt'], { stdio: ['ignore', 'pipe', 'pipe'] }) : null;
  const xctraceLog: string[] = [];
  xctrace?.stdout?.on('data', chunk => xctraceLog.push(String(chunk)));
  xctrace?.stderr?.on('data', chunk => xctraceLog.push(String(chunk)));
  for (let attempt = 0; xctrace && attempt < 60 && !xctraceLog.join('').includes('Starting recording'); attempt++) await wait(250);

  await session.send('ScriptProfiler.startTracking', { includeSamples: true });
  for (const worker of workers.keys()) await session.send('ScriptProfiler.startTracking', { includeSamples: true }, worker);
  recording = true;
  await session.send('CPUProfiler.startTracking');
  await session.send('Timeline.start', { maxCallStackDepth: 8 });
  const started = Date.now(), marks: { label: string; at: number; value?: unknown }[] = [];
  const evaluate = async (expression: string) => {
    const reply = await session.send('Runtime.evaluate', { expression, returnByValue: true });
    return isRecord(reply.result) && isRecord(reply.result.result) ? reply.result.result.value : null;
  };
  if (steps.length) await perform(steps, udid, out, marks, started, evaluate);
  else { marks.push({ label: `manual ${option.seconds} s`, at: 0 }); await wait((option.seconds ?? 0) * 1000); }
  const durationMs = Date.now() - started;
  await session.send('Timeline.stop');
  await session.send('CPUProfiler.stopTracking');
  await session.send('ScriptProfiler.stopTracking');
  for (const worker of workers.keys()) await session.send('ScriptProfiler.stopTracking', {}, worker);
  const recorded = xctrace ? await stopRecording(xctrace) : false;
  // The export runs while the page side is read.
  const nativeExport = !xctrace ? Promise.resolve({ error: 'Not recorded (--native off).' })
    : recorded ? exportTimeProfile(native) : Promise.resolve({ error: 'xctrace did not finish its recording within 30 s.' });
  await wait(1500);
  const moment = events.slice(recordingStart);
  const layers = await layerTree(session).catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
  const memoryAfter = await memorySample(session, events);
  session.close(); proxy?.kill();

  // Page side.
  const stacks = new Map<string, Frame[][]>();
  for (const event of moment) {
    if (event.method !== 'ScriptProfiler.trackingComplete' || !isRecord(event.params) || !isRecord(event.params.samples)) continue;
    const traces = requireArray(event.params.samples.stackTraces, 'stack traces').map(trace => requireArray(requireRecord(trace, 'trace').stackFrames, 'frames')
      .map(frame => requireRecord(frame, 'frame')).map(frame => ({ name: typeof frame.name === 'string' ? frame.name : '', url: typeof frame.url === 'string' ? frame.url : '',
        line: typeof frame.line === 'number' ? frame.line : 0, column: typeof frame.column === 'number' ? frame.column : 0 })));
    const source = requireString(event.source, 'source');
    stacks.set(source === 'page' ? 'page' : `worker ${workers.get(source) ?? source}`, traces);
  }
  const timelineRecords = moment.filter(event => event.method === 'Timeline.eventRecorded' && isRecord(event.params)).map(event => (event.params as Message).record);
  const scheduling = schedulingStacks(timelineRecords);
  const namer = await sourceNamer(option.dist);
  await namer.prepare([...[...stacks.values()].flat(2), ...scheduling.flatMap(entry => entry.frames)]);
  const initiators = summariseInitiators(scheduling, frame => namer.name(frame));
  const javascript = Object.fromEntries([...stacks].map(([target, list]) => [target, summariseSamples(list, frame => namer.name(frame))]));
  const timeline = summariseTimeline(timelineRecords);
  const cpu = summariseCpu(moment.filter(event => event.method === 'CPUProfiler.trackingUpdate' && isRecord(event.params)).map(event => (event.params as Message).event), workers);
  const consoleMessages = moment.filter(event => event.method === 'Console.messageAdded' && isRecord(event.params)).map(event => requireRecord((event.params as Message).message, 'console'))
    .map(message => ({ level: String(message.level), text: String(message.text).slice(0, 500), url: typeof message.url === 'string' ? message.url : null, line: message.line ?? null }));
  const responses = new Map<string, { url: string; type: string; status: number; bytes: number; initiator?: string }>();
  const requestStacks = new Map<string, Frame[]>();
  for (const event of moment) {
    if (!isRecord(event.params)) continue;
    const id = String(event.params.requestId);
    // Who asked for it: the script stack WebKit attaches to the request.
    if (event.method === 'Network.requestWillBeSent' && isRecord(event.params.initiator))
      requestStacks.set(id, schedulingStacks([{ type: 'ScheduleLayout', stackTrace: event.params.initiator.stackTrace }])[0]?.frames ?? []);
    if (event.method === 'Network.responseReceived' && isRecord(event.params.response)) responses.set(id, { url: String(event.params.response.url), type: String(event.params.type), status: Number(event.params.response.status), bytes: 0 });
    if (event.method === 'Network.dataReceived' && responses.has(id)) responses.get(id)!.bytes += Number(event.params.dataLength) || 0;
  }
  await namer.prepare([...requestStacks.values()].flat());
  for (const [id, response] of responses) {
    const frames = requestStacks.get(id)?.filter(frame => frame.url) ?? [];
    if (frames.length) response.initiator = frames.slice(0, 10).map(frame => namer.name(frame)).join(' < ');
  }
  const requests = [...responses.values()];

  // Native side.
  const nativeSummary = await nativeExport;

  const pixels = option.compare ? await compareScreenshots(out, resolve(option.compare), steps) : null;
  const report = {
    schema: 'cssearth-ios-capture@1', name: option.name, url, udid, durationMs, steps: marks, workers: Object.fromEntries(workers),
    sourceMaps: { dist: option.dist, mapped: namer.mapped() }, memoryMb: { before: memoryBefore, after: memoryAfter },
    javascript, timeline, initiators, layers, cpu, console: consoleMessages,
    network: { requests: requests.length, bytes: requests.reduce((sum, request) => sum + request.bytes, 0), largest: requests.sort((a, b) => b.bytes - a.bytes).slice(0, 15) },
    native: nativeSummary, pixels, files: (await readdir(out)).sort(),
  };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(out, 'README.md'), readme(report));
  await run('xcrun', ['simctl', 'status_bar', udid, 'clear']).catch(() => undefined);
  return { out, report };
}

type ReadmeInput = { name: string; url: string; durationMs: number; memoryMb: { before: unknown; after: unknown }; sourceMaps: { mapped: number };
  initiators: Record<string, { label: string; count: number }[]>; layers: unknown;
  javascript: Record<string, ReturnType<typeof summariseSamples>>; timeline: ReturnType<typeof summariseTimeline>; cpu: ReturnType<typeof summariseCpu>;
  console: readonly { level: string; text: string }[]; network: { requests: number; bytes: number }; native: ReturnType<typeof summariseTimeProfile> | { error: string };
  pixels: Awaited<ReturnType<typeof compareScreenshots>> | null; steps: readonly { label: string; at: number; value?: unknown }[] };
function readme(r: ReadmeInput): string {
  const lines = [`# ${r.name}`, '', `${r.url}, ${Math.round(r.durationMs / 100) / 10} s. Source maps for ${r.sourceMaps.mapped} scripts.`, '',
    `Memory (MB, after collection): before ${JSON.stringify(r.memoryMb.before)}, after ${JSON.stringify(r.memoryMb.after)}.`, '',
    ...(r.steps.some(step => 'value' in step) ? ['## Probes', '', ...r.steps.filter(step => 'value' in step)
      .map(step => `- ${JSON.parse(step.label).probe} at ${Math.round(step.at / 100) / 10} s: ${JSON.stringify(step.value)}`), ''] : []),
    ...(r.pixels ? ['## Pixels against ' + r.pixels.baseline, '', ...r.pixels.screenshots.map(shot => shot.differing === null
      ? `- ${shot.name}: no baseline screenshot` : `- ${shot.name}: ${shot.differing} of ${shot.total} pixels differ`), ''] : []),
    `Rendering frames by work inside them: ${r.timeline.renderingFrames.count}, over 16.7 ms ${r.timeline.renderingFrames.over16ms}, over 50 ms ${r.timeline.renderingFrames.over50ms}, longest ${r.timeline.renderingFrames.longestMs} ms.`, '',
    '## Composited layers', '', `${JSON.stringify(r.layers).slice(0, 900)}`, '',
    '## Busiest frames (work inside the frame; wall time in brackets)', '', ...r.timeline.longestFrames.map(frame => `- ${frame.ms} ms (${frame.wallMs} ms) at ${frame.atMs} ms: ` +
      `${frame.byType.map(entry => `${entry.type} ${entry.ms}`).join(', ')}${frame.scripts.length ? `; scripts ${frame.scripts.map(entry => `${entry.script} ${entry.ms}`).join(', ')}` : ''}`), '',
    '## Timeline', '', ...r.timeline.byType.slice(0, 15).map(entry => `- ${entry.type}: ${entry.ms} ms (${entry.count})`), '',
    '## Who scheduled style and layout', '', ...Object.entries(r.initiators).flatMap(([type, list]) => list.length
      ? [`${type}:`, ...list.slice(0, 8).map(entry => `- ${entry.count} ${entry.label}`), ''] : []),
    '## CPU by thread', '', `Page average ${r.cpu.averagePercent}%, peak ${r.cpu.peakPercent}%.`, ...r.cpu.threads.slice(0, 10).map(thread => `- ${thread.thread}: ${thread.averagePercent}% average, ${thread.peakPercent}% peak`), ''];
  for (const [target, summary] of Object.entries(r.javascript)) {
    lines.push(`## JavaScript: ${target} (${summary.samples} samples)`, '', 'Self:', ...summary.self.slice(0, 15).map(entry => `- ${entry.count} ${entry.label}`), '',
      'Inclusive:', ...summary.inclusive.slice(0, 15).map(entry => `- ${entry.count} ${entry.label}`), '');
  }
  if ('error' in r.native) lines.push('## Native', '', `Unavailable: ${r.native.error}`, '');
  else lines.push(`## Native: ${r.native.webContentProcess} (${r.native.webContentMs} ms CPU)`, '', 'Self:', ...r.native.self.slice(0, 20).map(entry => `- ${entry.ms} ms ${entry.frame}`), '',
    'Processes:', ...r.native.processes.map(entry => `- ${entry.ms} ms ${entry.process}`), '');
  const problems = r.console.filter(message => message.level === 'error' || message.level === 'warning');
  lines.push(`## Console`, '', problems.length ? problems.slice(0, 20).map(message => `- ${message.level}: ${message.text}`).join('\n') : 'No errors or warnings.', '',
    `## Network`, '', `${r.network.requests} requests, ${Math.round(r.network.bytes / 1024)} KB.`, '');
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { out, report } = await captureIosMoment(process.argv.slice(2));
  console.log(`${relative(root, out)}: ${report.timeline.renderingFrames.count} frames, longest ${report.timeline.renderingFrames.longestMs} ms, ` +
    `${report.console.filter(message => message.level === 'error').length} console errors.`);
}
