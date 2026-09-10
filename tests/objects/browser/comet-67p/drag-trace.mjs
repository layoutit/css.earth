#!/usr/bin/env node
// Uses the same Chrome CDP categories and 60-step vertical drag path as the
// Saturn audit. This narrower workload excludes its wheel and moon controls.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { OBJECTS } from '../../../../site/objects.mts';
import { traceDurationEvents } from '../comets/trace-events.mjs';
const origin = process.argv[2] ?? 'http://127.0.0.1:4257';
const dpr = Number(process.argv[3] ?? 1);
assert.ok([1, 2].includes(dpr));
const id = process.argv[5] ?? 'comet-67p';
assert.ok(OBJECTS.some(object => object.id === id && object.classification === 'comet'));
const lensId = process.argv[6] ?? null;
const viewToken = process.argv[7] ?? null;
if (lensId) assert.match(lensId, /^[a-z][a-z0-9-]*$/);
if (viewToken) assert.match(viewToken, /^[A-Za-z0-9_-]+$/);
const output = resolve(process.argv[4] ?? `output/comet-performance/${id}-dpr-${dpr}`);
await mkdir(output, { recursive: true });
const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await context.newPage(), errors = [], requests = [], loaded = [], responseTasks = [];
  page.on('response', response => {
    // Vite can redirect module URLs; only the final successful response owns bytes.
    if (!response.ok()) return;
    const url = new URL(response.url());
    if (url.origin === new URL(origin).origin && (response.request().resourceType() === 'document' || url.pathname.endsWith('.js') ||
        url.pathname.startsWith(`/scenes/${id}/`) && /-(surface|shadow)@2x\.webp$/.test(url.pathname))) {
      responseTasks.push(response.body().then(bytes => loaded.push({ url: response.url(), bytes: bytes.length, sha256: hash(bytes) })));
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  const viewUrl = new URL(`/${id}/`, origin);
  if (viewToken) viewUrl.searchParams.set('v', viewToken);
  await page.goto(viewUrl.href, { waitUntil: 'networkidle' });
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    document.querySelector('.planet-stage').dataset.objectId === id, id);
  if (lensId) {
    await page.locator(`button[name="lens"][value="${lensId}"]`).click();
    await page.waitForFunction(lens => document.querySelector(`button[name="lens"][value="${lens}"]`)?.getAttribute('aria-pressed') === 'true', lensId);
  }
  if (!await page.locator('input[name="shadows"]').isChecked()) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('label').filter({ hasText: 'Shadows' }).click();
    await page.keyboard.press('Escape');
  }
  assert.equal(await page.locator('input[name="shadows"]').isChecked(), true);
  await page.waitForLoadState('networkidle');
  await Promise.all(responseTasks);
  await page.waitForTimeout(1000);
  const initial = await page.evaluate(id => {
    const root = document.querySelector('.planet-stage');
    window.__cometTraceNodes = [root, ...root.querySelectorAll('*')];
    const visibleLeaves = [...document.querySelectorAll(`.${id}-body > u`)].filter(node => getComputedStyle(node).display !== 'none');
    const atlasUrls = [...new Set(visibleLeaves.map(node => getComputedStyle(node).backgroundImage))].sort();
    return { sceneTransform: getComputedStyle(document.querySelector('.polycss-scene')).transform,
      nodes: window.__cometTraceNodes.length, bodyLeaves: document.querySelectorAll(`.${id}-body > u`).length,
      visibleBodyLeaves: visibleLeaves.length,
      atlasUrls, diagnosticsAvailable: !!window[`__${id}`] };
  }, id);
  assert.ok(initial.atlasUrls.length && initial.atlasUrls.every(url => /@2x\.webp/.test(url)));
  if (lensId) assert.ok(initial.atlasUrls.every(url => url.includes(`-${lensId}-`)), 'Trace must load the selected lens atlas.');
  await page.screenshot({ path: resolve(output, 'before.png') });
  const cdp = await context.newCDPSession(page);
  const host = await browser.newBrowserCDPSession();
  const gpu = (await host.send('SystemInfo.getInfo')).gpu;
  await cdp.send('Tracing.start', { categories: '-*,benchmark,cc,devtools.timeline,blink.user_timing,toplevel,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc', transferMode: 'ReturnAsStream' });
  await page.evaluate(() => performance.mark('comet-trace-start'));
  await page.waitForTimeout(2000);
  const requestOffset = requests.length;
  await page.evaluate(() => {
    performance.mark('comet-trace-interaction-start');
    window.__cometRaf = []; window.__cometRafActive = true;
    const tick = t => { if (window.__cometRafActive) { window.__cometRaf.push(t); requestAnimationFrame(tick); } }; requestAnimationFrame(tick);
  });
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.mouse.move(viewport.width * .6, viewport.height * .485);
    await page.mouse.down();
    await page.mouse.move(viewport.width * .6, viewport.height * .283, { steps: 60 });
    await page.mouse.move(viewport.width * .6, viewport.height * .582, { steps: 60 });
    await page.mouse.up();
  }
  const raf = await page.evaluate(() => { window.__cometRafActive = false; performance.mark('comet-trace-interaction-end'); return window.__cometRaf; });
  await page.waitForTimeout(2000);
  await page.evaluate(() => performance.mark('comet-trace-end'));
  const complete = new Promise(accept => cdp.once('Tracing.tracingComplete', accept));
  await cdp.send('Tracing.end'); const { stream } = await complete;
  let text = '';
  for (;;) { const part = await cdp.send('IO.read', { handle: stream }); text += part.base64Encoded ? Buffer.from(part.data, 'base64').toString() : part.data; if (part.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  const final = await page.evaluate(id => {
    const root = document.querySelector('.planet-stage'), nodes = [root, ...root.querySelectorAll('*')];
    return { sceneTransform: getComputedStyle(document.querySelector('.polycss-scene')).transform,
      nodes: nodes.length, retainedIdentity: nodes.length === window.__cometTraceNodes.length && nodes.every((node, i) => node === window.__cometTraceNodes[i]),
      atlasUrls: [...new Set([...document.querySelectorAll(`.${id}-body > u`)].filter(node => getComputedStyle(node).display !== 'none').map(node => getComputedStyle(node).backgroundImage))].sort() };
  }, id);
  await page.screenshot({ path: resolve(output, 'after.png') });
  const trace = JSON.parse(text), marks = new Map(trace.traceEvents.filter(e => e.name.startsWith('comet-trace-')).map(e => [e.name, e]));
  const start = marks.get('comet-trace-interaction-start'), end = marks.get('comet-trace-interaction-end');
  assert.ok(start && end, 'trace must bind the exact interaction window');
  const events = trace.traceEvents.filter(e => e.ts >= start.ts && e.ts < end.ts);
  const spans = traceDurationEvents(trace.traceEvents, start.ts, end.ts);
  const main = spans.filter(e => e.pid === start.pid && e.tid === start.tid);
  const selected = pattern => stats(main.filter(e => pattern.test(e.name)).map(e => e.dur / 1000));
  const draws = events.filter(e => e.name === 'DrawFrame' && (e.ph === 'I' || e.ph === 'X'));
  const drawing = new Map();
  for (const e of draws) { const k = `${e.pid}:${e.tid}`; if (!drawing.has(k)) drawing.set(k, []); drawing.get(k).push(e); }
  const durations = {}, relevant = /Draw|Swap|SubmitCompositorFrame|RasterTask|PipelineReporter/;
  for (const e of spans) if (relevant.test(e.name)) (durations[e.name] ??= []).push(e.dur / 1000);
  const pipeline = events.filter(e => e.pid === start.pid && e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter);
  const sequences = new Map();
  for (const e of pipeline) { const r = e.args.frame_reporter, k = `${r.frame_source}:${r.frame_sequence}`; if (!sequences.has(k)) sequences.set(k, new Set()); sequences.get(k).add(r.state); }
  const compressed = gzipSync(text, { level: 9 });
  const pinPaths = ['prepared/object.json', 'prepared/runtime.json', 'runtime-assets.json', 'prepared/terrain.json'].map(path => `src/planets/${id}/${path}`);
  const prepared = {};
  for (const path of pinPaths) { const b = await readFile(path); prepared[path] = { bytes: b.length, sha256: hash(b) }; }
  const report = { schema: 'cssearth-comet-drag-trace@1', capturedAt: new Date().toISOString(),
    codeRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktreeDiffSha256: hash(execFileSync('git', ['diff', 'HEAD', '--', 'tools', 'site', 'packages',
      'src/platform', 'src/renderers', `src/planets/${id}/source`, `tests/objects/browser/${id}`], { maxBuffer: 32 * 1024 * 1024 })),
    build: initial.diagnosticsAvailable ? 'development' : 'production', route: page.url(), browser: browser.version(), headless: true,
    viewport, dpr, hardware: process.platform === 'darwin' ? execFileSync('sysctl', ['-n', 'hw.model', 'hw.memsize', 'machdep.cpu.brand_string'], { encoding: 'utf8' }).trim().split('\n') : process.arch,
    gpu, workload: { cycles: 3, stepsPerLeg: 60, x: .6, startY: .485, upperY: .283, lowerY: .582, shadows: true, wheels: 0, ...(lensId ? { lensId } : {}) },
    initial, final, errors, interactionRequests: requests.slice(requestOffset), prepared, loaded: loaded.sort((a,b) => a.url.localeCompare(b.url)),
    durationMs: (end.ts - start.ts) / 1000, rendererMain: { pid: start.pid, tid: start.tid },
    rafIntervals: stats(raf.slice(1).map((t, i) => t - raf[i])),
    drawCadence: [...drawing].map(([thread, list]) => ({ thread, count: list.length, intervals: stats(list.slice(1).map((e, i) => (e.ts - list[i].ts) / 1000)) })),
    drawDurations: Object.fromEntries(Object.entries(durations).map(([name, values]) => [name, stats(values)])),
    main: { tasks: selected(/^(?:ThreadControllerImpl::RunTask|RunTask)$/), script: selected(/^FunctionCall$/), style: selected(/^(?:UpdateLayoutTree|RecalculateStyles)$/), layout: selected(/^Layout$/), paint: selected(/^Paint$/), prePaint: selected(/^PrePaint$/), layerize: selected(/^Layerize$/) },
    pipeline: { sequences: sequences.size, droppedWithoutPresentation: [...sequences.values()].filter(s => s.has('STATE_DROPPED') && !s.has('STATE_PRESENTED_ALL') && !s.has('STATE_PRESENTED_PARTIAL')).length },
    trace: { filename: 'chrome-trace.json.gz', bytes: compressed.length, sha256: hash(compressed) } };
  await writeFile(resolve(output, 'chrome-trace.json.gz'), compressed);
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, durationMs: report.durationMs, raf: report.rafIntervals, drawCadence: report.drawCadence, drawDurations: report.drawDurations, main: report.main, pipeline: report.pipeline, nodes: initial.nodes, retained: final.retainedIdentity, errors }, null, 2));
  assert.deepEqual(errors, []); assert.ok(final.retainedIdentity);
  assert.deepEqual(report.interactionRequests, []); assert.deepEqual(final.atlasUrls, initial.atlasUrls);
  assert.notEqual(final.sceneTransform, initial.sceneTransform);
} finally { await browser.close(); }
function hash(b) { return createHash('sha256').update(b).digest('hex'); }
function stats(values) {
  values = values.filter(Number.isFinite).sort((a,b) => a-b);
  const round = x => Math.round(x * 1000) / 1000;
  return { count: values.length, totalMs: round(values.reduce((a,b) => a+b,0)), medianMs: round(values[Math.floor(values.length*.5)] ?? 0), p95Ms: round(values[Math.floor(values.length*.95)] ?? 0), maxMs: round(values.at(-1) ?? 0), over33ms: values.filter(x=>x>33.4).length, over50ms: values.filter(x=>x>=50).length };
}
