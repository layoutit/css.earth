import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import os from 'node:os';
import { previewSite } from '../preview.mjs';

// A real, adaptive input journey. No request interception, cache disabling,
// camera stepping, renderer overrides, or page reload between cold/warm passes.
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw Error('Provide a unique capture label.');
const output = resolve(root, 'output/playwright/navigation-consistency', label);
await mkdir(dirname(output), { recursive: true });
await mkdir(output); await mkdir(output + '/frames');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 });
const report = { sourceHead: git('rev-parse', 'HEAD').trim(), sourceStatus: git('status', '--porcelain'),
  viewport: { width: 1995, height: 1236 }, dpr: 2, mode: 'performance',
  invalidationTracking: process.env.CSSEARTH_TRACE_INVALIDATIONS === '1',
  cache: 'Browser defaults; cold destinations followed by same-document cached journey',
  errors: [], milestones: [], inputs: [], requests: [], loadedFiles: {}, hostLoad: os.loadavg() };
await writeFile(output + '/source.patch', git('diff', 'HEAD', '--binary'));
await writeFile(output + '/capture.mjs', await readFile(import.meta.filename));
report.captureSha256 = hash(await readFile(import.meta.filename));
const server = await previewSite({ port: 4241 });
let browser, page, cdp, recording, tracing = false, trace;
const frames = [], writes = [], urls = new Set();
try {
  browser = await chromium.launch({ headless: true,
    executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
  report.browser = browser.version();
  const system = await browser.newBrowserCDPSession();
  report.gpu = (await system.send('SystemInfo.getInfo')).gpu; await system.detach();
  page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: report.dpr });
  page.on('pageerror', error => report.errors.push(error.stack));
  page.on('response', response => {
    urls.add(response.url());
    if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
  });
  cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived', e => report.requests.push({ url: e.response.url, timestamp: e.timestamp,
    status: e.response.status, fromDiskCache: e.response.fromDiskCache ?? false,
    fromServiceWorker: e.response.fromServiceWorker ?? false, encodedDataLength: e.response.encodedDataLength }));
  await page.goto('http://127.0.0.1:4241/sun/');
  await page.waitForFunction(() => window.__sun?.ready && window.__cssEarthRecorder, null, { timeout: 60000 });
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
  report.timeOrigin = await page.evaluate(() => performance.timeOrigin);
  report.settings = await page.locator('input:checked').evaluateAll(nodes => nodes.map(n => ({ name: n.name, value: n.value })));
  await page.evaluate(() => { window.__captureIdentity = [document.querySelector('.prepared-universe'),
    document.querySelector('.planet-input-surface'), performance.timeOrigin]; });
  cdp.on('Page.screencastFrame', e => {
    const file = `frames/frame_${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ file, epochSeconds: e.metadata.timestamp,
      recorderMs: e.metadata.timestamp * 1000 - report.timeOrigin, arrivalIndex: frames.length });
    writes.push(writeFile(output + '/' + file, Buffer.from(e.data, 'base64')));
    void cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Tracing.start', { traceConfig: { recordMode: 'recordUntilFull',
    traceBufferSizeInKb: 524288, excludedCategories: ['*'], includedCategories: [
      'devtools.timeline', 'blink.user_timing', 'toplevel', 'cc', 'viz', 'gpu', 'loading',
      'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-v8.cpu_profiler',
      ...(report.invalidationTracking ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []) ] }, transferMode: 'ReturnAsStream' });
  tracing = true;
  await page.evaluate(() => window.__cssEarthRecorder.start());
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80,
    maxWidth: 1995, maxHeight: 1236, everyNthFrame: 1 });
  const mark = async name => {
    const value = await page.evaluate(name => {
      performance.mark('cssEarth:journey:' + name);
      const app = window.__cssEarth, runtime = window[`__${app.activeObjectId}`];
      return { name, time: performance.now(), active: app.activeObjectId, selected: app.selectedObjectId,
        ready: app.ready, overview: app.overview, camera: runtime?.camera?.state(),
        resources: runtime?.runtime.resources(), worldFrames: window.__cssEarthUniverse.frames() };
    }, name);
    report.milestones.push(value); console.log('PHASE', name, value.active);
  };
  const visible = async id => page.locator(`[data-object-navigate="${id}"][data-context-label], [data-object-navigate="${id}"][data-context-indicator], [data-object-navigate="${id}"][data-context-body]`).evaluateAll(nodes => {
    for (const node of nodes) {
      if (node.ariaDisabled === 'true' || !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (!r.width || !r.height || x < 390 || x > innerWidth - 40 || y < 80 || y > innerHeight - 60) continue;
      if (!document.elementFromPoint(x, y)?.closest('.planet-input-surface')) continue;
      return { x, y, kind: node.hasAttribute('data-context-label') ? 'label' : 'marker', text: node.textContent };
    } return null;
  });
  for (const pass of ['cold', 'warm']) {
    await mark(pass + '-start'); await page.waitForTimeout(1000);
    for (const id of ['mars', 'earth', 'sun']) {
      await mark(`${pass}-zoom-for-${id}-start`); await page.mouse.move(1400, 650);
      let point, packets = 0;
      for (let batch = 0; batch < 65; batch++) {
        for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 6); packets++; await page.waitForTimeout(17); }
        const state = await page.evaluate(() => ({ overview: window.__cssEarth.overview,
          ready: window.__cssEarth.ready, distance: window[`__${window.__cssEarth.activeObjectId}`]?.camera?.state()?.distanceKilometers }));
        if (state.overview && state.ready && state.distance >= 2 * 149597870.7) {
          point = await visible(id); if (point) break;
        }
      }
      if (!point) throw Error(`No visible ${id} after ${packets} wheel packets`);
      await page.waitForTimeout(700); await mark(`${pass}-zoom-for-${id}-end`);
      point = await visible(id); if (!point) throw Error(`${id} disappeared after wheel settling`);
      await page.mouse.move(point.x, point.y); await page.waitForTimeout(200);
      point = await visible(id); if (!point) throw Error(`${id} disappeared on hover`);
      report.inputs.push({ pass, id, point, wheelPackets: packets });
      await mark(`${pass}-flight-to-${id}-start`); await page.mouse.click(point.x, point.y);
      await page.waitForFunction(id => window.__cssEarth.error || window.__cssEarth.selectedObjectId === id, id, { timeout: 8000 });
      await mark(`${pass}-${id}-selected`);
      await page.waitForFunction(id => window.__cssEarth.error || (window.__cssEarth.ready && window.__cssEarth.activeObjectId === id), id, { timeout: 45000 });
      const error = await page.evaluate(() => window.__cssEarth.error); if (error) throw Error(String(error));
      await mark(`${pass}-flight-to-${id}-end`); await page.waitForTimeout(1200);
    }
    await mark(pass + '-end');
  }
  recording = await page.evaluate(() => { window.__cssEarthRecorder.stop('capture'); return window.__cssEarthRecorder.lastRecording; });
  report.retained = await page.evaluate(() => ({ world: window.__captureIdentity[0] === document.querySelector('.prepared-universe'),
    input: window.__captureIdentity[1] === document.querySelector('.planet-input-surface'),
    document: window.__captureIdentity[2] === performance.timeOrigin,
    cameras: document.querySelectorAll('.planet-stage > .polycss-camera').length, selected: window.__cssEarth.selectedObjectId }));
} catch (error) { report.errors.push(error.stack); }
finally {
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
  if (!recording && page) recording = await page.evaluate(() => { window.__cssEarthRecorder?.stop('failure'); return window.__cssEarthRecorder?.lastRecording; }).catch(() => null);
  if (tracing) {
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); const completed = await done;
    report.traceDataLoss = completed.dataLossOccurred ?? false;
    try {
      await pipeline(Readable.from((async function* () {
        for (;;) {
          const part = await cdp.send('IO.read', { handle: completed.stream, size: 4 * 1024 ** 2 });
          yield Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8');
          if (part.eof) break;
        }
      })()), createGzip(), createWriteStream(output + '/trace.json.gz'));
      trace = true;
    } finally { await cdp.send('IO.close', { handle: completed.stream }); }
  }
  await Promise.all(writes); await browser?.close(); await server.close();
  for (const url of urls) {
    const u = new URL(url); if (u.origin !== 'http://127.0.0.1:4241') continue;
    const file = resolve(root, 'dist', '.' + decodeURIComponent(u.pathname) + (u.pathname.endsWith('/') ? 'index.html' : ''));
    try {
      const bytes = await readFile(file);
      report.loadedFiles[u.pathname] = { bytes: bytes.length, sha256: hash(bytes), modifiedAt: (await stat(file)).mtimeMs };
      if (/\.(?:js|css)$/.test(u.pathname)) {
        const saved = resolve(output, 'served', '.' + u.pathname);
        await mkdir(dirname(saved), { recursive: true }); await writeFile(saved, bytes);
      }
    }
    catch (error) { report.errors.push(`Served file identity unavailable: ${u.pathname}: ${error.message}`); }
  }
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  await writeFile(output + '/video-frames.json', JSON.stringify(frames));
  if (recording) await writeFile(output + `/cssearth-diagnostics-${recording.id}.json`, JSON.stringify(recording));
}
if (!recording || !trace || frames.length < 2) throw Error(JSON.stringify(report.errors));
frames.sort((a, b) => a.recorderMs - b.recorderMs);
if (frames.some((f, i) => i > 0 && f.recorderMs <= frames[i - 1].recorderMs)) throw Error('Nonunique video timestamps');
await writeFile(output + '/video-chronological-frames.json', JSON.stringify(frames));
await writeFile(output + '/frames.ffconcat', frames.map((f, i) => `file '${f.file}'\noption framerate 1000000\nduration ${((frames[i + 1]?.recorderMs ?? f.recorderMs + 16.667) - f.recorderMs) / 1000}\n`).join(''));
execFileSync('/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', output + '/frames.ffconcat',
  '-fps_mode', 'passthrough', '-enc_time_base', '1:1000000', '-video_track_timescale', '1000000', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
  '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', output + '/journey.mp4']);
const { synchronizeCapture } = await import('./navigation-sync.mjs');
const sync = await synchronizeCapture(output);
console.log('RESULT', JSON.stringify(sync)); if (!sync.valid) process.exitCode = 1;
