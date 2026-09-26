#!/usr/bin/env node
// `node tools/performance/ios-capture.mts`: record one moment of cssEarth in Safari on the booted iOS Simulator, with everything both sides expose.
//
//   node tools/performance/ios-capture.mts --name saturn-flight --steps steps.json [--open <url>] [--dist dist] [--udid <udid>]
//   node tools/performance/ios-capture.mts --name hand-drag --seconds 15        (record while someone uses the app)
//   node tools/performance/ios-capture.mts --device --name ipad-drag --open /jupiter/ --seconds 15
//
// --device [udid] records a real iPhone or iPad over USB instead of the simulator: turn on Settings > Apps > Safari >
// Advanced > Web Inspector, trust this Mac and keep the device unlocked with cssEarth open in Safari. The terminal says when a
// --seconds recording starts and ends. An --open path starting with /
// loads from this Mac's network address (--origin, default http://<en0 address>:4210, `pnpm dev`'s port); start the dev
// server on the network for it: `pnpm exec astro dev --host 0.0.0.0 --port 4210`.
// On a device, pymobiledevice3 (https://github.com/doronz88/pymobiledevice3; --pymobiledevice3 <path>, default from
// $PYMOBILEDEVICE3 or PATH) samples what Web Inspector cannot: the frames per second Core Animation delivers and the memory
// of Safari's web content processes. It needs Developer Mode on the device and the developer disk image mounted
// (`pymobiledevice3 mounter auto-mount`), and uses macOS's own device tunnel (no root).
// Every recording also logs the pointer input the page received (input.json). --replay <capture dir> plays it back: on a
// device as real touch (one finger), through device-touch.py and pymobiledevice3's Python, after three calibration taps on
// a transparent shield map page coordinates to the display; on the simulator as the same pointer events dispatched in the
// page at their recorded times (every finger; AXe's batch touch steps take about 190 ms each, too slow for a path). Either
// way the same hand plays both builds.
// Touch steps (tap, type, drag) need the simulator; on a device, script steps move the camera and screenshots come from
// Web Inspector (--inspector-screenshots does the same on the simulator: the page alone, without Safari's toolbars).
//
// Native side: an Instruments Time Profiler trace (`xcrun xctrace`) of the simulator's web content process holding the page
// (`--native page`, the default), of every process on the Mac (`--native all`, for compositor and GPU questions) or none
// (`--native off`), summarised for Safari's web content
// process. Page side, through Safari's Web Inspector (`ios_webkit_debug_proxy`): JavaScript samples for the page and each
// worker, named through the build's source maps; timeline records and rendering frames; CPU per thread; memory by
// category, sampled after collection before and after the moment; console messages and network requests.
// Steps drive the simulator with AXe (`brew install cameroncooke/axe/axe`), so input is real touch input.
// Output: output/performance/ios-captures/<name>-<time>/ with report.json, README.md, native.trace and screenshots.
// --compare <capture dir or name> pixelmatches each screenshot against the one of the same name in the (first) baseline (a
// visual change that should not show gives 0 differing pixels) and writes <name>.diff.png; the status-bar clock is pinned so
// it never differs. It also prints the before/after table (frames, work and compositing per frame, slow frames, layer
// memory, and on a device its frame rate and Safari's memory), from the means of every baseline capture of that name and of
// this command's --runs <n> repeats, and writes it to comparison.md in the last run.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, realpath, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import type { SourceMapConsumer } from 'source-map-js';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
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
  | { readonly probe: string }
  | { readonly layers: string; readonly selector?: string }
  | { readonly script: string };

