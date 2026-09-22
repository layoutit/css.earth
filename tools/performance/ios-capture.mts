#!/usr/bin/env node
// `node tools/performance/ios-capture.mts`: record one moment of cssEarth in Safari on the booted iOS Simulator, with everything both sides expose.
//
//   node tools/performance/ios-capture.mts --name saturn-flight --steps steps.json [--open <url>] [--dist dist] [--udid <udid>]
//   node tools/performance/ios-capture.mts --name hand-drag --seconds 15        (record while someone uses the app)
//
// Native side: an Instruments Time Profiler trace of every process (`xcrun xctrace`), summarised for Safari's web content
// process. Page side, through Safari's Web Inspector (`ios_webkit_debug_proxy`): JavaScript samples for the page and each
// worker, named through the build's source maps; timeline records and rendering frames; CPU per thread; memory by
// category, sampled after collection before and after the moment; console messages and network requests.
// Steps drive the simulator with AXe (`brew install cameroncooke/axe/axe`), so input is real touch input.
// Output: output/performance/ios-captures/<name>-<time>/ with report.json, README.md, native.trace and screenshots.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
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
  | { readonly screenshot: string };

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

async function perform(steps: readonly Step[], udid: string, out: string, marks: { label: string; at: number }[], started: number) {
  for (const step of steps) {
    const label = JSON.stringify(step);
    marks.push({ label, at: Date.now() - started });
    if ('tap' in step) await run('axe', ['tap', '-x', String(step.tap[0]), '-y', String(step.tap[1]), '--udid', udid]);
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

/** Timeline records by type: time inside each type, counting nested records of the same type once. */
export function summariseTimeline(records: readonly unknown[]) {
  const time = new Map<string, number>(), count = new Map<string, number>(), frames: number[] = [];
  const walk = (value: unknown, open: ReadonlySet<string>) => {
    if (!isRecord(value)) return;
    const type = typeof value.type === 'string' ? value.type : 'unknown';
    const start = typeof value.startTime === 'number' ? value.startTime : 0, end = typeof value.endTime === 'number' ? value.endTime : start;
    bump(count, type);
    if (!open.has(type)) bump(time, type, (end - start) * 1000);
    if (type === 'RenderingFrame') frames.push((end - start) * 1000);
    const next = new Set(open).add(type);
    for (const child of Array.isArray(value.children) ? value.children : []) walk(child, next);
  };
  for (const record of records) walk(record, new Set());
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    byType: [...time].sort((a, b) => b[1] - a[1]).map(([type, ms]) => ({ type, ms: round(ms), count: count.get(type) ?? 0 })),
    renderingFrames: { count: frames.length, over16ms: frames.filter(ms => ms > 16.7).length, over50ms: frames.filter(ms => ms > 50).length,
      longestMs: round(Math.max(0, ...frames)), totalMs: round(frames.reduce((sum, ms) => sum + ms, 0)) },
  };
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

// ---- Capture -------------------------------------------------------------------------------------------------------

function options(args: readonly string[]) {
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? null : null; };
  const name = value('--name');
  if (!name || !/^[a-z0-9-]+$/u.test(name)) throw new TypeError('Pass --name <lowercase-words-and-dashes>.');
  const stepsFile = value('--steps'), seconds = value('--seconds');
  if (!stepsFile === !seconds) throw new TypeError('Pass either --steps <file.json> or --seconds <n>.');
  return { name, stepsFile, seconds: seconds === null ? null : requireFiniteNumber(Number(seconds), '--seconds'),
    dist: value('--dist') ?? 'dist', udid: value('--udid'), port: Number(value('--port') ?? 9222), profile: value('--template') ?? 'Time Profiler',
    open: value('--open'), settle: Number(value('--settle') ?? 12) };
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
  const events: Message[] = [], workers = new Map<string, string>();
  session.listen((source, message) => {
    if (message.method === 'Worker.workerCreated' && isRecord(message.params)) workers.set(requireString(message.params.workerId, 'worker'), requireString(message.params.url, 'worker url').split('/').pop() ?? '');
    events.push({ ...message, source });
  });
  // Page.enable starts the inspector stopwatch every timestamp reads (WebKit InspectorPageAgent::enable); without it all are 0.
  for (const domain of ['Page', 'Console', 'Network', 'Timeline', 'Worker']) await session.send(`${domain}.enable`);
  await session.send('Network.setResourceCachingDisabled', { disabled: true });
  // --open loads the page in this same tab, so each capture starts from a fresh load in the tab on screen.
  if (option.open) { workers.clear(); await session.send('Page.navigate', { url: option.open }); await wait(option.settle * 1000); }
  const location = await session.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const url = isRecord(location.result) && isRecord(location.result.result) && typeof location.result.result.value === 'string' ? location.result.result.value : page.url;
  await wait(500);
  const memoryBefore = await memorySample(session, events);
  const recordingStart = events.length;

  // Instruments first, so the native trace covers the whole moment.
  const native = resolve(out, 'native.trace');
  const xctrace = spawn('xcrun', ['xctrace', 'record', '--template', option.profile, '--device', udid, '--all-processes', '--output', native, '--no-prompt'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const xctraceLog: string[] = [];
  xctrace.stdout?.on('data', chunk => xctraceLog.push(String(chunk)));
  xctrace.stderr?.on('data', chunk => xctraceLog.push(String(chunk)));
  for (let attempt = 0; attempt < 60 && !xctraceLog.join('').includes('Starting recording'); attempt++) await wait(250);

  await session.send('ScriptProfiler.startTracking', { includeSamples: true });
  for (const worker of workers.keys()) await session.send('ScriptProfiler.startTracking', { includeSamples: true }, worker);
  await session.send('CPUProfiler.startTracking');
  await session.send('Timeline.start', { maxCallStackDepth: 8 });
  const started = Date.now(), marks: { label: string; at: number }[] = [];
  if (steps.length) await perform(steps, udid, out, marks, started);
  else { marks.push({ label: `manual ${option.seconds} s`, at: 0 }); await wait((option.seconds ?? 0) * 1000); }
  const durationMs = Date.now() - started;
  await session.send('Timeline.stop');
  await session.send('CPUProfiler.stopTracking');
  await session.send('ScriptProfiler.stopTracking');
  for (const worker of workers.keys()) await session.send('ScriptProfiler.stopTracking', {}, worker);
  xctrace.kill('SIGINT');
  await new Promise(done => xctrace.once('exit', done));
  await wait(1500);
  const moment = events.slice(recordingStart);
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
  const namer = await sourceNamer(option.dist);
  await namer.prepare([...stacks.values()].flat(2));
  const javascript = Object.fromEntries([...stacks].map(([target, list]) => [target, summariseSamples(list, frame => namer.name(frame))]));
  const timeline = summariseTimeline(moment.filter(event => event.method === 'Timeline.eventRecorded' && isRecord(event.params)).map(event => (event.params as Message).record));
  const cpu = summariseCpu(moment.filter(event => event.method === 'CPUProfiler.trackingUpdate' && isRecord(event.params)).map(event => (event.params as Message).event), workers);
  const consoleMessages = moment.filter(event => event.method === 'Console.messageAdded' && isRecord(event.params)).map(event => requireRecord((event.params as Message).message, 'console'))
    .map(message => ({ level: String(message.level), text: String(message.text).slice(0, 500), url: typeof message.url === 'string' ? message.url : null, line: message.line ?? null }));
  const responses = new Map<string, { url: string; type: string; status: number; bytes: number }>();
  for (const event of moment) {
    if (!isRecord(event.params)) continue;
    const id = String(event.params.requestId);
    if (event.method === 'Network.responseReceived' && isRecord(event.params.response)) responses.set(id, { url: String(event.params.response.url), type: String(event.params.type), status: Number(event.params.response.status), bytes: 0 });
    if (event.method === 'Network.dataReceived' && responses.has(id)) responses.get(id)!.bytes += Number(event.params.dataLength) || 0;
  }
  const requests = [...responses.values()];

  // Native side.
  let nativeSummary: ReturnType<typeof summariseTimeProfile> | { error: string };
  try {
    const { stdout } = await run('xcrun', ['xctrace', 'export', '--input', native, '--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]'], { maxBuffer: 2 ** 31 });
    nativeSummary = summariseTimeProfile(stdout);
  } catch (error) { nativeSummary = { error: error instanceof Error ? error.message.slice(0, 500) : String(error) }; }

  const report = {
    schema: 'cssearth-ios-capture@1', name: option.name, url, udid, durationMs, steps: marks, workers: Object.fromEntries(workers),
    sourceMaps: { dist: option.dist, mapped: namer.mapped() }, memoryMb: { before: memoryBefore, after: memoryAfter },
    javascript, timeline, cpu, console: consoleMessages,
    network: { requests: requests.length, bytes: requests.reduce((sum, request) => sum + request.bytes, 0), largest: requests.sort((a, b) => b.bytes - a.bytes).slice(0, 15) },
    native: nativeSummary, files: (await readdir(out)).sort(),
  };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(out, 'README.md'), readme(report));
  return { out, report };
}

type ReadmeInput = { name: string; url: string; durationMs: number; memoryMb: { before: unknown; after: unknown }; sourceMaps: { mapped: number };
  javascript: Record<string, ReturnType<typeof summariseSamples>>; timeline: ReturnType<typeof summariseTimeline>; cpu: ReturnType<typeof summariseCpu>;
  console: readonly { level: string; text: string }[]; network: { requests: number; bytes: number }; native: ReturnType<typeof summariseTimeProfile> | { error: string } };
function readme(r: ReadmeInput): string {
  const lines = [`# ${r.name}`, '', `${r.url}, ${Math.round(r.durationMs / 100) / 10} s. Source maps for ${r.sourceMaps.mapped} scripts.`, '',
    `Memory (MB, after collection): before ${JSON.stringify(r.memoryMb.before)}, after ${JSON.stringify(r.memoryMb.after)}.`, '',
    `Rendering frames: ${r.timeline.renderingFrames.count}, over 16.7 ms ${r.timeline.renderingFrames.over16ms}, over 50 ms ${r.timeline.renderingFrames.over50ms}, longest ${r.timeline.renderingFrames.longestMs} ms.`, '',
    '## Timeline', '', ...r.timeline.byType.slice(0, 15).map(entry => `- ${entry.type}: ${entry.ms} ms (${entry.count})`), '',
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
