import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import type { Browser, CDPSession, Page } from 'playwright';
import { previewSite } from '../cli/preview.mts';
import { errorMessage, recordOf } from './trace-model.mts';

// A real, adaptive input journey. No request interception, cache disabling,
// camera stepping, renderer overrides, or page reload between cold/warm passes.
//
// Page diagnostics are external values. Page functions read them through
// Reflect: `get` fails as a property read on undefined does, `opt` behaves as
// optional chaining and `call` invokes a method on its owner.
const root = fileURLToPath(new URL('../../', import.meta.url));
const label = process.argv[2];
const origin = process.env.CSSEARTH_CAPTURE_ORIGIN ?? 'http://127.0.0.1:4241';
const scenario = process.env.CSSEARTH_CAPTURE_SCENARIO ?? 'navigation';
const videoEnabled = process.env.CSSEARTH_CAPTURE_VIDEO === '1';
const route = process.env.CSSEARTH_CAPTURE_ROUTE ?? '/sun/';
if (!['navigation', 'world-zoom', 'drag-zoom', 'style-probe'].includes(scenario)) throw Error('Unknown capture scenario.');
const zoomDelta = Number(process.env.CSSEARTH_CAPTURE_ZOOM_DELTA ?? 6);
if (!(zoomDelta > 0 && Number.isFinite(zoomDelta))) throw Error('Capture zoom delta must be positive and finite.');
// Node-level invalidation stacks are very large. Short, complete captures keep
// both synchronization anchors; a truncated trace cannot qualify performance.
const zoomPackets = Number(process.env.CSSEARTH_CAPTURE_ZOOM_PACKETS ?? 24);
const zoomCycles = Number(process.env.CSSEARTH_CAPTURE_ZOOM_CYCLES ?? 2);
if (!Number.isInteger(zoomPackets) || zoomPackets < 1 || ![1, 2].includes(zoomCycles)) {
  throw Error('Capture zoom requires positive integer packets and one or two cycles.');
}
if (!label || !/^[a-z0-9-]+$/.test(label)) throw Error('Provide a unique capture label.');
const output = resolve(root, 'output/playwright/navigation-consistency', label);
await mkdir(dirname(output), { recursive: true });
await mkdir(output); if (videoEnabled) await mkdir(output + '/frames');

const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 });

type Point = [number, number];
interface VisibleTarget { x: number; y: number; kind: string; text: string | null }
interface CaptureInput {
  type?: string; phase?: string; deltaY?: number; packets?: number; intervalMs?: number; from?: Point; to?: Point; steps?: number;
  pass?: string; id?: string; point?: VisibleTarget; wheelPackets?: number;
}
interface ObservedRequest { url: string; timestamp: number; status: number; fromDiskCache: boolean; fromServiceWorker: boolean; encodedDataLength: number }
interface CaptureReport {
  sourceHead: string; sourceStatus: string; viewport: { width: number; height: number }; dpr: number; mode: string;
  scenario: string; route: string; videoEnabled: boolean; invalidationTracking: boolean; domSnapshot: boolean; cache: string;
  errors: unknown[]; milestones: unknown[]; inputs: CaptureInput[]; requests: ObservedRequest[];
  loadedFiles: Record<string, { bytes: number; sha256: string; modifiedAt: number }>; hostLoad: number[];
  captureSha256?: string; browser?: string; gpu?: unknown; timeOrigin?: number; settings?: { name: string; value: string }[];
  retained?: unknown; traceDataLoss?: boolean;
}
interface VideoFrame { file: string; epochSeconds: number | undefined; recorderMs: number; arrivalIndex: number }

const report: CaptureReport = { sourceHead: git('rev-parse', 'HEAD').trim(), sourceStatus: git('status', '--porcelain'),
  viewport: { width: 1995, height: 1236 }, dpr: Number(process.env.CSSEARTH_CAPTURE_DPR ?? 2), mode: 'performance', scenario, route, videoEnabled,
  invalidationTracking: process.env.CSSEARTH_TRACE_INVALIDATIONS === '1',
  domSnapshot: process.env.CSSEARTH_TRACE_DOM === '1',
  cache: scenario === 'world-zoom'
    ? `Browser defaults; fresh context, Sun startup completed before ${zoomCycles} same-document zoom cycles`
    : 'Browser defaults; cold destinations followed by same-document cached journey',
  errors: [], milestones: [], inputs: [], requests: [], loadedFiles: {}, hostLoad: os.loadavg() };
