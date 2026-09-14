import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import sharp from 'sharp';
import { chromium } from 'playwright';
import type { CDPSession, Page } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';
import { createTestPage } from '../../../site/test/browser-observations.mts';

const directory = 'output/playwright/native-resize/saturn-transparent';
await mkdir(directory, { recursive: true });
const origin = 'http://127.0.0.1:4349';
const saved = 'MMZBJDALq2Er6kFCxzNAAAAAP9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const bundle = await build({ entryPoints: ['tools/experiments/native-resize/saturn-input.mts'], bundle: true, write: false, format: 'esm', target: 'es2022' });
const adapter = bundle.outputFiles[0].text;
const rendererResponse = await fetch(`${origin}/src/renderers/css/dist/index.js`);
assert.ok(rendererResponse.ok, 'The running renderer bundle must be available.');
const original = await rendererResponse.text();
const start = original.indexOf('function bindCameraInputListeners({');
const end = original.indexOf('// ../../src/renderers/css/navigation/camera-input.ts', start);
assert.ok(start > 0 && end > start, 'Existing shared listener boundary must be present.');
const listener = original.slice(start, end);
const modified = listener.replace('function bindCameraInputListeners({', 'function bindCameraInputListeners(options) {\nconst {')
  .replace('}) {\n  const listen', '} = bindSaturnResizeInput(options);\n  const listen');
