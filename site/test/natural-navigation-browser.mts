interface NaturalReport {head:string;browser:string;dpr:number;origin:string;actions:Record<string,unknown>[];errors:string[];failure?:string;final?:unknown;}
declare global {interface Window {__naturalIdentity:readonly[Element|null,Element|null,number];}}

import {required} from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
// A short user journey: wide system → Mars → Venus → wide system → Makemake.
// All navigation is native input. Diagnostic APIs only observe state.
import assert from 'node:assert/strict';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const output = process.env.OUTPUT ?? 'output/playwright/natural-navigation';
const dpr = Number(process.env.DPR ?? 1);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const page = await createTestPage(browser, { viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
const cdp = await page.context().newCDPSession(page);
const report:NaturalReport = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), dpr, origin, actions: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => ({ active: window.__cssearthTest.scene().activeObjectId, selected: window.__cssearthTest.scene().selectedObjectId,
  ready: window.__cssearthTest.scene().ready, error: window.__cssearthTest.scene().error, overview: window.__cssearthTest.scene().overview,
  camera: window.__cssEarth?.object()?.camera.state(),
  scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length, url: location.href }));
async function mark(kind:string, data:Record<string,unknown> = {}) {
  report.actions.push({ kind, ...data, state: await state() });
  await page.evaluate(({ kind, index }) => performance.mark(`cssEarth:stress:${index}:${kind}`), { kind, index: report.actions.length - 1 });
  console.log(kind, JSON.stringify(data));
}
async function ready(id?:string) {
  await page.waitForFunction(id => window.__cssEarth?.error || (window.__cssEarth?.ready && (!id || window.__cssearthTest.scene().activeObjectId === id)), id, { timeout: 40000 });
  const current = await state(); assert.equal(current.error, null); assert.equal(current.scenes, 1);
}
async function visible(id:string) {
  return page.locator(`[data-object-navigate="${id}"][data-context-label], [data-object-navigate="${id}"][data-context-indicator], [data-object-navigate="${id}"][data-context-body]`).evaluateAll(nodes => {
    for (const node of nodes) {
      if (node.ariaDisabled === 'true' || !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (x < 390 || x > innerWidth - 40 || y < 80 || y > innerHeight - 60 || !r.width || !r.height) continue;
      if (!document.elementFromPoint(x, y)?.closest('.planet-input-surface')) continue;
      return { x, y, kind: node.hasAttribute('data-context-label') ? 'label' : 'marker' };
    }
    return null;
  });
}
async function drag(dx:number, dy:number, duration = 1600) {
  await mark('drag-start', { dx, dy, duration });
  await page.mouse.move(1200, 590); await page.mouse.down();
  const start = performance.now(), count = Math.ceil(duration / (1000 / 60));
  for (let i = 1; i <= count; i++) {
    const wait = start + duration * i / count - performance.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    const fraction = (1 - Math.cos(Math.PI * i / count)) / 2;
    await page.mouse.move(1200 + dx * fraction, 590 + dy * fraction);
  }
  await page.mouse.up(); await mark('drag-end'); await page.waitForTimeout(450);
}
async function scroll(sign:number, strength = 1) {
  const deltas = [2, 6, 12, 20, 28, 32, 28, 20, 12, 6, 2].map(value => sign * value * strength);
  await mark('precision-wheel-start', { deltas });
  await page.mouse.move(1250, 580);
  for (const delta of deltas) { await page.mouse.wheel(0, delta); await page.waitForTimeout(20); }
  await page.waitForTimeout(350); await mark('precision-wheel-end');
}
async function clickScene(id:string, allowSearch = false) {
  const point = await visible(id);
  if (!point && allowSearch) {
    await mark('pick', { id, target: { kind: 'sidebar' } });
    await page.locator('.planet-sidebar-search').fill(id);
    await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).first().click();
    await ready(id); await mark('landed', { id }); await page.waitForTimeout(600);
    await page.screenshot({ path: `${output}/${id}.png` }); return;
  }
  assert.ok(point, `${id} must be visible in the scene`);
  await mark('pick', { id, target: point });
  await page.mouse.move(point.x, point.y); await page.waitForTimeout(200);
  // Re-read after hover because labels can move when their marker grows.
  const current = await visible(id); assert.ok(current, `${id} remains visible after hover`);
  await page.mouse.click(current.x, current.y);
  await ready(id); await mark('landed', { id });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${output}/${id}.png` });
}
let tracing = false;
try {
  await page.goto(`${origin}/sun/?overview=solar-system&v=QMbBjrZTdiHH30GM5sCQv8l4wiAhrbgbkXxBQsczQAAAAD_Kd0sE6289P8zJjb7eDje_4KrSDNFvFQABAAAAAAAAAAA`);
  await ready('sun'); await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__naturalIdentity = [document.querySelector('.prepared-universe'), document.querySelector('.planet-input-surface'), performance.timeOrigin];
    window.__cssearthTest.required(window.__cssEarthRecorder,"diagnostic recorder").start();
  });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,toplevel,viz', transferMode: 'ReturnAsStream' }); tracing = true;
  await mark('start');
  for (let attempt = 0; attempt < 10 && !await visible('mars'); attempt++) await scroll(-1);
  await clickScene('mars');
  await scroll(-1, .12); await drag(130, -45, 1900);
  await clickScene('venus', true);
  await drag(-110, 50, 1500);
  await mark('zoom-out-start');
  for (let attempt = 0; attempt < 24; attempt++) {
    if ((await state()).overview && await visible('makemake')) break;
    await scroll(1);
    if (!(await state()).ready) await ready();
  }
  await ready(); await mark('zoom-out-end');
  assert.equal((await state()).overview, true);
  for (let attempt = 0; attempt < 6 && !await visible('makemake'); attempt++) await drag(-190, attempt % 2 ? -60 : 60, 1100);
  await clickScene('makemake'); await drag(85, 30, 1400);
  await mark('finished');
  const retained = await page.evaluate(() => window.__naturalIdentity[0] === document.querySelector('.prepared-universe') &&
    window.__naturalIdentity[1] === document.querySelector('.planet-input-surface') && window.__naturalIdentity[2] === performance.timeOrigin);
  assert.equal(retained, true); assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
finally {
  if (tracing) {
    const done = new Promise<string>((resolve,reject)=>cdp.once('Tracing.tracingComplete',event=>{if(typeof event.stream==='string')resolve(event.stream);else reject(new Error('Trace stream unavailable'));})); await cdp.send('Tracing.end');
    const stream = await done, file = await open(`${output}/trace.json`, 'w');
    try { for (;;) { const part = await cdp.send('IO.read', { handle: stream }); await file.write(part.data); if (part.eof) break; } }
    finally { await file.close(); await cdp.send('IO.close', { handle: stream }); }
  }
  report.final = await state().catch(() => null);
  const diagnostics = await page.evaluate(() => { window.__cssEarthRecorder?.stop(); return window.__cssEarthRecorder?.lastRecording; }).catch(() => null);
  await writeFile(`${output}/diagnostics.json`, JSON.stringify(diagnostics));
  await page.screenshot({ path: `${output}/final.png` }).catch(() => {});
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.failure) throw new Error(report.failure);
console.log('NATURAL JOURNEY PASS');