const point = (value: unknown, label: string): [number, number] => {
  const list = requireArray(value, label);
  if (list.length !== 2) throw new TypeError(`${label} must be [x, y] in simulator points.`);
  return [requireFiniteNumber(list[0], label), requireFiniteNumber(list[1], label)];
};
/** Steps are external JSON: validate every one before anything records. */
export function parseSteps(value: unknown): Step[] {
  return requireArray(value, 'steps').map((input, index) => {
    const step = requireRecord(input, `step ${index}`), keys = Object.keys(step);
    // A layer snapshot may name the subtree it reads; every other step is exactly one action.
    if (keys.length !== 1 && !(keys.length === 2 && 'layers' in step && 'selector' in step)) throw new TypeError(`Step ${index} must have exactly one action.`);
    const label = `step ${index}`;
    if ('tap' in step) return { tap: point(step.tap, label) };
    if ('type' in step) return { type: requireString(step.type, label) };
    if ('wait' in step) return { wait: requireFiniteNumber(step.wait, label) };
    if ('script' in step) return { script: requireString(step.script, label) };
    if ('probe' in step) {
      const name = requireString(step.probe, label);
      if (!/^[a-z0-9-]+$/u.test(name)) throw new TypeError(`${label}: probe names are lowercase words and dashes.`);
      return { probe: name };
    }
    if ('layers' in step) {
      const name = requireString(step.layers, label);
      if (!/^[a-z0-9-]+$/u.test(name)) throw new TypeError(`${label}: layer snapshot names are lowercase words and dashes.`);
      return { layers: name, ...(step.selector === undefined ? {} : { selector: requireString(step.selector, label) }) };
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
  return { path: location.pathname, ready: read('ready') ?? document.body.classList.contains('ready'), activeObjectId: read('activeObjectId'), selectedObjectId: read('selectedObjectId'),
    overview: read('overview'), mountedObjectCount: read('mountedObjectCount'), lifecycle: read('lifecycle'),
    error: error ? String(error.message ?? error) : null, elements: document.getElementsByTagName('*').length };
})()`;

export type Target = { readonly kind: 'simulator' | 'device'; readonly udid: string };

/** Touch input comes from AXe, which drives only the simulator; a device is touched by hand or moved through script steps. */
export function requireStepsFor(target: Target, steps: readonly Step[]) {
  const touch = steps.find(step => 'tap' in step || 'type' in step || 'drag' in step);
  if (target.kind === 'device' && touch) throw new TypeError(`Step ${JSON.stringify(touch)} needs the simulator: on a device use --seconds and your hands, or script steps.`);
}

async function perform(steps: readonly Step[], target: Target, out: string, marks: { label: string; at: number; value?: unknown }[], started: number,
  evaluate: (expression: string) => Promise<unknown>, snapshotLayers?: (selector?: string) => Promise<unknown>, screenshot?: (file: string) => Promise<void>) {
  const udid = target.udid;
  for (const step of steps) {
    const label = JSON.stringify(step);
    const mark: { label: string; at: number; value?: unknown } = { label, at: Date.now() - started };
    marks.push(mark);
    // A scripted step changes the page to measure a change before it is prepared (a leaf's raster size, say). Its result
    // is recorded beside the step, so a capture says what it did.
    if ('script' in step) mark.value = await evaluate(step.script).catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
    else if ('probe' in step) mark.value = await evaluate(PROBE_EXPRESSION).catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
    // A layer snapshot mid-journey: which layers have repainted most so far, before the tree changes again.
    else if ('layers' in step) mark.value = snapshotLayers ? await snapshotLayers(step.selector).catch(error => ({ error: error instanceof Error ? error.message : String(error) })) : { error: 'no inspector' };
    else if ('tap' in step) await run('axe', ['tap', '-x', String(step.tap[0]), '-y', String(step.tap[1]), '--udid', udid]);
    else if ('type' in step) await run('axe', ['type', step.type, '--udid', udid]);
    else if ('wait' in step) await wait(step.wait * 1000);
    else if ('screenshot' in step) await (screenshot ? screenshot(resolve(out, `${step.screenshot}.png`)) : run('axe', ['screenshot', '--output', resolve(out, `${step.screenshot}.png`), '--udid', udid]));
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

/** The one iPhone or iPad on USB, unless --device names it, once it trusts this Mac. */
async function connectedDevice(udid: string | null) {
  // A failed command still says why; a missing one names its package.
  const said = (tool: string) => (error: unknown) => {
    if (isRecord(error) && error.code === 'ENOENT') throw new Error(`${tool} is not installed: brew install libimobiledevice.`);
    return { stdout: isRecord(error) ? [error.stdout, error.stderr].filter(text => typeof text === 'string').join(' ') : '' };
  };
  const { stdout } = await run('idevice_id', ['-l']).catch(said('idevice_id'));
  const devices = stdout.split('\n').map(line => line.trim()).filter(Boolean);
  if (udid && !devices.includes(udid)) throw new Error(`Device ${udid} is not on USB (connected: ${devices.join(', ') || 'none'}).`);
  if (!udid && devices.length === 0) throw new Error('No iPhone or iPad on USB: plug it in with a cable and unlock it.');
  if (!udid && devices.length > 1) throw new Error(`${devices.length} devices on USB (${devices.join(', ')}); pass --device <udid>.`);
  const chosen = udid ?? devices[0]!;
  // usbmuxd lists a device before it trusts this Mac; nothing else answers until it does.
  const pairing = await run('idevicepair', ['-u', chosen, 'validate']).catch(said('idevicepair'));
  if (!/SUCCESS/u.test(pairing.stdout)) throw new Error(`Device ${chosen} does not trust this Mac yet: unlock it, tap Trust on "Trust This Computer?" and enter its passcode (idevicepair: ${pairing.stdout.trim() || 'no answer'}).`);
  return chosen;
}

/** What the report says about a device: its name, model and system, read over USB. */
async function deviceInfo(udid: string) {
  const key = async (name: string) => (await run('ideviceinfo', ['-u', udid, '-k', name]).catch(() => ({ stdout: '' }))).stdout.trim() || null;
  return { name: await key('DeviceName'), model: await key('ProductType'), system: await key('ProductVersion') };
}

/** This Mac's address on the local network, for a device to reach the dev server. */
async function networkOrigin() {
  const { stdout } = await run('ipconfig', ['getifaddr', 'en0']).catch(() => ({ stdout: '' }));
  const address = stdout.trim();
  if (!address) throw new Error('This Mac has no en0 address; pass --origin http://<address>:<port>.');
  return `http://${address}:4210`;
}

/** The simulator's Web Inspector socket moves between boots; the live one is held open by that simulator's launchd_sim,
 * whose command line names its device, so with several simulators booted the capture attaches to `udid`'s own Safari. */
async function inspectorSocket(udid: string) {
  const { stdout } = await run('lsof', ['-c', 'launchd_sim', '-a', '-U', '-F', 'pn']).catch(() => ({ stdout: '' }));
  let pid = '';
  const sockets: { pid: string; path: string }[] = [];
  for (const line of stdout.split('\n')) {
    if (line.startsWith('p')) pid = line.slice(1);
    else if (line.startsWith('n') && line.endsWith('com.apple.webinspectord_sim.socket')) sockets.push({ pid, path: line.slice(1) });
  }
  for (const socket of sockets) {
    const { stdout: command } = await run('ps', ['-o', 'command=', '-p', socket.pid]).catch(() => ({ stdout: '' }));
    if (command.includes(`/Devices/${udid}/`)) return socket.path;
  }
  throw new Error(`No live Web Inspector socket for simulator ${udid} among ${sockets.length}; boot it and open Safari.`);
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
  throw new Error('No visible Safari tab; bring cssEarth to the front in Safari.');
}

/** Reuse a running proxy that lists pages; otherwise start one on the simulator's live socket, or over USB for a device.
 * Attaches to the visible tab. */
async function connectProxy(port: number, target: Target): Promise<{ page: { url: string; webSocketDebuggerUrl: string }; proxy: ChildProcess | null }> {
  const listed = await inspectorPages(port).catch(() => []);
  if (listed.length) {
    // A proxy left running for a simulator answers on the same port: a device capture reuses only its own device's proxy.
    const running = target.kind === 'device' ? (await run('ps', ['-Ao', 'args=']).catch(() => ({ stdout: '' }))).stdout.split('\n') : [];
    if (target.kind === 'device' && !running.some(line => line.includes('ios_webkit_debug_proxy') && line.includes(`${target.udid}:${port}`)))
      throw new Error(`Port ${port} already serves Web Inspector pages that are not device ${target.udid}'s (a simulator proxy?): stop it with pkill ios_webkit_debug_proxy, or pass --port <n>.`);
    return { page: await visiblePage(listed), proxy: null };
  }
  const proxy = spawn('ios_webkit_debug_proxy', target.kind === 'device' ? ['-c', `${target.udid}:${port}`]
    : ['-s', `unix:${await inspectorSocket(target.udid)}`, '-c', `null:${port - 1},:${port}-${port + 100}`], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 20; attempt++) {
    await wait(500);
    const pages = await inspectorPages(port).catch(() => []);
    if (pages.length) return { page: await visiblePage(pages), proxy };
  }
  proxy.kill();
  throw new Error(target.kind === 'device'
    ? `Device ${target.udid} shows no inspectable page: unlock it, turn on Web Inspector (Settings > Apps > Safari > Advanced) and open cssEarth in Safari.`
    : 'Safari shows no inspectable page; open cssEarth in the simulator first.');
}

// ---- Web Inspector session -----------------------------------------------------------------------------------------

type Message = Record<string, unknown>;
/** One inspector connection: the page target, plus each worker reached through the page's Worker domain. */
function inspector(socketUrl: string) {
  const socket = new WebSocket(socketUrl);
  let sequence = 0, pageTarget: string | null = null, swaps = 0;
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
      // A cross-site navigation (the Mac's dev server → https://css.earth) moves the page to a new web content process:
      // WebKit announces a provisional target, paused while an inspector is attached, and commits it in place of the old.
      if (outer.method === 'Target.targetCreated' && isRecord(params.targetInfo) && params.targetInfo.isPaused === true)
        socket.send(JSON.stringify({ id: ++sequence, method: 'Target.resume', params: { targetId: params.targetInfo.targetId } }));
      if (outer.method === 'Target.didCommitProvisionalTarget' && params.oldTargetId === pageTarget && typeof params.newTargetId === 'string') {
        pageTarget = params.newTargetId; swaps++; return;
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
  return { ready, send, listen: (listener: (source: string, message: Message) => void) => listeners.push(listener), close: () => socket.close(),
    /** How many times the page moved to a new process; its domains must then be enabled again. */
    swaps: () => swaps };
}

/** Waits until the page has loaded and the app reports itself ready or failed. The shell marks its own body, which is
 * what the site's other checks read; the diagnostics hook is only present in builds that publish it. Evaluations
 * during the navigation itself can fail; they count as not ready. */
async function waitForApp(session: ReturnType<typeof inspector>, timeoutMs = 120_000): Promise<void> {
  const expression = "document.readyState === 'complete' && (document.body.classList.contains('ready') || " +
    "document.body.classList.contains('error') || Boolean(window.__cssEarth && (window.__cssEarth.ready || window.__cssEarth.error)))";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reply = await session.send('Runtime.evaluate', { expression, returnByValue: true }).catch(() => null);
    if (reply && isRecord(reply.result) && isRecord(reply.result.result) && reply.result.result.value === true) return;
    await wait(500);
  }
  throw new Error(`The page did not report ready within ${timeoutMs / 1000} s.`);
}

/** The page's viewport as a PNG, through Web Inspector: a device has no simulator screenshot. */
async function snapshotViewport(session: ReturnType<typeof inspector>, file: string) {
  const size = await session.send('Runtime.evaluate', { expression: '[innerWidth, innerHeight]', returnByValue: true });
  const value = isRecord(size.result) && isRecord(size.result.result) ? size.result.result.value : null;
  const [width, height] = requireArray(value, 'viewport size').map(entry => requireFiniteNumber(entry, 'viewport size'));
  const reply = await session.send('Page.snapshotRect', { x: 0, y: 0, width, height, coordinateSystem: 'Viewport' });
  const url = isRecord(reply.result) ? reply.result.dataURL : null;
  if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) throw new Error(`Web Inspector returned no viewport snapshot: ${JSON.stringify(reply).slice(0, 200)}.`);
  await writeFile(file, Buffer.from(url.slice('data:image/png;base64,'.length), 'base64'));
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

/** Every compositing layer under the first element matching a selector, with its paint count, backing memory, bounds and
 * reasons. Two snapshots diffed by layerId give the repaint count of each layer over the interval. */
async function subtreeLayers(session: ReturnType<typeof inspector>, selector: string) {
  const documentReply = await session.send('DOM.getDocument');
  const rootNode = isRecord(documentReply.result) && isRecord(documentReply.result.root) ? documentReply.result.root.nodeId : null;
  if (typeof rootNode !== 'number') return { error: 'no document' };
  const found = await session.send('DOM.querySelector', { nodeId: rootNode, selector });
  const nodeId = isRecord(found.result) ? found.result.nodeId : null;
  if (typeof nodeId !== 'number' || nodeId === 0) return { selector, error: 'no such element' };
  await session.send('LayerTree.enable');
  const reply = await session.send('LayerTree.layersForNode', { nodeId });
  const layers = isRecord(reply.result) && Array.isArray(reply.result.layers) ? reply.result.layers.filter(isRecord) : [];
  const listed = [];
  for (const layer of layers.slice(0, 400)) {
    const why = await session.send('LayerTree.reasonsForCompositingLayer', { layerId: layer.layerId });
    const flags = isRecord(why.result) && isRecord(why.result.compositingReasons) ? why.result.compositingReasons : {};
    listed.push({ layerId: layer.layerId, nodeId: layer.nodeId ?? null, paintCount: typeof layer.paintCount === 'number' ? layer.paintCount : 0,
      memoryKb: Math.round((typeof layer.memory === 'number' ? layer.memory : 0) / 1024), bounds: layer.bounds ?? null,
      reasons: Object.entries(flags).filter(([, on]) => on === true).map(([reason]) => reason) });
  }
  await session.send('LayerTree.disable');
  return { selector, count: layers.length, listed: listed.length,
    memoryMb: Math.round(layers.reduce((sum, layer) => sum + (typeof layer.memory === 'number' ? layer.memory : 0), 0) / 1048576 * 10) / 10,
    paints: layers.reduce((sum, layer) => sum + (typeof layer.paintCount === 'number' ? layer.paintCount : 0), 0), layers: listed };
}

/** Composited layers: how many, their backing memory, and why the largest were composited. */
async function layerTree(session: ReturnType<typeof inspector>, options: { byMemory?: number; byPaints?: number; reasons?: boolean } = {}) {
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
  const byMemory = [...layers].sort((a, b) => memory(b) - memory(a)).slice(0, options.byMemory ?? 12);
  const byPaints = [...layers].sort((a, b) => paints(b) - paints(a)).filter(layer => !byMemory.includes(layer)).slice(0, options.byPaints ?? 8);
  const largest = [...byMemory, ...byPaints];
  // Reasons for a sample of layers across the list, so the count by reason describes the whole tree.
  const sample = options.reasons === false ? [] : layers.filter((_, index) => index % Math.max(1, Math.ceil(layers.length / 300)) === 0);
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

/** Stops a recording; xctrace has hung finalising, so after 120 s it is killed and the capture reports no native trace. */
async function stopRecording(xctrace: ChildProcess): Promise<boolean> {
  if (xctrace.exitCode !== null) return true;
  const exited = new Promise<boolean>(done => xctrace.once('exit', () => done(true)));
  xctrace.kill('SIGINT');
  const stopped = await Promise.race([exited, wait(120_000).then(() => false)]);
  if (!stopped) { xctrace.kill('SIGKILL'); await exited; }
  return stopped;
}

async function exportTimeProfile(native: string, pid: number | null): Promise<{ summary: ReturnType<typeof summariseTimeProfile> | { error: string }; samples: NativeSample[]; startMs: number | null }> {
  try {
    // Instruments may still be finishing the file when its recorder exits; the first export can then fail with no message.
    const exportTable = async (attempt = 1): Promise<string> => run('xcrun', ['xctrace', 'export', '--input', native, '--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]'], { maxBuffer: 2 ** 31 })
      .then(result => result.stdout, async (error: unknown) => { if (attempt >= 5) throw error; await wait(2000); return exportTable(attempt + 1); });
    const stdout = await exportTable();
    const toc = await run('xcrun', ['xctrace', 'export', '--input', native, '--toc'], { maxBuffer: 2 ** 26 }).then(result => result.stdout, () => '');
    const start = toc.match(/<start-date>([^<]+)<\/start-date>/u)?.[1];
    return { summary: summariseTimeProfile(stdout), samples: timeProfileSamples(stdout, pid), startMs: start ? Date.parse(start) : null };
  } catch (error) { return { summary: { error: error instanceof Error ? error.message.slice(0, 500) : String(error) }, samples: [], startMs: null }; }
}

export type NativeSample = { ns: number; weightNs: number; pid: number; thread: string; frames: string[] };

/** Every Time Profiler sample with its time from the recording start, its thread and its stack (leaf first), keeping one
 * process when pid is given. xctrace writes each repeated value once with an id and refers to it after (ref="…"). */
export function timeProfileSamples(xml: string, pid: number | null): NativeSample[] {
  const text = new Map<string, string>(), numbers = new Map<string, number>(), stacks = new Map<string, string[]>(), threads = new Map<string, { name: string; pid: number }>();
  const decode = (value: string) => value.replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, "'");
  const samples: NativeSample[] = [];
  for (const row of xml.split('<row>').slice(1)) {
    for (const m of row.matchAll(/<([\w-]+) id="(\d+)"(?: fmt="([^"]*)")?(?: name="([^"]*)")?[^>]*>(\d+)?/gu)) {
      text.set(m[2]!, decode(m[4] ?? m[3] ?? m[1]!)); if (m[5] !== undefined) numbers.set(m[2]!, Number(m[5]));
    }
    const ref = (tag: string) => { const m = row.match(new RegExp(`<${tag} (?:id|ref)="(\\d+)"`, 'u')); return m?.[1] ?? null; };
    const timeId = ref('sample-time'), weightId = ref('weight'), threadId = ref('thread'), backtraceId = ref('backtrace');
    if (threadId && !threads.has(threadId)) {
      const fmt = text.get(threadId) ?? '', owner = Number(fmt.match(/pid: (\d+)\)/u)?.[1] ?? NaN);
      threads.set(threadId, { name: fmt.replace(/ \(.*$/u, ''), pid: owner });
    }
    const thread = threadId ? threads.get(threadId) : undefined;
    if (!thread || (pid !== null && thread.pid !== pid)) continue;
    if (backtraceId && !stacks.has(backtraceId)) {
      const block = row.slice(row.indexOf('<backtrace'), row.indexOf('</backtrace>'));
      stacks.set(backtraceId, [...block.matchAll(/<frame (?:id="\d+" name="([^"]*)"|ref="(\d+)")/gu)].map(m => decode(m[1] ?? text.get(m[2]!) ?? '?')));
    }
    samples.push({ ns: numbers.get(timeId ?? '') ?? 0, weightNs: numbers.get(weightId ?? '') ?? 1e6, pid: thread.pid, thread: thread.name, frames: stacks.get(backtraceId ?? '') ?? [] });
  }
  return samples;
}

// ---- Input recording and replay -------------------------------------------------------------------------------------

/** Installed before a recording: every pointer event the page receives, and the camera each frame. */
// The camera is sampled every frame only while it can move: from any input until it has held still for 30 frames (the
// release inertia included). An endless requestAnimationFrame loop here made an idle page render 60 frames a second in
// every capture (2026-09-25, iPad: 314 of 315 idle frames were this loop).
const INPUT_LOGGER = `(() => {
  const t0 = performance.now(), pointers = [], camera = [];
  const record = event => { pointers.push([Math.round((performance.now() - t0) * 10) / 10, event.type, event.pointerId, event.pointerType, event.clientX, event.clientY]); wake(); };
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'], wakers = ['wheel', 'keydown'];
  let frame = 0, still = 0, last = '';
  const tick = now => {
    frame = 0;
    try { const id = window.__cssEarth && window.__cssEarth.activeObjectId, state = id && window['__' + id] && window['__' + id].camera.state();
      if (state) { const sample = [state.zoom, state.controlYaw, state.controlPitch], key = sample.join();
        still = key === last ? still + 1 : 0; last = key; if (!still) camera.push([Math.round((now - t0) * 10) / 10, ...sample]); }
      // A build without the camera hook (production) has nothing to follow: it counts as still, so the loop stops.
      else still++; } catch { still++; }
    if (still < 30) frame = requestAnimationFrame(tick);
  };
  function wake() { still = 0; if (!frame) frame = requestAnimationFrame(tick); }
  for (const type of types) addEventListener(type, record, { capture: true, passive: true });
  for (const type of wakers) addEventListener(type, wake, { capture: true, passive: true });
  wake();
  window.__captureInput = { stop() { cancelAnimationFrame(frame); for (const type of types) removeEventListener(type, record, { capture: true });
    for (const type of wakers) removeEventListener(type, wake, { capture: true });
    return { screen: [screen.width, screen.height], viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, orientation: screen.orientation ? screen.orientation.type : null, pointers, camera }; } };
  return true;
})()`;

/** "● REC n" at the top of the page, counting down the seconds of a hand recording; window.__captureBadge() removes it. */
const RECORDING_BADGE = (seconds: number) => `(() => {
  const badge = document.createElement('div'), end = performance.now() + ${seconds} * 1000;
  badge.dataset.captureOverlay = '';
  badge.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;' +
    'font:600 15px/1 system-ui;color:#fff;background:#c62828;padding:6px 12px;border-radius:14px';
  const show = () => { badge.textContent = '● REC ' + Math.max(0, Math.ceil((end - performance.now()) / 1000)); };
  show(); document.body.append(badge);
  const timer = setInterval(show, 1000);
  window.__captureBadge = () => { clearInterval(timer); badge.remove(); delete window.__captureBadge; };
  return true;
})()`;

/** Every attribute write and child insertion or removal the page makes while recording, from a MutationObserver: which
 * element, which inline properties, attributes or children changed, and whether the camera was moving at that moment
 * (drag and coast announce objectrotationchange, the motion signal objectmotionchange; production builds before that
 * signal get a wheel counted as moving for 700 ms). The invariant is judged on the moving writes. Aggregated in the page
 * (one entry per element and change) so a coasting globe does not ship megabytes; the capture's own badge is ignored. */
export const STYLE_WRITES_LOGGER = `(() => {
  const t0 = performance.now(), entries = new Map(), perFrame = [];
  let frameWrites = 0, frameMoving = 0, frameStart = t0, announced = false, coasting = false, wheelUntil = 0;
  const moving = () => announced || performance.now() < wheelUntil;
  // objectmotionchange also says whether the camera coasts on inertia, the only motion the contract gates.
  const onMotion = event => { announced = Boolean(event.detail && event.detail.active); if (event.type === 'objectmotionchange') coasting = Boolean(event.detail && event.detail.coasting); };
  const onWheel = () => { wheelUntil = performance.now() + 700; };
  for (const type of ['objectrotationchange', 'objectmotionchange']) document.addEventListener(type, onMotion, true);
  addEventListener('wheel', onWheel, { capture: true, passive: true });
  const describe = element => {
    let text = element.localName;
    if (element.id) text += '#' + element.id;
    for (const name of [...element.classList].slice(0, 3)) text += '.' + name;
    for (const attribute of element.attributes) if (attribute.name.startsWith('data-') && text.length < 120) text += '[' + attribute.name + ']';
    return text;
  };
  const parse = text => { const map = new Map(); for (const part of (text || '').split(';')) { const i = part.indexOf(':'); if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); } return map; };
  const bump = (key, value, at, inMotion) => {
    const entry = entries.get(key) || { key, count: 0, moving: 0, coasting: 0, first: at, last: at, value: '' };
    entry.count++; if (inMotion) entry.moving++; if (coasting) entry.coasting++; entry.last = at; entry.value = String(value).slice(0, 160); entries.set(key, entry);
    frameWrites++; if (inMotion) frameMoving++;
  };
  const ours = node => node.nodeType === 1 ? Boolean(node.closest('[data-capture-overlay]')) : Boolean(node.parentElement && node.parentElement.closest('[data-capture-overlay]'));
  const observer = new MutationObserver(records => {
    const at = Math.round((performance.now() - t0) * 10) / 10, inMotion = moving();
    for (const record of records) {
      const element = record.target;
      if (ours(element)) continue;
      const who = describe(element.nodeType === 1 ? element : element.parentElement || document.documentElement);
      if (record.type === 'childList') {
        for (const node of record.addedNodes) if (!ours(node)) bump(who + ' <+' + (node.localName || '#text') + '>', '', at, inMotion);
        for (const node of record.removedNodes) bump(who + ' <-' + (node.localName || '#text') + '>', '', at, inMotion);
        continue;
      }
      const name = record.attributeName;
      if (name === 'style') {
        const before = parse(record.oldValue), after = parse(element.getAttribute('style'));
        for (const [property, value] of after) if (before.get(property) !== value) bump(who + ' { ' + property + ' }', value, at, inMotion);
        for (const property of before.keys()) if (!after.has(property)) bump(who + ' { ' + property + ' } removed', '', at, inMotion);
      } else if (record.oldValue !== element.getAttribute(name)) bump(who + ' [' + name + ']', element.getAttribute(name), at, inMotion);
    }
  });
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true, childList: true });
  let frame = requestAnimationFrame(function tick(now) {
    if (frameWrites) perFrame.push([Math.round((frameStart - t0) * 10) / 10, frameWrites, frameMoving]);
    frameWrites = frameMoving = 0; frameStart = now; frame = requestAnimationFrame(tick);
  });
  window.__captureStyles = { stop() {
    observer.disconnect(); cancelAnimationFrame(frame);
    for (const type of ['objectrotationchange', 'objectmotionchange']) document.removeEventListener(type, onMotion, true);
    removeEventListener('wheel', onWheel, { capture: true });
    return { entries: [...entries.values()].sort((a, b) => b.moving - a.moving || b.count - a.count), perFrame };
  } };
  return true;
})()`;

/** A transparent shield over the page for calibration taps: they land on it, not on the app, and it keeps where they landed. */
const CALIBRATION_SHIELD = `(() => { const shield = document.createElement('div'), hits = [];
  shield.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent;touch-action:none';
  shield.addEventListener('pointerdown', event => { event.stopPropagation(); event.preventDefault(); hits.push([event.clientX, event.clientY]); });
  document.body.append(shield); window.__calibration = { hits, remove() { shield.remove(); return hits; } }; return true; })()`;

/** Calibration taps in the HID service's 0..65535 display coordinates: central enough to land on the page in either orientation. */
export const CALIBRATION_POINTS: readonly (readonly [number, number])[] = [[22938, 29491], [42598, 29491], [32768, 39322]];

export type Affine = readonly [number, number, number, number, number, number];
/** The affine map from page coordinates to display coordinates that takes each calibration hit to its tap. */
export function solveAffine(pairs: readonly { page: readonly [number, number]; display: readonly [number, number] }[]): Affine {
  if (pairs.length !== 3) throw new RangeError(`Calibration needs 3 taps, the page saw ${pairs.length}.`);
  const [[x1, y1], [x2, y2], [x3, y3]] = pairs.map(pair => pair.page);
  const det = x1! * (y2! - y3!) - x2! * (y1! - y3!) + x3! * (y1! - y2!);
  if (Math.abs(det) < 1e-6) throw new RangeError('Calibration taps landed in a line; the page may not have received them.');
  const solve = (v1: number, v2: number, v3: number) => [
    (v1 * (y2! - y3!) - v2 * (y1! - y3!) + v3 * (y1! - y2!)) / det,
    (x1! * (v2 - v3) - x2! * (v1 - v3) + x3! * (v1 - v2)) / det,
    (x1! * (y2! * v3 - y3! * v2) - x2! * (y1! * v3 - y3! * v1) + x3! * (y1! * v2 - y2! * v1)) / det] as const;
  const [a, b, c] = solve(...pairs.map(pair => pair.display[0]) as [number, number, number]);
  const [d, e, f] = solve(...pairs.map(pair => pair.display[1]) as [number, number, number]);
  return [a, b, c, d, e, f];
}

/** A recording's touch path as timed contacts for device-touch.py: one finger, the first down at any moment; the times
 * start at the first touch. Other simultaneous fingers are counted, not played. */
export function touchPlan(input: unknown, affine: Affine) {
  const pointers = requireArray(requireRecord(input, 'input recording').pointers, 'pointer events').map(entry => requireArray(entry, 'pointer event'));
  const events: [number, 'contact' | 'release', number, number][] = [], skipped = new Set<number>();
  const clamp = (value: number) => Math.max(0, Math.min(65535, Math.round(value)));
  let active: number | null = null, start: number | null = null;
  for (const [at, type, id, pointerType, x, y] of pointers) {
    if (pointerType !== 'touch' || typeof at !== 'number' || typeof id !== 'number' || typeof x !== 'number' || typeof y !== 'number') continue;
    if (type === 'pointerdown' && active === null) active = id;
    if (id !== active) { if (type === 'pointerdown') skipped.add(id); continue; }
    start ??= at;
    const display: [number, number] = [clamp(affine[0] * x + affine[1] * y + affine[2]), clamp(affine[3] * x + affine[4] * y + affine[5])];
    const released = type === 'pointerup' || type === 'pointercancel';
    events.push([Math.round((at - start) * 10) / 10, released ? 'release' : 'contact', ...display]);
    if (released) active = null;
  }
  return { events, skippedFingers: skipped.size };
}

/** The simulator's replay: the recorded pointer events dispatched at their recorded times to whatever is under each point,
 * as the browser's hit test would. Pointer capture accepts the replayed ids, which the browser refuses for dispatched events;
 * the page otherwise handles them as its own input. Coordinates scale if the viewport differs from the recording's. */
export function pageReplayExpression(input: unknown) {
  const record = requireRecord(input, 'input recording'), [width, height] = requireArray(record.viewport, 'recorded viewport').map(value => requireFiniteNumber(value, 'viewport'));
  const pointers = requireArray(record.pointers, 'pointer events');
  return `new Promise(done => {
  const pointers = ${JSON.stringify(pointers)}, sx = innerWidth / ${width}, sy = innerHeight / ${height}, replayed = new Set(), targets = new Map();
  const proto = Element.prototype, set = proto.setPointerCapture, release = proto.releasePointerCapture, has = proto.hasPointerCapture;
  proto.setPointerCapture = function (id) { if (replayed.has(id)) { targets.set(id, this); return; } return set.call(this, id); };
  proto.releasePointerCapture = function (id) { if (replayed.has(id)) { targets.delete(id); return; } return release.call(this, id); };
  proto.hasPointerCapture = function (id) { return replayed.has(id) ? targets.get(id) === this : has.call(this, id); };
  const start = performance.now(), first = pointers.length ? pointers[0][0] : 0;
  let index = 0, sent = 0;
  const step = () => {
    const now = performance.now() - start;
    while (index < pointers.length && pointers[index][0] - first <= now) {
      const [, type, id, pointerType, x, y] = pointers[index++], clientX = x * sx, clientY = y * sy, down = type === 'pointerdown';
      replayed.add(id);
      const target = targets.get(id) || document.elementFromPoint(clientX, clientY) || document.body;
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType, isPrimary: true,
        clientX, clientY, screenX: clientX, screenY: clientY, button: down || type === 'pointerup' ? 0 : -1, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        pressure: type === 'pointerup' ? 0 : 0.5, width: 1, height: 1 }));
      if (type === 'pointerup' || type === 'pointercancel') targets.delete(id);
      sent++;
    }
    if (index < pointers.length) requestAnimationFrame(step);
    else { proto.setPointerCapture = set; proto.releasePointerCapture = release; proto.hasPointerCapture = has; done(sent); }
  };
  requestAnimationFrame(step);
})`;
}

/** What the device samplers and touch replay need, named when one of them fails. */
const DEVELOPER_SERVICES = 'pymobiledevice3 (--pymobiledevice3 <path> or $PYMOBILEDEVICE3) needs Developer Mode on the device ' +
  '(Settings > Privacy & Security, then restart) and the developer disk image mounted (pymobiledevice3 mounter auto-mount); it opens macOS\'s device tunnel itself, without root.';

/** pymobiledevice3's own Python, beside its command. */
async function bridgePython(binary: string) {
  const path = binary.includes('/') ? binary : (await run('which', [binary]).catch(() => ({ stdout: '' }))).stdout.trim();
  if (!path) throw new Error(`${binary} is not installed; pip install pymobiledevice3 or pass --pymobiledevice3 <path>.`);
  return resolve(await realpath(path).then(real => real, () => path), '..', 'python');
}

/** Runs a contact plan on the device and waits for it to finish. */
async function playTouches(binary: string, udid: string, events: readonly unknown[], planFile: string) {
  await writeFile(planFile, JSON.stringify({ events }) + '\n');
  const python = await bridgePython(binary);
  const child = spawn(python, [resolve(import.meta.dirname, 'device-touch.py'), planFile], { env: { ...process.env, PYMOBILEDEVICE3_UDID: udid, PYMOBILEDEVICE3_NATIVE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const errors: string[] = []; let sent = 0;
  child.stdout?.on('data', chunk => { sent += String(chunk).split('\n').filter(Boolean).length; });
  child.stderr?.on('data', chunk => errors.push(String(chunk)));
  const code = await new Promise<number | null>(done => { child.on('exit', done); child.on('error', () => done(-1)); });
  if (code !== 0) throw new Error(`device-touch.py exited ${code}: ${errors.join('').slice(-600)}\n${DEVELOPER_SERVICES}`);
  return sent;
}

// ---- Comparison ----------------------------------------------------------------------------------------------------

/** The captures a --compare names: one capture directory, or every capture whose name is that name plus its timestamp. */
export async function baselineCaptures(compare: string, capturesRoot = resolve(root, 'output/performance/ios-captures')) {
  const direct = resolve(compare);
  if (await readFile(resolve(direct, 'report.json')).then(() => true, () => false)) return [direct];
  const name = compare.replace(/\/+$/u, '').split('/').pop() ?? compare;
  const dirs = (await readdir(capturesRoot).catch(() => [] as string[])).filter(entry => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}-\\d{4}-\\d{2}-\\d{2}T`, 'u').test(entry)).sort();
  const complete: string[] = [];
  for (const entry of dirs) if (await readFile(resolve(capturesRoot, entry, 'report.json')).then(() => true, () => false)) complete.push(resolve(capturesRoot, entry));
  if (!complete.length) throw new Error(`--compare ${compare}: no capture directory or captures named ${name}-<time> with a report.`);
  return complete;
}

const COMPARED = [
  ['Frames delivered', 'frames', 'more'],
  ['Work per frame (ms)', 'workPerFrameMs', 'less'],
  ['Compositing per frame (ms)', 'compositePerFrameMs', 'less'],
  ['Frames over 16.7 ms', 'over16', 'less'],
  ['Frames over 50 ms', 'over50', 'less'],
  ['Longest frame (ms)', 'longestMs', 'less'],
  ['Style recalculation (ms)', 'styleMs', 'less'],
  ['Paint (ms)', 'paintMs', 'less'],
  ['Layer memory (MB)', 'layersMb', 'less'],
  ['Layers', 'layers', 'less'],
  ['Device frames per second', 'deviceFps', 'more'],
  ['Safari web content footprint, peak (MB)', 'webContentMb', 'less'],
] as const;
type MetricKey = typeof COMPARED[number][1];

/** The numbers one capture is compared by. Device fields are null on the simulator. */
export function captureMetrics(report: unknown): Record<MetricKey, number | null> {
  const r = requireRecord(report, 'capture report'), timeline = requireRecord(r.timeline, 'timeline'), frames = requireRecord(timeline.renderingFrames, 'rendering frames');
  const count = requireFiniteNumber(frames.count, 'frame count'), byType = requireArray(timeline.byType, 'timeline types').map(entry => requireRecord(entry, 'timeline type'));
  const type = (name: string) => { const entry = byType.find(item => item.type === name); return entry ? requireFiniteNumber(entry.ms, name) : 0; };
  const layers = isRecord(r.layers) && typeof r.layers.memoryMb === 'number' ? r.layers : null;
  const device = isRecord(r.deviceMetrics) ? r.deviceMetrics : null;
  const graphics = device && isRecord(device.graphics) ? device.graphics : null;
  const fpsKey = graphics ? Object.keys(graphics).find(key => /FramesPerSecond|fps/iu.test(key)) : undefined;
  const fps = graphics && fpsKey && isRecord(graphics[fpsKey]) ? graphics[fpsKey].mean : null;
  const web = device && isRecord(device.webContent) && isRecord(device.webContent.footprintMb) ? device.webContent.footprintMb.max : null;
  return {
    frames: count, workPerFrameMs: count ? requireFiniteNumber(frames.totalMs, 'frame work') / count : null, compositePerFrameMs: count ? type('Composite') / count : null,
    over16: requireFiniteNumber(frames.over16ms, 'frames over 16 ms'), over50: requireFiniteNumber(frames.over50ms, 'frames over 50 ms'), longestMs: requireFiniteNumber(frames.longestMs, 'longest frame'),
    styleMs: type('RecalculateStyles'), paintMs: type('Paint'),
    layersMb: layers ? Number(layers.memoryMb) : null, layers: layers && typeof layers.count === 'number' ? layers.count : null,
    deviceFps: typeof fps === 'number' ? fps : null, webContentMb: typeof web === 'number' ? web : null,
  };
}

/** Means of each metric over the baseline runs and the current runs, with the change and which way is better. */
export function compareCaptures(before: readonly Record<MetricKey, number | null>[], after: readonly Record<MetricKey, number | null>[]) {
  const mean = (runs: readonly Record<MetricKey, number | null>[], key: MetricKey) => {
    const values = runs.map(run => run[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  return COMPARED.flatMap(([label, key, better]) => {
    const a = mean(before, key), b = mean(after, key);
    if (a === null || b === null) return [];
    const change = a === 0 ? null : (b - a) / a * 100;
    const verdict = change === null || Math.abs(change) < 2 ? 'same' : (change < 0) === (better === 'less') ? 'better' : 'worse';
    return [{ label, before: a, after: b, change, verdict }];
  });
}

export function formatComparison(rows: ReturnType<typeof compareCaptures>, runs: { before: number; after: number }, pixels: readonly { name: string; differing: number | null; total: number | null }[] = []) {
  const number = (value: number) => Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return [`| Mean of ${runs.before} before / ${runs.after} after runs | Before | After | Change |`, '|---|---|---|---|',
    ...rows.map(row => `| ${row.label} | ${number(row.before)} | ${number(row.after)} | ${row.change === null ? '' : `${row.change > 0 ? '+' : ''}${row.change.toFixed(0)}%`} ${row.verdict} |`),
    ...(pixels.length ? ['', 'Pixelmatch (threshold 0.1) against the first baseline:', ...pixels.map(shot => shot.differing === null ? `- ${shot.name}: no baseline screenshot` : `- ${shot.name}: ${shot.differing} of ${shot.total} pixels differ`)] : []),
    ''].join('\n');
}

// ---- Capture -------------------------------------------------------------------------------------------------------

export function options(args: readonly string[]) {
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] ?? null : null; };
  // --device takes an optional udid: the next argument when it is not another flag.
  const deviceIndex = args.indexOf('--device'), deviceValue = deviceIndex >= 0 ? args[deviceIndex + 1] : undefined;
  const device = deviceIndex < 0 ? null : { udid: deviceValue && !deviceValue.startsWith('--') ? deviceValue : null };
  const name = value('--name');
  if (!name || !/^[a-z0-9-]+$/u.test(name)) throw new TypeError('Pass --name <lowercase-words-and-dashes>.');
  const stepsFile = value('--steps'), seconds = value('--seconds'), replay = value('--replay');
  if ([stepsFile, seconds, replay].filter(Boolean).length !== 1) throw new TypeError('Pass one of --steps <file.json>, --seconds <n> or --replay <capture dir>.');
  return { name, stepsFile, replay, seconds: seconds === null ? null : requireFiniteNumber(Number(seconds), '--seconds'),
    dist: value('--dist') ?? 'dist', udid: value('--udid'), port: Number(value('--port') ?? 9222), profile: value('--template') ?? 'Time Profiler',
    open: value('--open'), origin: value('--origin'), inspectorScreenshots: Boolean(device) || args.includes('--inspector-screenshots'), settle: Number(value('--settle') ?? 12), noCache: args.includes('--no-cache'), eval: value('--eval'), tail: Number(value('--tail') ?? 6), jsSamples: !args.includes('--no-js-samples'), styleWrites: args.includes('--style-writes'), screens: args.includes('--screens'), compare: value('--compare'), device,
    // A device's web content process is not reachable by pid from the Mac; record it with --native all, or not at all.
    native: nativeMode(value('--native') ?? (device ? 'off' : 'page')), pymobiledevice3: value('--pymobiledevice3') ?? process.env.PYMOBILEDEVICE3 ?? 'pymobiledevice3' };
}

/** Every top-level JSON object or array in pymobiledevice3's output, which prints them indented over many lines between
 * plain log lines such as "Monitoring pid=459, ppid=1, name=com.apple.WebKit.WebContent". */
export function jsonValues(text: string): unknown[] { return jsonSpans(text).map(span => span.value); }

/** jsonValues with the offset just past each value, so a streamed sample can take the time its last byte arrived. */
function jsonSpans(text: string): { value: unknown; end: number }[] {
  const values: { value: unknown; end: number }[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"' && depth > 0) inString = true;
    else if (char === '{' || char === '[') { if (depth++ === 0) start = index; }
    else if ((char === '}' || char === ']') && depth > 0 && --depth === 0) { try { values.push({ value: JSON.parse(text.slice(start, index + 1)), end: index + 1 }); } catch { /* a log line's brackets */ } }
  }
  return values;
}

/** One pymobiledevice3 sampler writing its samples as JSON lines beside the capture. A sampler that cannot start reports
 * its error; the capture goes on without it. */
function deviceSampler(binary: string, udid: string, args: readonly string[], file: string) {
  let text = '';
  const errors: string[] = [], arrivals: { end: number; at: number }[] = [];
  const child = spawn(binary, args, { env: deviceEnv(udid), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', chunk => { text += String(chunk); arrivals.push({ end: text.length, at: Date.now() }); });
  child.stderr?.on('data', chunk => errors.push(String(chunk)));
  const failed = new Promise<string>(done => child.on('error', error => done(error.message)));
  return {
    async stop() {
      const exited = child.exitCode !== null;
      child.kill('SIGINT');
      const spawnError = await Promise.race([failed, wait(200).then(() => null)]);
      // receivedAt: when the Mac read the sample, for samplers (graphics) that carry no time of their own.
      const receivedAt = (end: number) => arrivals.find(arrival => arrival.end >= end)?.at ?? Date.now();
      const samples = jsonSpans(text).flatMap(({ value, end }) => (Array.isArray(value) ? value : [value]).map(sample => isRecord(sample) ? { ...sample, receivedAt: receivedAt(end) } : sample));
      await writeFile(file, samples.map(sample => JSON.stringify(sample)).join('\n') + (samples.length ? '\n' : ''));
      const error = exited && !samples.length ? errors.join('').slice(-500) || `exited with ${child.exitCode}` : null;
      return { samples, error: spawnError ?? error ?? (samples.length ? null : errors.join('').slice(-500) || 'no samples') };
    },
  };
}

// PYTHONUNBUFFERED: pymobiledevice3 is Python, which holds piped output in an 8 KB buffer; half-second samples then arrive
// only in bursts or at exit, after the capture stopped listening (empty memory samples in some takes, 2026-09-26).
const deviceEnv = (udid: string) => ({ ...process.env, PYMOBILEDEVICE3_UDID: udid, PYMOBILEDEVICE3_NATIVE: '1', PYTHONUNBUFFERED: '1' });

/** On a device, the web content process holding the page: the one running, then the largest. Safari keeps a prewarmed
 * spare of a few MB, and after a cross-site navigation the previous page waits suspended in the back-forward cache
 * (2026-09-26 on the iPad: css.earth 250 MB at 1.1% CPU, the suspended dev page 447 MB at 0.2%, the spare 7 MB at 0%). */
export function devicePageProcess(samples: readonly unknown[]): number | null {
  let best: { pid: number; cpu: number; footprint: number } | null = null;
  for (const sample of samples) {
    if (!isRecord(sample) || typeof sample.pid !== 'number' || typeof sample.physFootprint !== 'number') continue;
    const cpu = typeof sample.cpuUsage === 'number' ? sample.cpuUsage : 0, footprint = sample.physFootprint;
    if (!best || cpu > best.cpu || (cpu === best.cpu && footprint > best.footprint)) best = { pid: sample.pid, cpu, footprint };
  }
  return best?.pid ?? null;
}

/** The capture as a Trace Event file (the JSON Perfetto and jankmonster load): WebKit's timeline records as slices on the
 * page's main thread, under WebKit's own names, and the device's samples as counters. Timeline times count seconds from
 * Page.enable (the inspector stopwatch), so device samples align through the Mac time Page.enable was sent. */
export function traceEvents(records: readonly unknown[], stopwatchEpochMs: number,
  device: { graphics: readonly unknown[]; webContent: readonly unknown[] } | null, metadata: Record<string, unknown>,
  cpu: { updates: readonly unknown[]; workers: ReadonlyMap<string, string> } = { updates: [], workers: new Map() },
  native: { samples: readonly NativeSample[]; offsetUs: number } | null = null) {
  const events: Record<string, unknown>[] = [
    { ph: 'M', name: 'process_name', pid: 1, tid: 1, args: { name: 'Safari web content (page)' } },
    { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'WebKit timeline' } },
  ];
  const micros = (seconds: number) => Math.round(seconds * 1e6);
  const visit = (record: unknown) => {
    if (!isRecord(record) || typeof record.type !== 'string' || typeof record.startTime !== 'number') return;
    const ts = micros(record.startTime), data = isRecord(record.data) ? record.data : {};
    if (typeof record.endTime === 'number') events.push({ ph: 'X', name: record.type, cat: 'webkit.timeline', pid: 1, tid: 1, ts, dur: Math.max(0, micros(record.endTime) - ts), args: { data } });
    else events.push({ ph: 'i', s: 't', name: record.type, cat: 'webkit.timeline', pid: 1, tid: 1, ts, args: { data } });
    if (Array.isArray(record.children)) record.children.forEach(visit);
  };
  records.forEach(visit);
  // WebKit's CPU profiler, every 500 ms: one counter track per thread ("CPU % Main Thread", "CPU % worker …"), so a
  // stretch where the timeline shows no work still shows which thread was busy.
  for (const update of cpu.updates) {
    if (!isRecord(update) || typeof update.timestamp !== 'number') continue;
    const threads: Record<string, number> = { total: typeof update.usage === 'number' ? Math.round(update.usage * 10) / 10 : 0 };
    for (const thread of Array.isArray(update.threads) ? update.threads : []) {
      if (!isRecord(thread) || typeof thread.usage !== 'number') continue;
      const target = typeof thread.targetId === 'string' ? cpu.workers.get(thread.targetId) ?? thread.targetId : null;
      const label = target ? `worker ${target.split('?')[0]}` : typeof thread.name === 'string' && thread.name ? thread.name : 'unnamed thread';
      threads[label] = Math.round(((threads[label] ?? 0) + thread.usage) * 10) / 10;
    }
    events.push({ ph: 'C', name: 'CPU %', pid: 1, tid: 1, ts: micros(update.timestamp), args: threads });
  }
  // Instruments' native samples of the page's process, one slice per sample on its own thread's track, named by the
  // leaf frame with the stack in args: what WebKit did when its timeline records nothing.
  if (native?.samples.length) {
    events.push({ ph: 'M', name: 'process_name', pid: 3, tid: 0, args: { name: 'Page process native stacks (Instruments)' } });
    const tids = new Map<string, number>(), next = new Map<NativeSample, number>(), last = new Map<string, NativeSample>();
    // A sample is drawn until the next one on its thread at most: samples closer than their 1 ms weight would overlap,
    // and Perfetto drops overlapping slices ("slice_drop_overlapping_complete_event", 17 in one take).
    for (const sample of [...native.samples].sort((a, b) => a.ns - b.ns)) {
      const previous = last.get(sample.thread);
      if (previous) next.set(previous, sample.ns);
      last.set(sample.thread, sample);
    }
    for (const sample of native.samples) {
      if (!tids.has(sample.thread)) { tids.set(sample.thread, tids.size + 1); events.push({ ph: 'M', name: 'thread_name', pid: 3, tid: tids.get(sample.thread), args: { name: sample.thread } }); }
      const ts = Math.round(native.offsetUs + sample.ns / 1e3), end = Math.round(native.offsetUs + Math.min(sample.ns + sample.weightNs, next.get(sample) ?? Infinity) / 1e3);
      events.push({ ph: 'X', name: sample.frames[0] ?? '?', cat: 'native', pid: 3, tid: tids.get(sample.thread), ts, dur: Math.max(0, end - ts),
        args: { stack: sample.frames.slice(0, 40).join(' < '), weightMs: sample.weightNs / 1e6 } });
    }
  }
  if (device) {
    events.push({ ph: 'M', name: 'process_name', pid: 2, tid: 1, args: { name: 'Device (USB)' } });
    const at = (ms: number) => Math.round((ms - stopwatchEpochMs) * 1e3);
    for (const sample of device.graphics) {
      if (!isRecord(sample) || typeof sample.receivedAt !== 'number') continue;
      const ts = at(sample.receivedAt), number = (key: string) => typeof sample[key] === 'number' ? sample[key] : 0;
      events.push({ ph: 'C', name: 'Core Animation', pid: 2, tid: 1, ts, args: { fps: number('CoreAnimationFramesPerSecond') } });
      events.push({ ph: 'C', name: 'GPU utilisation %', pid: 2, tid: 1, ts, args: { device: number('Device Utilization %'), renderer: number('Renderer Utilization %'), tiler: number('Tiler Utilization %') } });
    }
    for (const sample of device.webContent) {
      if (!isRecord(sample) || typeof sample.timestamp !== 'string') continue;
      const ts = at(Date.parse(sample.timestamp));
      // Perfetto names each counter track "<name> <arg>": "Page process footprint MB", "Page process CPU %".
      if (typeof sample.physFootprint === 'number') events.push({ ph: 'C', name: 'Page process', pid: 2, tid: 1, ts, args: { 'footprint MB': Math.round(sample.physFootprint / 104857.6) / 10 } });
      if (typeof sample.cpuUsage === 'number') events.push({ ph: 'C', name: 'Page process', pid: 2, tid: 1, ts, args: { 'CPU %': Math.round(sample.cpuUsage * 10) / 10 } });
    }
  }
  return { traceEvents: events, displayTimeUnit: 'ms', metadata: { source: 'cssearth-ios-capture', stopwatchEpochMs, ...metadata } };
}

/** Mean, lowest and highest of every numeric field across samples: the graphics sampler's fields are the device's own. */
export function summariseNumericSamples(samples: readonly unknown[]) {
  const fields = new Map<string, number[]>();
  for (const sample of samples) {
    if (!isRecord(sample)) continue;
    for (const [key, value] of Object.entries(sample)) if (typeof value === 'number' && Number.isFinite(value)) fields.set(key, [...(fields.get(key) ?? []), value]);
  }
  const round = (value: number) => Math.round(value * 10) / 10;
  return Object.fromEntries([...fields].map(([key, values]) => [key, { mean: round(values.reduce((sum, value) => sum + value, 0) / values.length), min: round(Math.min(...values)), max: round(Math.max(...values)), count: values.length }]));
}

/** The device-side samplers of one recording: frames per second from the graphics instrument, and the memory footprint of
 * the Safari web content process holding the page from sysmon, every half second. */
/** The device's web content process holding the page, from one sysmon snapshot; null when sysmon cannot answer. */
async function deviceWebContentPid(binary: string, udid: string) {
  const snapshot = await run(binary, ['developer', 'dvt', 'sysmon', 'process', 'single', '-f', 'name=com.apple.WebKit.WebContent', '-k', 'pid', '-k', 'physFootprint', '-k', 'cpuUsage'],
    { env: deviceEnv(udid) }).then(result => jsonValues(result.stdout).flatMap(value => Array.isArray(value) ? value : [value]), () => []);
  return devicePageProcess(snapshot);
}

// The grabber runs pymobiledevice3's own Python API in its own interpreter: the command line has no streaming screenshot
// and reopens the developer tunnel for each grab (about 1 s a grab), where one open channel answers about 4.6 a second.
const SCREEN_GRABBER = `
import asyncio, os, sys, time
from pymobiledevice3.remote.native_tunnel import NativeRemotedTunnel
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot
async def main(out, udid):
    async with NativeRemotedTunnel(serial=udid) as rsd, DvtProvider(rsd) as dvt, Screenshot(dvt) as shot:
        print('grabbing', flush=True)
        while True:
            start = time.time(); data = await shot.get_screenshot(); at = round((start + time.time()) * 500)
            open(f'{out}/{at}.tmp', 'wb').write(data); os.replace(f'{out}/{at}.tmp', f'{out}/{at}.png')
try: asyncio.run(main(sys.argv[1], sys.argv[2]))
except KeyboardInterrupt: pass
`;

/** --screens: the iPad's own screen during the recording, as screens/<epoch ms>.jpg (the middle of each grab's request),
 * for the DevTools filmstrip. Grabbing costs the page frames (Core Animation 58 → 44 fps on the replayed Earth flick,
 * 2026-09-26), so timing takes leave it off. */
async function deviceScreens(binary: string, udid: string, out: string) {
  const dir = resolve(out, 'screens');
  await mkdir(dir, { recursive: true });
  const executable = binary.includes('/') ? binary : (await run('which', [binary])).stdout.trim();
  const python = (await readFile(await realpath(executable), 'utf8')).split('\n', 1)[0]!.replace(/^#!\s*/u, '').trim();
  const errors: string[] = [];
  const child = spawn(python, ['-c', SCREEN_GRABBER, dir, udid], { env: deviceEnv(udid), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr?.on('data', chunk => errors.push(String(chunk)));
  const ready = new Promise<boolean>(done => { child.stdout?.on('data', () => done(true)); child.once('exit', () => done(false)); });
  if (!await Promise.race([ready, wait(15_000).then(() => false)])) console.error(`No screen grabs (${errors.join('').trim().split('\n').at(-1) ?? 'no answer in 15 s'}).`);
  return {
    async stop() {
      const exited = new Promise<void>(done => child.exitCode !== null ? done() : child.once('exit', () => done()));
      child.kill('SIGINT');
      await Promise.race([exited, wait(5000).then(() => { child.kill('SIGKILL'); })]);
      const shots = (await readdir(dir)).filter(file => file.endsWith('.png'));
      // A full-resolution PNG is about 2 MB; the filmstrip needs a glance, so 1280 px JPEGs at quality 75.
      for (const file of shots) {
        await sharp(resolve(dir, file)).resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 75 }).toFile(resolve(dir, file.replace(/\.png$/u, '.jpg')));
        await rm(resolve(dir, file));
      }
      return shots.length;
    },
  };
}

async function deviceMonitors(binary: string, udid: string, out: string, pid: number | null) {
  const graphics = deviceSampler(binary, udid, ['developer', 'dvt', 'graphics'], resolve(out, 'device-graphics.jsonl'));
  const memory = deviceSampler(binary, udid, ['developer', 'dvt', 'sysmon', 'process', 'monitor', 'process', '-f', pid === null ? 'name=com.apple.WebKit.WebContent' : `pid=${pid}`,
    '--choose', 'last', '--keep-monitoring', '-k', 'pid', '-k', 'name', '-k', 'physFootprint', '-k', 'cpuUsage', '-i', '500'], resolve(out, 'device-webcontent.jsonl'));
  return {
    async stop() {
      const [frames, processes] = await Promise.all([graphics.stop(), memory.stop()]);
      const footprints = processes.samples.flatMap(sample => isRecord(sample) && typeof sample.physFootprint === 'number' ? [sample.physFootprint / 1048576] : []);
      return {
        samples: { graphics: frames.samples, webContent: processes.samples },
        graphics: frames.error ? { error: frames.error } : summariseNumericSamples(frames.samples.map(sample => isRecord(sample) ? { ...sample, receivedAt: undefined } : sample)),
        webContent: processes.error ? { error: processes.error } : { samples: footprints.length, footprintMb: summariseNumericSamples(footprints.map(value => ({ mb: value }))).mb ?? null },
      };
    },
  };
}


export async function captureIosMoment(args: readonly string[]) {
  const option = options(args);
  const steps = option.stepsFile ? parseSteps(JSON.parse(await readFile(resolve(option.stepsFile), 'utf8'))) : [];
  const target: Target = option.device ? { kind: 'device', udid: await connectedDevice(option.device.udid) } : { kind: 'simulator', udid: option.udid ?? await bootedUdid() };
  const udid = target.udid;
  requireStepsFor(target, steps);
  const device = target.kind === 'device' ? await deviceInfo(udid) : null;
  const out = resolve(root, 'output/performance/ios-captures', `${option.name}-${new Date().toISOString().replace(/[:.]/gu, '-')}`);
  await mkdir(out, { recursive: true });
  const { page, proxy } = await connectProxy(option.port, target);
  const session = inspector(page.webSocketDebuggerUrl);
  await session.ready;
  // A fixed status-bar clock keeps simulator screenshots of the same view identical across captures.
  if (target.kind === 'simulator') await run('xcrun', ['simctl', 'status_bar', udid, 'override', '--time', '9:41']);
  const events: Message[] = [], workers = new Map<string, string>();
  let recording = false;
  session.listen((source, message) => {
    if (message.method === 'Worker.workerCreated' && isRecord(message.params)) {
      const worker = requireString(message.params.workerId, 'worker');
      workers.set(worker, requireString(message.params.url, 'worker url').split('/').pop() ?? '');
      // With the Worker domain on, WebKit holds each new worker paused until Worker.initialized ("required to allow
      // execution in the worker", Worker.json). Profile it first when a recording is running, then let it run.
      void (async () => {
        if (recording && option.jsSamples) await session.send('ScriptProfiler.startTracking', { includeSamples: true }, worker);
        await session.send('Worker.initialized', { workerId: worker });
      })();
    }
    events.push({ ...message, source });
  });
  // Page.enable starts the inspector stopwatch every timestamp reads (WebKit InspectorPageAgent::enable); without it all are 0.
  let stopwatchEpochMs = Date.now();
  const enableDomains = async () => {
    stopwatchEpochMs = Date.now();
    for (const domain of ['Page', 'Console', 'Network', 'Timeline', 'Worker']) await session.send(`${domain}.enable`);
    // Real visits keep Safari's cache; --no-cache measures a cold load (it also refetches repeated images).
    if (option.noCache) await session.send('Network.setResourceCachingDisabled', { disabled: true });
  };
  await enableDomains();
  // --open loads the page in this same tab, so each capture starts from a fresh load in the tab on screen.
  // --settle then counts from the moment the app reports its body loaded, not from the navigation.
  const open = option.open?.startsWith('/') ? `${option.origin ?? await networkOrigin()}${option.open}` : option.open;
  // iPadOS 26's page target has no Page.navigate ("'Page.navigate' was not found"), so the page navigates itself.
  if (open) {
    workers.clear();
    const swapsBefore = session.swaps();
    await session.send('Runtime.evaluate', { expression: `location.assign(${JSON.stringify(open)})` });
    await waitForApp(session);
    // A new process starts with every domain off (and its own stopwatch): enable them again before recording.
    if (session.swaps() !== swapsBefore) await enableDomains();
    await wait(option.settle * 1000);
  }
  const location = await session.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const url = isRecord(location.result) && isRecord(location.result.result) && typeof location.result.result.value === 'string' ? location.result.result.value : page.url;
  await wait(500);
  // WebKit's Runtime.evaluate cannot wait for a promise; Runtime.awaitPromise can. Every expression is wrapped in one, so a
  // script that returns a promise (a replay, a scripted camera move) finishes before the capture goes on.
  const evaluate = async (expression: string) => {
    const reply = await session.send('Runtime.evaluate', { expression: `Promise.resolve((${expression}))`, returnByValue: false });
    const promise = isRecord(reply.result) && isRecord(reply.result.result) ? reply.result.result.objectId : null;
    if (typeof promise !== 'string') return null;
    const settled = await session.send('Runtime.awaitPromise', { promiseObjectId: promise, returnByValue: true });
    return isRecord(settled.result) && isRecord(settled.result.result) ? settled.result.result.value : null;
  };
  // A device replay first calibrates: three taps on a transparent shield give the map from page to display coordinates.
  let replay: { plan: ReturnType<typeof touchPlan>; affine: Affine; hits: unknown } | null = null;
  const replayInput: unknown = option.replay ? JSON.parse(await readFile(resolve(option.replay, 'input.json'), 'utf8')) : null;
  // Real touch needs CoreDevice remote control, which iOS 26 refuses ("Remote control requires iOS 27.0 or later",
  // iPad 26.6, 2026-09-26): the replay then runs in the page, as on the simulator — the app's input code gets the same
  // pointer events at the same times; only the system's touch pipeline is skipped.
  let deviceTouch = option.replay !== null && target.kind === 'device';
  if (deviceTouch) {
    await evaluate(CALIBRATION_SHIELD);
    await playTouches(option.pymobiledevice3, udid, CALIBRATION_POINTS.flatMap(([x, y], index) => [[index * 500, 'contact', x, y], [index * 500 + 80, 'release', x, y]]), resolve(out, 'calibration-plan.json'))
      .catch(async (error: unknown) => {
        if (!/requires iOS 2[7-9]|startmediastream/u.test(error instanceof Error ? error.message : String(error))) throw error;
        await evaluate('window.__calibration && window.__calibration.remove()');
        console.error('ios-capture: this iOS refuses remote touch; replaying the recorded pointer events in the page.');
        deviceTouch = false;
      });
  }
  if (deviceTouch) {
    const input = replayInput;
    await wait(300);
    const hits = requireArray(await evaluate('window.__calibration.remove()'), 'calibration hits').map(hit => requireArray(hit, 'hit').map(value => requireFiniteNumber(value, 'hit')) as [number, number]);
    const affine = solveAffine(hits.map((page, index) => ({ page, display: CALIBRATION_POINTS[index]! })));
    replay = { plan: touchPlan(input, affine), affine, hits };
    if (!replay.plan.events.length) throw new Error(`${option.replay}/input.json has no touch to replay.`);
    await writeFile(resolve(out, 'replay.json'), JSON.stringify({ source: relative(root, resolve(option.replay!)), ...replay }, null, 2) + '\n');
  }
  const memoryBefore = await memorySample(session, events);
  const recordingStart = events.length;

  // Instruments first, so the native trace covers the whole moment.
  const native = resolve(out, 'native.trace');
  // On a device, --native page attaches Instruments to the iPad's own web content process over USB: WebKit's native
  // stacks for work its timeline does not record (an 848 ms Composite with 2.5 ms of timeline work, 2026-09-26).
  // The developer disk image unmounts when the device restarts; the samplers and Instruments need it. 0.7 s when mounted.
  if (target.kind === 'device') await run(option.pymobiledevice3, ['mounter', 'auto-mount'], { env: deviceEnv(udid) }).catch(() => undefined);
  const devicePid = target.kind === 'device' ? await deviceWebContentPid(option.pymobiledevice3, udid) : null;
  const pagePid = option.native === 'page' ? (target.kind === 'device' ? devicePid : await pageProcess()) : null;
  // iOS refuses to attach Instruments to WebKit's system process ("Cannot find process for provided pid"), so on a device
  // page mode samples every process and keeps the page's pid when the samples are exported.
  const processes = option.native === 'all' || (target.kind === 'device' && option.native === 'page') ? ['--all-processes']
    : pagePid !== null ? ['--attach', String(pagePid)] : null;
  const xctrace = processes ? spawn('xcrun', ['xctrace', 'record', '--template', option.profile, '--device', udid, ...processes, '--output', native, '--no-prompt'], { stdio: ['ignore', 'pipe', 'pipe'] }) : null;
  const xctraceLog: string[] = [];
  xctrace?.stdout?.on('data', chunk => xctraceLog.push(String(chunk)));
  xctrace?.stderr?.on('data', chunk => xctraceLog.push(String(chunk)));
  for (let attempt = 0; xctrace && attempt < 60 && !xctraceLog.join('').includes('Starting recording'); attempt++) await wait(250);

  const monitors = target.kind === 'device' ? await deviceMonitors(option.pymobiledevice3, udid, out, devicePid) : null;
  const screens = target.kind === 'device' && option.screens ? await deviceScreens(option.pymobiledevice3, udid, out) : null;
  // --no-js-samples leaves JavaScriptCore's sampling profiler off: it costs the page frames, so timing questions run without it.
  if (option.jsSamples) {
    await session.send('ScriptProfiler.startTracking', { includeSamples: true });
    for (const worker of workers.keys()) await session.send('ScriptProfiler.startTracking', { includeSamples: true }, worker);
  }
  recording = true;
  await session.send('CPUProfiler.startTracking');
  await session.send('Timeline.start', { maxCallStackDepth: 8 });
  const started = Date.now(), marks: { label: string; at: number; value?: unknown }[] = [];
  // A script step that returns a promise (a scripted camera move, say) finishes before the next step.
  // --eval runs one expression in the page before recording: an experiment's switch (hide a layer, set a flag).
  if (option.eval) await evaluate(option.eval);
  await evaluate(INPUT_LOGGER);
  const styleWritesStarted = Date.now();
  if (option.styleWrites) await evaluate(STYLE_WRITES_LOGGER);
  // On a device the screenshot is the page's viewport, taken by Web Inspector.
  const screenshot = option.inspectorScreenshots ? (file: string) => snapshotViewport(session, file) : undefined;
  if (replay) {
    marks.push({ label: JSON.stringify({ replay: relative(root, resolve(option.replay!)), contacts: replay.plan.events.length }), at: 0, value: { skippedFingers: replay.plan.skippedFingers } });
    await playTouches(option.pymobiledevice3, udid, replay.plan.events, resolve(out, 'replay-plan.json'));
  } else if (option.replay) {
    const sent = await evaluate(pageReplayExpression(replayInput));
    marks.push({ label: JSON.stringify({ replay: relative(root, resolve(option.replay)), in: 'page' }), at: 0, value: { sent } });
    // The replay resolves at its last pointer event; a flick's inertia coasts on after it.
    await wait(option.tail * 1000);
  } else if (steps.length) await perform(steps, target, out, marks, started, evaluate, selector => selector ? subtreeLayers(session, selector) : layerTree(session, { byPaints: 60, byMemory: 0, reasons: false }), screenshot);
  else {
    marks.push({ label: `manual ${option.seconds} s`, at: 0 });
    console.error(`Recording ${option.seconds} s${device ? ` on ${device.name ?? udid}` : ''}: use it now.`);
    // Whoever holds the device sees the countdown on it: one small fixed label, repainted once a second, gone at the end.
    await evaluate(RECORDING_BADGE(option.seconds ?? 0)).catch(() => null);
    await wait((option.seconds ?? 0) * 1000);
    await evaluate('window.__captureBadge ? window.__captureBadge() : null').catch(() => null);
    console.error('Recording stopped.');
  }
  const durationMs = Date.now() - started;
  const { samples: deviceSamples = null, ...deviceSummary } = (monitors ? await monitors.stop() : null) ?? {};
  if (screens) console.error(`${await screens.stop()} screen grabs.`);
  // The capture goes on without a sampler, but says so here rather than only in the report.
  for (const [sampler, result] of Object.entries(deviceSummary)) if (isRecord(result) && typeof result.error === 'string')
    console.error(`No device ${sampler} samples (${result.error.trim().split('\n').at(-1)}). ${DEVELOPER_SERVICES}`);
  const viewport = await evaluate('[innerWidth, innerHeight]').catch(() => null);
  const input = await evaluate('window.__captureInput ? window.__captureInput.stop() : null').catch(() => null);
  const styleWrites = option.styleWrites ? await evaluate('window.__captureStyles ? window.__captureStyles.stop() : null').catch(() => null) : null;
  if (styleWrites) await writeFile(resolve(out, 'style-writes.json'), JSON.stringify({ startedMs: styleWritesStarted, ...styleWrites }, null, 1) + '\n');
  if (input) await writeFile(resolve(out, 'input.json'), JSON.stringify(input) + '\n');
  await session.send('Timeline.stop');
  await session.send('CPUProfiler.stopTracking');
  await session.send('ScriptProfiler.stopTracking');
  for (const worker of workers.keys()) await session.send('ScriptProfiler.stopTracking', {}, worker);
  const recorded = xctrace ? await stopRecording(xctrace) : false;
  // The export runs while the page side is read.
  const nativeExport: Promise<Awaited<ReturnType<typeof exportTimeProfile>> | { error: string }> = !xctrace ? Promise.resolve({ error: 'Not recorded (--native off).' })
    : recorded ? exportTimeProfile(native, pagePid) : Promise.resolve({ error: 'xctrace did not finish its recording within 120 s.' });
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
  const cpuUpdates = moment.filter(event => event.method === 'CPUProfiler.trackingUpdate' && isRecord(event.params)).map(event => (event.params as Message).event);
  // What jankmonster's report reads beside a trace (its record.mjs writes the same file for Chrome).
  const [width, height] = Array.isArray(viewport) ? viewport : [];
  await writeFile(resolve(out, 'trace.recording.json'), JSON.stringify({
    scenario: option.name, url: page.url, browser: device ? `Safari on ${device.name ?? 'a device'} (${device.model ?? '?'}, iOS ${device.system ?? '?'})` : 'Safari on the iOS Simulator',
    window: typeof width === 'number' && typeof height === 'number' ? { start: { width, height } } : null, categories: ['webkit.timeline'],
    stopReason: replay || option.replay ? 'replay' : steps.length ? 'steps' : `${option.seconds} s timer`,
  }, null, 2) + '\n');
  const cpu = summariseCpu(cpuUpdates, workers);
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
  const nativeResult = await nativeExport;
  const nativeSummary = 'summary' in nativeResult ? nativeResult.summary : nativeResult;
  const nativeSamples = 'samples' in nativeResult && nativeResult.startMs !== null ? { samples: nativeResult.samples, offsetUs: (nativeResult.startMs - stopwatchEpochMs) * 1000 } : null;
  // Everything trace.json is made from, so --rebuild can remake it (a failed export, a new track) without a new take.
  await writeFile(resolve(out, 'raw.json.gz'), gzipSync(JSON.stringify({ schema: 'cssearth-ios-capture-raw@1', moment, stopwatchEpochMs, deviceSamples,
    workers: [...workers], pagePid, metadata: { url: page.url, target: target.kind, ...(device ? { device } : {}) } })));
  await writeFile(resolve(out, 'trace.json'), JSON.stringify(traceEvents(timelineRecords, stopwatchEpochMs, deviceSamples, { url: page.url, target: target.kind, ...(device ? { device } : {}) }, { updates: cpuUpdates, workers }, nativeSamples)) + '\n');

  const pixels = option.compare ? await compareScreenshots(out, (await baselineCaptures(option.compare))[0]!, steps) : null;
  const report = {
    schema: 'cssearth-ios-capture@1', name: option.name, url, udid, target: target.kind, ...(device ? { device, deviceMetrics: deviceSummary } : {}), durationMs, steps: marks, workers: Object.fromEntries(workers),
    sourceMaps: { dist: option.dist, mapped: namer.mapped() }, memoryMb: { before: memoryBefore, after: memoryAfter },
    javascript, timeline, initiators, layers, cpu, console: consoleMessages,
    network: { requests: requests.length, bytes: requests.reduce((sum, request) => sum + request.bytes, 0), largest: requests.sort((a, b) => b.bytes - a.bytes).slice(0, 15) },
    native: nativeSummary, pixels, files: (await readdir(out)).sort(),
  };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(out, 'README.md'), readme(report));
  if (target.kind === 'simulator') await run('xcrun', ['simctl', 'status_bar', udid, 'clear']).catch(() => undefined);
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
      .map(step => { const label: unknown = JSON.parse(step.label), name = isRecord(label) ? label.probe ?? (label.replay ? 'replay' : 'script') : 'script';
        return `- ${String(name)} at ${Math.round(step.at / 100) / 10} s: ${JSON.stringify(step.value)}`; }), ''] : []),
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

// Exits when done: a device sampler or inspector socket still closing must not hold the command open for half a minute.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main().then(() => process.exit(0), (error: unknown) => {
  // A refusal names what is missing; a stack trace would bury it.
  console.error(`ios-capture: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

/** --rebuild <capture dir>: remake trace.json from raw.json.gz and native.trace, the way the capture made it. */
export async function rebuildTrace(dir: string) {
  const raw = requireRecord(JSON.parse(gunzipSync(await readFile(resolve(dir, 'raw.json.gz'))).toString('utf8')), 'raw capture');
  const moment = requireArray(raw.moment, 'raw moment').filter(isRecord);
  const workers = new Map(requireArray(raw.workers, 'raw workers').map(entry => requireArray(entry, 'worker') as [string, string]));
  const stopwatchEpochMs = requireFiniteNumber(raw.stopwatchEpochMs, 'raw stopwatch epoch');
  const timelineRecords = moment.filter(event => event.method === 'Timeline.eventRecorded' && isRecord(event.params)).map(event => (event.params as Message).record);
  const cpuUpdates = moment.filter(event => event.method === 'CPUProfiler.trackingUpdate' && isRecord(event.params)).map(event => (event.params as Message).event);
  const nativeFile = resolve(dir, 'native.trace'), hasNative = await readdir(nativeFile).then(() => true, () => false);
  const exported = hasNative ? await exportTimeProfile(nativeFile, typeof raw.pagePid === 'number' ? raw.pagePid : null) : null;
  const nativeSamples = exported && exported.startMs !== null ? { samples: exported.samples, offsetUs: (exported.startMs - stopwatchEpochMs) * 1000 } : null;
  const deviceSamples = isRecord(raw.deviceSamples) ? raw.deviceSamples as { graphics: unknown[]; webContent: unknown[] } : null;
  await writeFile(resolve(dir, 'trace.json'), JSON.stringify(traceEvents(timelineRecords, stopwatchEpochMs, deviceSamples, isRecord(raw.metadata) ? raw.metadata : {},
    { updates: cpuUpdates, workers }, nativeSamples)) + '\n');
  console.log(`${dir}/trace.json rebuilt${nativeSamples ? `, ${nativeSamples.samples.length} native samples` : hasNative ? `, native export failed: ${exported && 'error' in exported.summary ? exported.summary.error.trim() : '?'}` : ''}`);
}

async function main() {
  const args = process.argv.slice(2), runsIndex = args.indexOf('--runs');
  const rebuild = args.indexOf('--rebuild');
  if (rebuild >= 0) { for (const dir of args.slice(rebuild + 1).filter(arg => !arg.startsWith('--'))) await rebuildTrace(dir); return; }
  const runs = runsIndex >= 0 ? requireFiniteNumber(Number(args[runsIndex + 1]), '--runs') : 1;
  if (!Number.isInteger(runs) || runs < 1) throw new TypeError('--runs is a whole number of captures.');
  const captures = [];
  for (let run = 0; run < runs; run++) {
    const { out, report } = await captureIosMoment(args);
    captures.push({ out, report });
    console.log(`${relative(root, out)}: ${report.timeline.renderingFrames.count} frames, longest ${report.timeline.renderingFrames.longestMs} ms, ` +
      `${report.console.filter(message => message.level === 'error').length} console errors.`);
  }
  const compareIndex = args.indexOf('--compare');
  if (compareIndex >= 0) {
    const baselines = await baselineCaptures(args[compareIndex + 1]!);
    const before = await Promise.all(baselines.map(async dir => captureMetrics(JSON.parse(await readFile(resolve(dir, 'report.json'), 'utf8')))));
    const last = captures.at(-1)!;
    const table = formatComparison(compareCaptures(before, captures.map(capture => captureMetrics(capture.report))), { before: before.length, after: captures.length },
      last.report.pixels?.screenshots ?? []);
    await writeFile(resolve(last.out, 'comparison.md'), `# ${relative(root, last.out)} against ${baselines.map(dir => relative(root, dir)).join(', ')}\n\n${table}`);
    console.log(`\n${table}`);
  }
}
