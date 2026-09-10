// Native close-surface input against an immutable build. Use BASELINE=1 with
// the previous build to capture the same scenario without prepared partitions.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scrollToDistance } from './wheel-zoom-distance.mts';

const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const id = process.env.OBJECT ?? 'deimos', dpr = Number(process.env.DPR ?? 1);
const output = process.env.OUTPUT ?? `output/playwright/prepared-depth/${id}-${dpr}`;
const baseline = process.env.BASELINE === '1';
const deimos = '/deimos/?v=QMa-OvZTMzMzND4CTfKrAgxLwD53novFBipBQsczQAAAAL9vWpHfsF5zP-QPDVMal9a_aTmeZWrCwAAA';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const page = await browser.newPage({ viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
const report = { origin, id, dpr, baseline, browser: browser.version(), responses: [], errors: [], inputs: [] };
const responses = [];
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
  if (response.request().resourceType() === 'image') return;
  responses.push(response.body().then(bytes => report.responses.push({ url: response.url(), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') })).catch(() => {}));
});
const state = () => page.evaluate(() => {
  const app = window.__cssEarth, camera = document.querySelector('.polycss-camera');
  return { selected: app.selectedObjectId, active: app.activeObjectId, error: app.error, ready: app.ready,
    camera: window[`__${app.activeObjectId}`].camera.state(), url: location.href,
    scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length,
    partitions: [...camera.children].filter(node => node.style.contain === 'paint').map(root => ({ order: root.style.zIndex,
      transform: root.firstElementChild.style.transform, hidden: root.firstElementChild.hidden, leaves: root.querySelectorAll('u').length })),
  };
});
let tracing = false;
const cdp = await page.context().newCDPSession(page);
try {
  await page.goto(origin + (id === 'deimos' ? deimos : `/${id}/`));
  await page.waitForFunction(() => window.__cssEarth?.error || window.__cssEarth?.ready, null, { timeout: 40000 });
  assert.equal((await state()).error, null);
  if (id !== 'deimos') {
    const camera = (await state()).camera;
    await scrollToDistance(page, camera.distanceKilometers * camera.silhouetteRadius / 350);
  }
  await page.waitForTimeout(500); await Promise.all(responses);
  report.before = await state();
  assert.equal(report.before.scenes, 1);
  assert.equal(report.before.camera.levelOfDetail.stage, 'geometry');
  assert.equal(report.before.partitions.length > 1, !baseline);
  assert.ok(report.before.camera.silhouetteRadius > 300);
  await page.evaluate(() => {
    window.__depthIdentity = { nodes: [...document.querySelector('.polycss-camera').querySelectorAll('*')],
      world: document.querySelector('.prepared-universe'), input: document.querySelector('.planet-input-surface') };
  });
  await page.screenshot({ path: `${output}/before.png` });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,toplevel,viz', transferMode: 'ReturnAsStream' }); tracing = true;
  await page.mouse.move(1200, 590); await page.evaluate(() => performance.mark('depth-drag-start')); await page.mouse.down();
  const start = performance.now();
  for (let i = 1; i <= 180; i++) {
    const wait = start + i * 1000 / 60 - performance.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    await page.mouse.move(1200 - i, 590 + i / 4); report.inputs.push(performance.now() - start);
  }
  await page.mouse.up(); await page.evaluate(() => performance.mark('depth-drag-end'));
  await page.waitForTimeout(400);
  report.after = await state(); assert.equal(report.after.error, null);
  assert.equal(report.after.scenes, 1); assert.equal(report.after.ready, true);
  report.retained = await page.evaluate(() => {
    const previous = window.__depthIdentity, nodes = [...document.querySelector('.polycss-camera').querySelectorAll('*')];
    return previous.nodes.length === nodes.length && nodes.every((node, index) => node === previous.nodes[index]) &&
      previous.world === document.querySelector('.prepared-universe') && previous.input === document.querySelector('.planet-input-surface');
  });
  assert.equal(report.retained, true);
  if (!baseline) assert.equal(new Set(report.after.partitions.map(group => group.transform)).size, 1);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; }
finally {
  if (tracing) {
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end');
    const { stream } = await done, file = await open(`${output}/trace.json`, 'w');
    try { for (;;) { const part = await cdp.send('IO.read', { handle: stream }); await file.write(part.data); if (part.eof) break; } }
    finally { await file.close(); await cdp.send('IO.close', { handle: stream }); }
  }
  await page.screenshot({ path: `${output}/after.png` }).catch(() => {});
  await Promise.all(responses); await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failure) throw new Error(report.failure);
console.log(`PREPARED DEPTH PASS ${id} DPR ${dpr}${baseline ? ' baseline' : ''}`);
