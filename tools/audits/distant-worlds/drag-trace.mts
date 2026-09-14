import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
// Uses the same Chrome CDP categories and 60-step vertical drag path as the
// Saturn audit. This narrower workload excludes its wheel and moon controls.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, type Request } from 'playwright';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { traceDurationEvents, type TraceEvent } from '../../../tests/objects/browser/comets/trace-events.mts';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
declare global { interface Window { __cometTraceNodes?: Element[]; __cometRaf?: number[]; __cometRafActive?: boolean; } }
interface LoadReceipt { url: string; bytes: number; sha256: string; }
interface LoadFailure { url: string; error: string; }
type DocumentReceipt = {url: string; status: number} & Awaited<ReturnType<Request['sizes']>>;
interface FrameReporter { frameSource: string; frameSequence: string; state: string; }
function readTrace(text: string): TraceEvent[] { return requireArray(requireRecord(JSON.parse(text), 'Chrome trace').traceEvents, 'Chrome trace events').map((value,index)=>{const event=requireRecord(value, `Chrome trace event ${index}`);const duration=event.dur===undefined?undefined:requireFiniteNumber(event.dur, `Chrome trace event ${index} duration`);return {name:requireString(event.name, `Chrome trace event ${index} name`),ph:requireString(event.ph, `Chrome trace event ${index} phase`),ts:requireFiniteNumber(event.ts, `Chrome trace event ${index} timestamp`),pid:requireFiniteNumber(event.pid, `Chrome trace event ${index} process`),tid:requireFiniteNumber(event.tid, `Chrome trace event ${index} thread`),...(duration===undefined?{}:{dur:duration}),...(event.args===undefined?{}:{args:requireRecord(event.args, `Chrome trace event ${index} arguments`)})};}); }
function frameReporter(event: TraceEvent): FrameReporter | null { if(!event.args)return null;const value=event.args.frame_reporter;if(value===undefined)return null;const record=requireRecord(value, 'Pipeline frame reporter');return {frameSource:sourceLabel(record.frame_source, 'Pipeline frame source'),frameSequence:sourceLabel(record.frame_sequence, 'Pipeline frame sequence'),state:sourceLabel(record.state, 'Pipeline frame state')}; }
function sourceLabel(value: unknown, label: string): string { if(typeof value==='string'||typeof value==='number')return String(value);throw new TypeError(`${label} must be a string or number.`); }
const origin = process.argv[2] ?? 'http://127.0.0.1:4278';
const dpr = Number(process.argv[3] ?? 1);
assert.ok([1, 2].includes(dpr));
const id = process.argv[5] ?? 'oumuamua';
assert.ok(SCENE_OBJECTS.some(object => object.id === id && ['trans-neptunian','interstellar'].includes(object.classification)));
const lensId = process.argv[6] ?? null;
const viewToken = process.argv[7] ?? null;
if (lensId) assert.match(lensId, /^[a-z][a-z0-9-]*$/);
if (viewToken) assert.match(viewToken, /^[A-Za-z0-9_-]+$/);
const output = resolve(process.argv[4] ?? `output/playwright/distant-worlds/drag-${id}-dpr${dpr}`);
await mkdir(output, { recursive: true });
const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:output,redirectStdio:true})).options);
try {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  await context.routeWebSocket(url=>url.host===new URL(origin).host,ws=>{const server=ws.connectToServer();server.onMessage(message=>{let packet: Record<string, unknown>|null=null;try{packet=requireRecord(JSON.parse(String(message)), 'Vite WebSocket message');}catch{}const messageType=packet?.type;if(messageType!=='update'&&messageType!=='full-reload'){if(typeof message==='string'||Buffer.isBuffer(message))ws.send(message);else throw new TypeError('Vite WebSocket message must be text or bytes.');}});});
  const page = await context.newPage(), errors: string[] = [], requests: string[] = [], loaded: LoadReceipt[] = [], responseTasks: Promise<void>[] = [], loadFailures: LoadFailure[]=[],documents: DocumentReceipt[]=[];
  const cdp = await context.newCDPSession(page);
  // Same bounded inspector buffers as the existing comet delivery capture.
  await cdp.send('Network.enable',{maxTotalBufferSize:268435456,maxResourceBufferSize:134217728});
  page.on('response', response => {
    const url = new URL(response.url());
    if(response.request().resourceType()==='document')responseTasks.push(response.request().sizes().then(sizes=>{documents.push({url:response.url(),status:response.status(),...sizes});}).catch(error=>{loadFailures.push({url:response.url(),error:error instanceof Error ? error.message : String(error)});}));
    if (url.origin === new URL(origin).origin && (url.pathname.startsWith(`/objects/${id}/`) || url.pathname.endsWith('.js') ||
        url.pathname.startsWith(`/scenes/${id}/`) && /-(surface|shadow)@2x\.webp$/.test(url.pathname))) {
      responseTasks.push(response.body().then(bytes => {loaded.push({ url: response.url(), bytes: bytes.length, sha256: hash(bytes) });}).catch(error=>{loadFailures.push({url:response.url(),error:error instanceof Error ? error.message : String(error)});}));
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  const viewUrl = new URL(`/${id}/`, origin);
  if (viewToken) viewUrl.searchParams.set('v', viewToken);
  await page.goto(viewUrl.href, { waitUntil: 'networkidle' });
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    document.querySelector('.planet-stage')?.getAttribute('data-object-id') === id, id);
  if (lensId) {
    await page.locator(`button[name="lens"][value="${lensId}"]`).click();
    await page.waitForFunction(lens => document.querySelector(`button[name="lens"][value="${lens}"]`)?.getAttribute('aria-pressed') === 'true', lensId);
  }
  assert.equal(await page.locator('input[name="shadows"]').isChecked(), false);
  await page.waitForLoadState('networkidle');
  await Promise.all(responseTasks);
  assert.deepEqual(loadFailures,[],'Every selected response body must be retained for provenance');
  const expectedTransport=hash(await readFile(`src/objects/${id}/prepared/object.json`));
  assert.ok(loaded.some(record=>record.sha256===expectedTransport),'Exact current prepared-object bytes were loaded');
  await page.waitForTimeout(1000);
  const initial = await page.evaluate(id => {
    const root = document.querySelector('.planet-stage'), scene=document.querySelector('.polycss-scene');
    if(!root||!scene)throw new Error('Missing trace scene elements.');
    window.__cometTraceNodes = [root, ...root.querySelectorAll('*')];
    const atlasUrls = [...new Set([...document.querySelectorAll(`.${id}-body > u`)].map(node => getComputedStyle(node).backgroundImage))].sort();
    return { sceneTransform: getComputedStyle(scene).transform,
      nodes: window.__cometTraceNodes.length, bodyLeaves: document.querySelectorAll(`.${id}-body > u`).length,
      atlasUrls, diagnosticsAvailable: Object.prototype.hasOwnProperty.call(window, `__${id}`) };
  }, id);
  assert.ok(initial.atlasUrls.length && initial.atlasUrls.every(url => /@2x\.webp/.test(url)));
  if (lensId) assert.ok(initial.atlasUrls.every(url => url.includes(`-${lensId}-`)), 'Trace must load the selected lens atlas.');
  await page.screenshot({ path: resolve(output, 'before.png') });
  const host = await browser.newBrowserCDPSession();
  const gpu = (await host.send('SystemInfo.getInfo')).gpu;
  await cdp.send('Tracing.start', { categories: '-*,benchmark,cc,devtools.timeline,blink.user_timing,toplevel,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc', transferMode: 'ReturnAsStream' });
  await page.evaluate(() => performance.mark('comet-trace-start'));
  await page.waitForTimeout(2000);
  const requestOffset = requests.length;
  await page.evaluate(() => {
    performance.mark('comet-trace-interaction-start');
    window.__cometRaf = []; window.__cometRafActive = true;
    const tick = (time: number) => { const raf=window.__cometRaf;if(!raf)throw new Error('Missing trace animation frames.');if (window.__cometRafActive) { raf.push(time); requestAnimationFrame(tick); } }; requestAnimationFrame(tick);
  });
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.mouse.move(viewport.width * .6, viewport.height * .485);
    await page.mouse.down();
    await page.mouse.move(viewport.width * .6, viewport.height * .283, { steps: 60 });
    await page.mouse.move(viewport.width * .6, viewport.height * .582, { steps: 60 });
    await page.mouse.up();
  }
  const raf = await page.evaluate(() => { window.__cometRafActive = false; performance.mark('comet-trace-interaction-end');const frames=window.__cometRaf;if(!frames)throw new Error('Missing trace animation frames.');return frames; });
  await page.waitForTimeout(2000);
  await page.evaluate(() => performance.mark('comet-trace-end'));
  const complete = new Promise<{stream: string}>(resolve => cdp.once('Tracing.tracingComplete', payload => {const record=requireRecord(payload, 'Tracing completion');resolve({stream:requireString(record.stream, 'Tracing stream')});}));
  await cdp.send('Tracing.end'); const { stream } = await complete;
  let text = '';
  for (;;) { const part = await cdp.send('IO.read', { handle: stream }); text += part.base64Encoded ? Buffer.from(part.data, 'base64').toString() : part.data; if (part.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  const final = await page.evaluate(id => {
    const root = document.querySelector('.planet-stage'), scene=document.querySelector('.polycss-scene'), retained=window.__cometTraceNodes;
    if(!root||!scene||!retained)throw new Error('Missing retained trace scene elements.');
    const nodes = [root, ...root.querySelectorAll('*')];
    return { sceneTransform: getComputedStyle(scene).transform,
      nodes: nodes.length, retainedIdentity: nodes.length === retained.length && nodes.every((node, i) => node === retained[i]),
      atlasUrls: [...new Set([...document.querySelectorAll(`.${id}-body > u`)].map(node => getComputedStyle(node).backgroundImage))].sort() };
  }, id);
  await page.screenshot({ path: resolve(output, 'after.png') });
  const traceEvents = readTrace(text), marks = new Map<string, TraceEvent>(traceEvents.flatMap(event => event.name?.startsWith('comet-trace-') ? [[event.name, event] as const] : []));
  const start = marks.get('comet-trace-interaction-start'), end = marks.get('comet-trace-interaction-end');
  assert.ok(start && end, 'trace must bind the exact interaction window');
  const events = traceEvents.filter(event => event.ts >= start.ts && event.ts < end.ts);
  const spans = traceDurationEvents(traceEvents, start.ts, end.ts);
  const main = spans.filter(e => e.pid === start.pid && e.tid === start.tid);
  const selected = (pattern: RegExp) => stats(main.filter(event => pattern.test(event.name)).map(event => event.dur / 1000));
  const draws = events.filter(e => e.name === 'DrawFrame' && (e.ph === 'I' || e.ph === 'X'));
  const drawing = new Map<string, TraceEvent[]>();
  for (const event of draws) { const key = `${event.pid}:${event.tid}`, eventsForThread=drawing.get(key)??[];eventsForThread.push(event);drawing.set(key, eventsForThread); }
  const durations: Record<string, number[]> = {}, relevant = /Draw|Swap|SubmitCompositorFrame|RasterTask|PipelineReporter/;
  for (const event of spans) if (relevant.test(event.name)) (durations[event.name] ??= []).push(event.dur / 1000);
  const pipeline = events.filter(event => event.pid === start.pid && event.name === 'PipelineReporter' && event.ph === 'b').flatMap(event=>{const reporter=frameReporter(event);return reporter?[reporter]:[];});
  const sequences = new Map<string, Set<string>>();
  for (const reporter of pipeline) { const key = `${reporter.frameSource}:${reporter.frameSequence}`, states=sequences.get(key)??new Set<string>();states.add(reporter.state);sequences.set(key, states); }
  const compressed = gzipSync(text, { level: 9 });
  const pinPaths = ['prepared/object.json', 'prepared/runtime.json', 'runtime-assets.json', 'prepared/terrain.json'].map(path => `src/objects/${id}/${path}`);
  const prepared: Record<string, {bytes: number; sha256: string}> = {};
  for (const path of pinPaths) { const bytes = await readFile(path); prepared[path] = { bytes: bytes.length, sha256: hash(bytes) }; }
  const report = { schema: 'cssearth-comet-drag-trace@1', capturedAt: new Date().toISOString(),
    codeRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktreeDiffSha256: hash(execFileSync('git', ['diff', 'HEAD', '--', 'tools', 'site', 'packages',
      'src/platform', 'src/renderers', `src/objects/${id}/source`, `tests/objects/browser/${id}`], { maxBuffer: 32 * 1024 * 1024 })),
    build: process.env.CSSEARTH_AUDIT_BUILD ?? 'production', diagnosticsAvailable: initial.diagnosticsAvailable, route: page.url(), browser: browser.version(), headless: true,
    viewport, dpr, hardware: process.platform === 'darwin' ? execFileSync('sysctl', ['-n', 'hw.model', 'hw.memsize', 'machdep.cpu.brand_string'], { encoding: 'utf8' }).trim().split('\n') : process.arch,
    gpu, workload: { cycles: 3, stepsPerLeg: 60, x: .6, startY: .485, upperY: .283, lowerY: .582, shadows: false, wheels: 0, ...(lensId ? { lensId } : {}) },
    initial, final, errors, interactionRequests: requests.slice(requestOffset), prepared, loaded: loaded.sort((a,b) => a.url.localeCompare(b.url)),
    documents,documentQualification:'HTML response sizes/status are recorded; JS, prepared-object payload and selected scene atlases have decoded-byte hashes, following the existing comet delivery capture.',
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
function hash(bytes: string | Buffer) { return createHash('sha256').update(bytes).digest('hex'); }
function stats(input: readonly number[]) {
  let values: number[];
  values = input.filter(Number.isFinite).sort((a,b) => a-b);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { count: values.length, totalMs: round(values.reduce((a,b) => a+b,0)), medianMs: round(values[Math.floor(values.length*.5)] ?? 0), p95Ms: round(values[Math.floor(values.length*.95)] ?? 0), maxMs: round(values.at(-1) ?? 0), over33ms: values.filter(x=>x>33.4).length, over50ms: values.filter(x=>x>=50).length };
}
