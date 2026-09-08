import assert from 'node:assert/strict';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { scrollToDistance } from './wheel-zoom-distance.mjs';

const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const output = process.env.OUTPUT ?? 'output/playwright/interaction-chain';
const dpr = Number(process.env.DPR ?? 1);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ??
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const page = await browser.newPage({ viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
const cdp = await page.context().newCDPSession(page);
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  diffSha256: createHash('sha256').update(execFileSync('git', ['diff'])).digest('hex'),
  browser: browser.version(), origin, dpr, viewport: { width: 1995, height: 1236 }, phases: [], inputs: [], resources: [], errors: [] };
const responses = [];
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => {
  if (!response.url().startsWith(origin) || response.request().resourceType() === 'image') return;
  const entry = { url: response.url(), status: response.status() }; report.resources.push(entry);
  responses.push(response.body().then(bytes => { entry.sha256 = createHash('sha256').update(bytes).digest('hex'); })
    .catch(error => { entry.error = error.message; }));
});
const state = () => page.evaluate(() => {
  const app = window.__cssEarth;
  return { active: app.activeObjectId, selected: app.selectedObjectId, ready: app.ready, error: app.error,
    overview: app.overview, camera: window[`__${app.activeObjectId}`]?.camera?.state(),
    scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length };
});
async function mark(name) {
  await page.evaluate(name => performance.mark(`cssEarth:scenario:${name}`), name);
  report.phases.push({ name, ...await state() }); console.log(name);
}
async function waitReady(id) {
  await page.waitForFunction(id => window.__cssEarth?.error || (window.__cssEarth?.ready && (!id || window.__cssEarth.activeObjectId === id)), id, { timeout: 40000 });
  const current = await state(); assert.equal(current.error, null); assert.equal(current.scenes, 1);
}
async function select(id, interrupt = false) {
  const targets = await page.locator(`[data-object-navigate="${id}"]:not(a):not(.context-orbit)`).evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, visible: css.visibility === 'visible' && Number(css.opacity) > .1 };
  }).filter(r => r.visible && r.width > 0 && r.x > 340 && r.x + r.width < innerWidth && r.y > 40 && r.y + r.height < innerHeight - 30));
  const target = targets[0];
  await mark(`fly-${id}:start`);
  if (target) { report.inputs.push({ type: 'scene-pick', id, target }); await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2); }
  else {
    await page.locator('.planet-sidebar-search').fill(id);
    const link = page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).first();
    await link.waitFor(); report.inputs.push({ type: 'search-pick', id }); await link.click();
  }
  if (interrupt) {
    await page.waitForFunction(id => window.__cssEarth.selectedObjectId === id && !window.__cssEarth.ready, id);
    await mark(`interrupt-${id}:start`);
    await page.mouse.move(1400, 500); await page.mouse.wheel(0, 100);
    await waitReady(); await mark(`interrupt-${id}:end`);
    return;
  }
  // Move the actual pointer throughout the flight, including the hidden-target interval.
  for (let index = 0; index < 50; index++) {
    await page.mouse.move(1400 + Math.sin(index / 8) * 100, 350 + Math.cos(index / 8) * 100);
    await page.waitForTimeout(25);
  }
  await waitReady(id); await mark(`fly-${id}:end`);
  await page.waitForTimeout(250);
}
async function drag(id) {
  await mark(`drag-${id}:start`);
  await page.mouse.move(1050, 640); await page.mouse.down();
  const start = performance.now(), times = [];
  for (let index = 1; index <= 420; index++) {
    const wait = start + index * 1000 / 60 - performance.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    const angle = index / 420 * Math.PI * 4;
    await page.mouse.move(1050 + Math.sin(angle) * 200, 640 + (Math.cos(angle) - 1) * 110);
    times.push(performance.now() - start);
  }
  await page.mouse.up(); report.inputs.push({ type: 'drag', id, dispatchTimesMs: times });
  await mark(`drag-${id}:end`);
}
async function overview() {
  await mark('zoom-overview:start'); await page.mouse.move(1300, 550);
  for (let index = 0; index < 25; index++) {
    if ((await state()).overview) break;
    await page.mouse.wheel(0, 100); await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => window.__cssEarth?.overview && window.__cssEarth?.ready, null, { timeout: 10000 });
  await waitReady(); assert.equal((await state()).overview, true);
  await mark('zoom-overview:end');
}
let tracing = false;
try {
  await page.goto(`${origin}/sun/?overview=solar-system&v=QIZBjIKjn6btvsGPQB0_XT06whyprPsKq7NBQsczQAAAAD_AsoUg3b86v-PhIQDrvVo_2ATC2iqo7QABAAAAAAAAAAA`);
  await waitReady('sun'); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__cssEarthRecorder.start());
  await page.evaluate(() => {
    // This probe fails if input ever falls back to browser scene hit testing.
    document.elementsFromPoint = () => { throw new Error('Scene input forced DOM hit testing'); };
  });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,toplevel,viz', transferMode: 'ReturnAsStream' }); tracing = true;
  await select('haumea'); await drag('haumea'); await overview();
  await select('venus'); await drag('venus'); await overview();
  await select('mars', true);
  await overview(); await select('sun');
  await mark('zoom-5au:start'); await scrollToDistance(page, 5 * 149597870.7); await mark('zoom-5au:end');
  await select('uranus'); await drag('uranus');
  await select('saturn');
  await mark('sequence:end'); assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; }
finally {
  if (tracing) {
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end');
    const { stream } = await done, file = await open(`${output}/trace.json`, 'w');
    try {
      for (;;) { const part = await cdp.send('IO.read', { handle: stream }); await file.write(part.data); if (part.eof) break; }
    } finally { await file.close(); await cdp.send('IO.close', { handle: stream }); }
  }
  const diagnostics = await page.evaluate(() => { window.__cssEarthRecorder?.stop(); return window.__cssEarthRecorder?.lastRecording; }).catch(() => null);
  await writeFile(`${output}/diagnostics.json`, JSON.stringify(diagnostics));
  await page.screenshot({ path: `${output}/final.png` });
  report.final = await state(); await Promise.allSettled(responses);
  await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failure) throw new Error(report.failure);
console.log(`INTERACTION CHAIN PASS DPR ${dpr}`);