assert.notEqual(modified, listener);
const patched = `import { bindSaturnResizeInput } from '/native-saturn-input.js';\n${original.slice(0, start)}${modified}${original.slice(end)}`;
await writeFile(`${directory}/renderer-index.js`, patched);
await writeFile(`${directory}/input-adapter.js`, adapter);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
declare global { interface Window { __saturnFrames: { times: number[]; transforms: string[]; observer: MutationObserver }; __saturnNodes: Element[]; } }
const matrix = (value: string) => {
  assert.match(value, /^matrix3d\(.+\)$/u);
  const values = value.slice(9, -1).split(',').map(Number);
  assert.equal(values.length, 16); assert.ok(values.every(Number.isFinite));
  return values;
};
const angleDifference = (a: string, b: string) => {
  const first = matrix(a), second = matrix(b);
  const trace = [0, 1, 2, 4, 5, 6, 8, 9, 10].reduce((sum, i) => sum + first[i] * second[i], 0);
  return Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180 / Math.PI;
};
async function gesture(cdp: CDPSession, points: readonly (readonly [number, number])[], paced: boolean) {
  const x = 680, y = 450;
  const pending = [cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })];
  let px = x, py = y;
  for (const [dx, dy] of points) {
    const fromX = px, fromY = py;
    for (let i = 1; i <= 72; i++) {
      px = Math.round(fromX + (x + dx - fromX) * i / 72);
      py = Math.round(fromY + (y + dy - fromY) * i / 72);
      pending.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1 }));
      if (paced) await pause(16);
    }
  }
  // Let the final pose publish, then release without throwing either input.
  await pause(180);
  pending.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: py, button: 'left', buttons: 0, clickCount: 1 }));
  await Promise.all(pending);
  await pause(150);
}
const state = (page: Page) => page.evaluate(() => {
  const owner = window.__cssearthTest.object('saturn');
  const scene = window.__cssearthTest.html('.polycss-scene');
  const sky = window.__cssearthTest.html('.prepared-celestial-sky-scene');
  const box = document.querySelector<HTMLElement>('.native-saturn-resize');
  return { camera: owner.camera.state(), sky: sky.style.transform, scene: scene.style.transform,
    cameraStats: owner.camera.stats(), ready: window.__cssearthTest.scene().ready, error: window.__cssearthTest.scene().error,
    scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length,
    leaves: document.querySelectorAll('.planet-stage u').length,
    preparedNodes: document.querySelectorAll('.planet-stage [data-prepared-node]').length,
    samples: Reflect.get(window, '__saturnInputSamples'),
    native: box ? { width: box.style.width, height: box.style.height, contain: getComputedStyle(box).contain } : null };
});
const browser = await chromium.launch({ ...(await conformanceBrowserLaunch({ evidenceDirectory: directory })).options, ignoreDefaultArgs: ['--hide-scrollbars'] });
const results: unknown[] = [];
let referenceStart: string | undefined, referenceEnd: string | undefined;
let referenceBeforePixels: Buffer | undefined, referenceAfterPixels: Buffer | undefined;
const pixels = (path: string) => sharp(path).removeAlpha().raw().toBuffer();
const visualDifference = (a: Buffer, b: Buffer) => {
  assert.equal(a.length, b.length);
  let sum = 0, changed = 0;
  for (let index = 0; index < a.length; index++) { const difference = Math.abs(a[index] - b[index]); sum += difference; if (difference > 12) changed++; }
  return { meanChannelDifference: sum / a.length, channelShareOver12: changed / a.length };
};
try {
  const trials = process.env.NATIVE_SATURN_PROBE === '1' ? 1 : 3;
  for (let trial = 1; trial <= trials; trial++) for (const mode of trial % 2 ? ['js', 'resize', 'size'] : ['size', 'resize', 'js']) {
    const page = await createTestPage(browser, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', mode, error.message); });
    await page.route('**/native-saturn-input.js', route => route.fulfill({ contentType: 'text/javascript', body: adapter }));
    await page.route('**/src/renderers/css/dist/index.js*', route => route.fulfill({ contentType: 'text/javascript', body: patched }));
    await page.goto(`${origin}/saturn/?v=${saved}&traceInput=${mode}`);
    await page.waitForFunction(() => window.__cssEarth?.ready || window.__cssEarth?.error, undefined, { timeout: 60000 });
    assert.equal(await page.locator('html').getAttribute('data-ready'), 'true');
    const cdp = await page.context().newCDPSession(page);
    await page.mouse.move(680, 450);
    await pause(500);
    // Warm a real drag, then restore the exact shared physical pose.
    const initial = await page.evaluate(() => window.__cssearthTest.object('saturn').camera.state());
    await gesture(cdp, [[20, 10], [0, 0]], true);
    await page.evaluate(initial => {
      window.__cssearthTest.object('saturn').camera.setState(initial);
      const input: unknown = Reflect.get(window, '__nativeSaturnInput');
      if (input && typeof input === 'object' && 'reset' in input && typeof input.reset === 'function') input.reset();
    }, initial);
    await pause(500);
    const before = await state(page);
    assert.equal(before.error, null); assert.equal(before.scenes, 1);
    assert.ok(before.preparedNodes > 900, 'The full prepared Saturn tree must be present.');
    referenceStart ??= before.camera.pose.scene;
    assert.equal(before.camera.pose.scene, referenceStart);
    await page.screenshot({ path: `${directory}/${mode}-${trial}-before.png` });
    const beforePixels = await pixels(`${directory}/${mode}-${trial}-before.png`);
    referenceBeforePixels ??= beforePixels;
    const beforeVisual = visualDifference(referenceBeforePixels, beforePixels);
    assert.ok(beforeVisual.meanChannelDifference < 0.5 && beforeVisual.channelShareOver12 < 0.01,
      `The full scene must remain visible before tracing: ${JSON.stringify(beforeVisual)}`);
    await page.evaluate(() => {
      const scene = window.__cssearthTest.html('.polycss-scene');
      const times: number[] = [], transforms: string[] = [];
      let previous = scene.style.transform;
      const observer = new MutationObserver(() => {
        const transform = scene.style.transform;
        if (transform === previous) return;
        previous = transform; times.push(performance.now()); transforms.push(transform);
      });
      observer.observe(scene, { attributes: true, attributeFilter: ['style'] });
      window.__saturnFrames = { times, transforms, observer };
      window.__saturnNodes = [...document.querySelectorAll('.planet-stage [data-prepared-node]')];
    });
    await cdp.send('Tracing.start', { traceConfig: { recordMode: 'recordUntilFull', traceBufferSizeInKb: 131072,
      excludedCategories: ['*'], includedCategories: ['devtools.timeline', 'blink.user_timing', 'toplevel', 'cc', 'viz', 'gpu', 'input', 'latencyInfo',
        'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame'] }, transferMode: 'ReturnAsStream' });
    await cdp.send('Tracing.recordClockSyncMarker', { syncId: `${mode}-${trial}:drag-start` });
    await gesture(cdp, [[100, 60], [-60, -60], [80, 40]], true);
    await cdp.send('Tracing.recordClockSyncMarker', { syncId: `${mode}-${trial}:drag-end` });
    const complete = new Promise<{ stream?: string; dataLossOccurred?: boolean }>(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); const traced = await complete;
    assert.ok(traced.stream); assert.equal(traced.dataLossOccurred, false);
    const chunks: Buffer[] = [];
    for (;;) { const chunk = await cdp.send('IO.read', { handle: traced.stream }); chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8')); if (chunk.eof) break; }
    await cdp.send('IO.close', { handle: traced.stream });
    const bytes = gzipSync(Buffer.concat(chunks));
    await writeFile(`${directory}/${mode}-${trial}.json.gz`, bytes);
    const after = await state(page);
    const sceneFrames = await page.evaluate(() => {
      window.__saturnFrames.observer.disconnect();
      const current = [...document.querySelectorAll('.planet-stage [data-prepared-node]')];
      return { times: window.__saturnFrames.times, transforms: window.__saturnFrames.transforms,
        retained: current.length === window.__saturnNodes.length && current.every((node, index) => node === window.__saturnNodes[index]) };
    });
    await page.screenshot({ path: `${directory}/${mode}-${trial}-after.png` });
    const afterPixels = await pixels(`${directory}/${mode}-${trial}-after.png`);
    referenceAfterPixels ??= afterPixels;
    const afterVisual = visualDifference(referenceAfterPixels, afterPixels);
    assert.ok(afterVisual.meanChannelDifference < 0.5 && afterVisual.channelShareOver12 < 0.01,
      `The full scene must remain visible after tracing: ${JSON.stringify(afterVisual)}`);
    assert.equal(after.error, null); assert.equal(after.scenes, 1); assert.equal(after.leaves, before.leaves);
    assert.notEqual(after.scene, before.scene); assert.notEqual(after.sky, before.sky);
    assert.equal(sceneFrames.retained, true);
    if (mode === 'js') referenceEnd ??= after.camera.pose.scene;
    assert.ok(referenceEnd);
    const endpointDifferenceDegrees = angleDifference(referenceEnd, after.camera.pose.scene);
    assert.ok(endpointDifferenceDegrees < 0.02, `Camera endpoint differs by ${endpointDifferenceDegrees} degrees.`);
    if (mode !== 'js') { assert.equal(after.native?.width, '4176px'); assert.equal(after.native?.height, '4136px'); }
    assert.deepEqual(errors, []);
    results.push({ mode, trial, before, after, beforeVisual, afterVisual, sceneFrames, endpointDifferenceDegrees, errors, traceSha256: hash(bytes), traceBytes: bytes.length });
    await writeFile(`${directory}/comparison.json`, JSON.stringify({ browser: browser.version(), viewport: { width: 1280, height: 900 }, dpr: 1,
      originalRendererSha256: hash(original), tracedRendererSha256: hash(patched), inputAdapterSha256: hash(adapter),
      qualification: 'Input substitution with the same live shared camera and complete Saturn renderer. Renderer JS remains active in native resize cases. CPU sampling omitted in all modes.', results }, null, 2));
    console.log('PASS', mode, trial, 'prepared nodes', after.preparedNodes, 'camera frames', sceneFrames.times.length, 'endpoint degrees', endpointDifferenceDegrees);
    await page.close();
  }
} finally { await browser.close(); }