await writeFile(output + '/source.patch', git('diff', 'HEAD', '--binary'));
await writeFile(output + '/capture.mts', await readFile(import.meta.filename));
report.captureSha256 = sha256(await readFile(import.meta.filename));
const server = process.env.CSSEARTH_CAPTURE_ORIGIN ? { close: async () => {} } : await previewSite({ port: 4241 });
let browser: Browser | undefined, page: Page | undefined, cdp: CDPSession | undefined, recording: unknown, tracing = false, trace = false;
const frames: VideoFrame[] = [], writes: Promise<void>[] = [], urls = new Set<string>();
try {
  const launched = await chromium.launch({ headless: true,
    executablePath: process.env.CSSEARTH_CAPTURE_BROWSER ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  browser = launched;
  report.browser = launched.version();
  const system = await launched.newBrowserCDPSession();
  report.gpu = (await system.send('SystemInfo.getInfo')).gpu; await system.detach();
  const tab = await launched.newPage({ viewport: report.viewport, deviceScaleFactor: report.dpr });
  page = tab;
  tab.on('pageerror', error => report.errors.push(error.stack));
  tab.on('response', response => {
    urls.add(response.url());
    if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
  });
  const session = await tab.context().newCDPSession(tab);
  cdp = session;
  await session.send('Network.enable');
  session.on('Network.responseReceived', e => report.requests.push({ url: e.response.url, timestamp: e.timestamp,
    status: e.response.status, fromDiskCache: e.response.fromDiskCache ?? false,
    fromServiceWorker: e.response.fromServiceWorker ?? false, encodedDataLength: e.response.encodedDataLength }));
  await tab.goto(origin + route);
  await tab.waitForFunction(() => {
    const opt = (target: unknown, key: PropertyKey): unknown => target === null || target === undefined ? undefined : Reflect.get(Object(target), key);
    const recorder: unknown = Reflect.get(window, '__cssEarthRecorder');
    return opt(Reflect.get(window, '__sun'), 'ready') && recorder;
  }, null, { timeout: 60000 });
  await tab.waitForLoadState('networkidle'); await tab.waitForTimeout(700);
  if (report.domSnapshot) await writeFile(output + '/dom-before.json', JSON.stringify(await session.send('DOMSnapshot.captureSnapshot', { computedStyles: [] })));
  const timeOrigin = await tab.evaluate(() => performance.timeOrigin);
  report.timeOrigin = timeOrigin;
  report.settings = await tab.locator('input:checked').evaluateAll(nodes => nodes.flatMap(n => n instanceof HTMLInputElement ? [{ name: n.name, value: n.value }] : []));
  await tab.evaluate(() => { Reflect.set(window, '__captureIdentity', [document.querySelector('.prepared-universe'),
    document.querySelector('.object-input-surface'), performance.timeOrigin]); });
  if (videoEnabled) session.on('Page.screencastFrame', e => {
    const file = `frames/frame_${String(frames.length).padStart(5, '0')}.jpg`;
    // Arithmetic converts a missing timestamp exactly as Number() does.
    frames.push({ file, epochSeconds: e.metadata.timestamp,
      recorderMs: Number(e.metadata.timestamp) * 1000 - timeOrigin, arrivalIndex: frames.length });
    writes.push(writeFile(output + '/' + file, Buffer.from(e.data, 'base64')));
    void session.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await session.send('Tracing.start', { traceConfig: { recordMode: 'recordUntilFull',
    traceBufferSizeInKb: 524288, excludedCategories: ['*'], includedCategories: [
      'devtools.timeline', 'blink.user_timing', 'toplevel', 'cc', 'viz', 'gpu', 'loading',
      'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-v8.cpu_profiler',
      ...(report.invalidationTracking ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []) ] }, transferMode: 'ReturnAsStream' });
  tracing = true;
  await tab.evaluate(() => {
    const call = (target: unknown, key: PropertyKey, ...args: unknown[]): unknown => {
      if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
      const method: unknown = Reflect.get(Object(target), key);
      if (typeof method !== 'function') throw new TypeError(`${String(key)} is not a function`);
      return Reflect.apply(method, target, args);
    };
    return call(Reflect.get(window, '__cssEarthRecorder'), 'start');
  });
  if (videoEnabled) await session.send('Page.startScreencast', { format: 'jpeg', quality: 80,
    maxWidth: 1995, maxHeight: 1236, everyNthFrame: 1 });
  const mark = async (name: string) => {
    const value = await tab.evaluate(name => {
      const get = (target: unknown, key: PropertyKey): unknown => {
        if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
        return Reflect.get(Object(target), key);
      };
      const opt = (target: unknown, key: PropertyKey): unknown => target === null || target === undefined ? undefined : Reflect.get(Object(target), key);
      const call = (target: unknown, key: PropertyKey, ...args: unknown[]): unknown => {
        const method = get(target, key);
        if (typeof method !== 'function') throw new TypeError(`${String(key)} is not a function`);
        return Reflect.apply(method, target, args);
      };
      performance.mark('cssEarth:journey:' + name);
      const app: unknown = Reflect.get(window, '__cssEarth');
      const runtime: unknown = Reflect.get(window, `__${get(app, 'mountedObjectId') ?? get(app, 'activeObjectId')}`);
      const stars = get(call(Reflect.get(window, '__cssEarthUniverse'), 'inspect'), 'stars');
      if (stars === null || stars === undefined) throw new TypeError(`Cannot destructure '${stars}' as it is ${stars}.`);
      // Omit the point elements, as `const { points, ...worldPoints } = stars` does.
      const worldPoints: Record<string, unknown> = Object.fromEntries(Object.entries(Object(stars)).filter(([key]) => key !== 'points'));
      const camera = opt(runtime, 'camera');
      return { name, time: performance.now(), active: get(app, 'activeObjectId'), mounted: get(app, 'mountedObjectId') ?? get(app, 'activeObjectId'), selected: get(app, 'selectedObjectId'),
        ready: get(app, 'ready'), overview: get(app, 'overview'), camera: camera === null || camera === undefined ? undefined : call(camera, 'state'),
        resources: runtime === null || runtime === undefined ? undefined : call(get(runtime, 'runtime'), 'resources'),
        worldFrames: call(Reflect.get(window, '__cssEarthUniverse'), 'frames'), worldPoints };
    }, name);
    report.milestones.push(value); console.log('PHASE', name, value.active);
  };
  const visible = async (id: string) => tab.locator(`[data-object-navigate="${id}"][data-context-label], [data-object-navigate="${id}"][data-context-indicator], [data-object-navigate="${id}"][data-context-body]`).evaluateAll((nodes): VisibleTarget | null => {
    for (const node of nodes) {
      if (node.ariaDisabled === 'true' || !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (!r.width || !r.height || x < 390 || x > innerWidth - 40 || y < 80 || y > innerHeight - 60) continue;
      if (!document.elementFromPoint(x, y)?.closest('.object-input-surface')) continue;
      return { x, y, kind: node.hasAttribute('data-context-label') ? 'label' : 'marker', text: node.textContent };
    } return null;
  });
  const wheel = async (phase: string, delta: number) => {
    await mark(`zoom-${phase}-start`);
    report.inputs.push({ phase, type: 'wheel', deltaY: delta, packets: zoomPackets, intervalMs: 24 });
    for (let i = 0; i < zoomPackets; i++) { await tab.mouse.wheel(0, delta); await tab.waitForTimeout(24); }
    await tab.waitForTimeout(700); await mark(`zoom-${phase}-end`);
  };
  if (scenario === 'style-probe') {
    await tab.mouse.move(1400, 650);
    await mark('style-probe-start');
    report.inputs.push({ type: 'wheel', deltaY: zoomDelta, packets: 1 });
    await tab.mouse.wheel(0, zoomDelta);
    await tab.waitForTimeout(180);
    await mark('style-probe-end');
  } else if (scenario === 'drag-zoom') {
    const drags: [string, Point, Point, number][] = [
      ['out', [1420, 650], [1020, 750], zoomDelta],
      ['in', [1020, 750], [1420, 650], -zoomDelta],
    ];
    for (const [phase, from, to, delta] of drags) {
      await mark(`drag-${phase}-start`);
      report.inputs.push({ phase, type: 'drag', from, to, steps: 32 });
      await tab.mouse.move(...from); await tab.mouse.down();
      await tab.mouse.move(...to, { steps: 32 }); await tab.mouse.up();
      await tab.waitForTimeout(700); await mark(`drag-${phase}-end`);
      await wheel(phase, delta);
    }
  } else if (scenario === 'world-zoom') {
    await tab.mouse.move(1400, 650);
    const zooms: [string, number][] = [['out', zoomDelta], ['in', -zoomDelta], ['out-again', zoomDelta], ['in-again', -zoomDelta]];
    for (const [phase, delta] of zooms.slice(0, zoomCycles * 2)) await wheel(phase, delta);
  } else for (const pass of ['cold', 'warm']) {
    await mark(pass + '-start'); await tab.waitForTimeout(1000);
    for (const id of ['mars', 'earth', 'sun']) {
      await mark(`${pass}-zoom-for-${id}-start`); await tab.mouse.move(1400, 650);
      let point: VisibleTarget | null = null, packets = 0;
      for (let batch = 0; batch < 65; batch++) {
        for (let i = 0; i < 8; i++) { await tab.mouse.wheel(0, 6); packets++; await tab.waitForTimeout(17); }
        const state = await tab.evaluate(() => {
          const get = (target: unknown, key: PropertyKey): unknown => {
            if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
            return Reflect.get(Object(target), key);
          };
          const opt = (target: unknown, key: PropertyKey): unknown => target === null || target === undefined ? undefined : Reflect.get(Object(target), key);
          const app: unknown = Reflect.get(window, '__cssEarth');
          const overview = get(app, 'overview'), ready = get(app, 'ready');
          const runtime: unknown = Reflect.get(window, `__${get(app, 'mountedObjectId') ?? get(app, 'activeObjectId')}`);
          const camera = opt(runtime, 'camera');
          let view: unknown;
          if (camera !== null && camera !== undefined) {
            const state = get(camera, 'state');
            if (typeof state !== 'function') throw new TypeError('state is not a function');
            view = Reflect.apply(state, camera, []);
          }
          return { overview, ready, distance: opt(view, 'distanceKilometers') };
        });
        // The comparison converts the distance exactly as Number() does.
        if (state.overview && state.ready && Number(state.distance) >= 2 * 149597870.7) {
          point = await visible(id); if (point) break;
        }
      }
      if (!point) throw Error(`No visible ${id} after ${packets} wheel packets`);
      await tab.waitForTimeout(700); await mark(`${pass}-zoom-for-${id}-end`);
      point = await visible(id); if (!point) throw Error(`${id} disappeared after wheel settling`);
      await tab.mouse.move(point.x, point.y); await tab.waitForTimeout(200);
      point = await visible(id); if (!point) throw Error(`${id} disappeared on hover`);
      report.inputs.push({ pass, id, point, wheelPackets: packets });
      await mark(`${pass}-flight-to-${id}-start`); await tab.mouse.click(point.x, point.y);
      await tab.waitForFunction(id => {
        const get = (target: unknown, key: PropertyKey): unknown => {
          if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
          return Reflect.get(Object(target), key);
        };
        const app: unknown = Reflect.get(window, '__cssEarth');
        return get(app, 'error') || get(app, 'selectedObjectId') === id;
      }, id, { timeout: 8000 });
      await mark(`${pass}-${id}-selected`);
      await tab.waitForFunction(id => {
        const get = (target: unknown, key: PropertyKey): unknown => {
          if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
          return Reflect.get(Object(target), key);
        };
        const app: unknown = Reflect.get(window, '__cssEarth');
        return get(app, 'error') || (get(app, 'ready') && get(app, 'activeObjectId') === id);
      }, id, { timeout: 45000 });
      const error = await tab.evaluate(() => {
        const app: unknown = Reflect.get(window, '__cssEarth');
        if (app === null || app === undefined) throw new TypeError(`Cannot read properties of ${app} (reading 'error')`);
        const value: unknown = Reflect.get(Object(app), 'error');
        return value;
      });
      if (error) throw Error(String(error));
      await mark(`${pass}-flight-to-${id}-end`); await tab.waitForTimeout(1200);
    }
    await mark(pass + '-end');
  }
  recording = await tab.evaluate(() => {
    const get = (target: unknown, key: PropertyKey): unknown => {
      if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
      return Reflect.get(Object(target), key);
    };
    const recorder: unknown = Reflect.get(window, '__cssEarthRecorder');
    const stop = get(recorder, 'stop');
    if (typeof stop !== 'function') throw new TypeError('stop is not a function');
    Reflect.apply(stop, recorder, ['capture']);
    return get(recorder, 'lastRecording');
  });
  report.retained = await tab.evaluate(() => {
    const get = (target: unknown, key: PropertyKey): unknown => {
      if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
      return Reflect.get(Object(target), key);
    };
    const identity: unknown = Reflect.get(window, '__captureIdentity');
    return { world: get(identity, 0) === document.querySelector('.prepared-universe'),
      input: get(identity, 1) === document.querySelector('.object-input-surface'),
      document: get(identity, 2) === performance.timeOrigin,
      cameras: document.querySelectorAll('.object-stage > .polycss-camera').length, selected: get(Reflect.get(window, '__cssEarth'), 'selectedObjectId') };
  });
} catch (error) { report.errors.push(recordOf(error)?.stack); }
finally {
  if (cdp && videoEnabled) await cdp.send('Page.stopScreencast').catch(() => {});
  if (!recording && page) recording = await page.evaluate(() => {
    const opt = (target: unknown, key: PropertyKey): unknown => target === null || target === undefined ? undefined : Reflect.get(Object(target), key);
    const recorder: unknown = Reflect.get(window, '__cssEarthRecorder');
    if (recorder !== null && recorder !== undefined) {
      const stop = opt(recorder, 'stop');
      if (typeof stop !== 'function') throw new TypeError('stop is not a function');
      Reflect.apply(stop, recorder, ['failure']);
    }
    return opt(recorder, 'lastRecording');
  }).catch(() => null);
  if (tracing && cdp) {
    const session = cdp;
    const done = new Promise<{ dataLossOccurred: boolean; stream?: string }>(accept => session.once('Tracing.tracingComplete', accept));
    await session.send('Tracing.end'); const completed = await done;
    report.traceDataLoss = completed.dataLossOccurred ?? false;
    const handle = completed.stream;
    if (handle === undefined) throw Error('Chrome completed tracing without a trace stream.');
    try {
      await pipeline(Readable.from((async function* () {
        for (;;) {
          const part = await session.send('IO.read', { handle, size: 4 * 1024 ** 2 });
          yield Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8');
          if (part.eof) break;
        }
      })()), createGzip(), createWriteStream(output + '/trace.json.gz'));
      trace = true;
    } finally { await session.send('IO.close', { handle }); }
  }
  if (report.domSnapshot && cdp) await writeFile(output + '/dom-after.json', JSON.stringify(await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: [] })));
  await Promise.all(writes); await browser?.close(); await server.close();
  for (const url of urls) {
    const u = new URL(url); if (u.origin !== origin) continue;
    const file = resolve(root, process.env.CSSEARTH_CAPTURE_DIST ?? 'dist', '.' + decodeURIComponent(u.pathname) + (u.pathname.endsWith('/') ? 'index.html' : ''));
    try {
      const bytes = await readFile(file);
      report.loadedFiles[u.pathname] = { bytes: bytes.length, sha256: sha256(bytes), modifiedAt: (await stat(file)).mtimeMs };
      if (/\.(?:js|css)$/.test(u.pathname)) {
        const saved = resolve(output, 'served', '.' + u.pathname);
        await mkdir(dirname(saved), { recursive: true }); await writeFile(saved, bytes);
      }
    }
    catch (error) { report.errors.push(`Served file identity unavailable: ${u.pathname}: ${errorMessage(error)}`); }
  }
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  if (videoEnabled) await writeFile(output + '/video-frames.json', JSON.stringify(frames));
  if (recording) await writeFile(output + `/cssearth-diagnostics-${recordOf(recording)?.id}.json`, JSON.stringify(recording));
}
if (!recording || !trace || report.traceDataLoss || report.errors.length || (videoEnabled && frames.length < 2)) throw Error(JSON.stringify({ errors: report.errors, traceDataLoss: report.traceDataLoss }));
if (videoEnabled) {
frames.sort((a, b) => a.recorderMs - b.recorderMs);
if (frames.some((f, i) => i > 0 && f.recorderMs <= (frames[i - 1]?.recorderMs ?? -Infinity))) throw Error('Nonunique video timestamps');
await writeFile(output + '/video-chronological-frames.json', JSON.stringify(frames));
await writeFile(output + '/frames.ffconcat', frames.map((f, i) => `file '${f.file}'\noption framerate 1000000\nduration ${((frames[i + 1]?.recorderMs ?? f.recorderMs + 16.667) - f.recorderMs) / 1000}\n`).join(''));
execFileSync('/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', output + '/frames.ffconcat',
  '-fps_mode', 'passthrough', '-enc_time_base', '1:1000000', '-video_track_timescale', '1000000', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
  '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', output + '/journey.mp4']);
const { synchronizeCapture } = await import('./navigation-sync.mts');
const sync = await synchronizeCapture(output);
console.log('RESULT', JSON.stringify(sync)); if (!sync.valid) process.exitCode = 1;
} else console.log('RESULT', JSON.stringify({ output, videoEnabled, traceDataLoss: report.traceDataLoss, retained: report.retained }));
