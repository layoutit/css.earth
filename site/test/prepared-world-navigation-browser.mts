import type {ObjectRuntimeDiagnostics} from "../env.d.ts";
type FlightCamera=ReturnType<ObjectRuntimeDiagnostics["camera"]["state"]>;
type FlightSample={time:number;id:string|undefined;count:number|undefined;distance:FlightCamera["distanceKilometers"];centre:FlightCamera["bodyCenterKilometers"];pose:string|undefined};
declare global {interface Window {__flightDocument:Document;__flightShell:(Element|null)[];__flightSamples:FlightSample[];__flightRaf:number;}}
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4211';
const output = '.local/package-extraction/world-navigation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors:string[] = [], report:unknown[] = [];
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}/mercury/`, { waitUntil: 'networkidle' });
  await ready(page, 'mercury');
  await page.evaluate(() => {
    window.__flightDocument = document;
    window.__flightShell = ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content', '.planet-input-surface'].map(s => document.querySelector(s));
    window.__flightSamples = [];
    const sample = () => {
      const state = window.__cssEarth;
      const camera = state && window.__cssEarth?.object(state.activeObjectId)?.camera.state();
      window.__flightSamples.push({ time: performance.now(), id: state?.activeObjectId,
        count: state?.mountedObjectCount, distance: camera?.distanceKilometers,
        centre: camera?.bodyCenterKilometers, pose: camera?.pose.scene });
      window.__flightRaf = requestAnimationFrame(sample);
    };
    sample();
  });
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']]) {
    const pick = await visibleMarker(page, from, to);
    const before = await page.evaluate(() => ({ time: performance.now(), index: window.__flightSamples.length,
      nodes: document.querySelectorAll('.polycss-camera').length }));
    await page.screenshot({ path: `${output}/${from}-marker.png` });
    await page.mouse.click(pick.x, pick.y);
    await ready(page, to);
    const result = await page.evaluate(({ before, to }) => ({
      sameDocument: window.__flightDocument === document,
      sameShell: ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content', '.planet-input-surface']
        .every((s, i) => document.querySelector(s) === window.__flightShell[i]),
      samples: window.__flightSamples.slice(before.index),
      durationMs: performance.now() - before.time,
      url: location.pathname, ready: window.__cssearthTest.scene().ready,
      liveCameraRoots: document.querySelectorAll('.polycss-camera').length,
      oldOwnerGone: !window.__cssEarth?.object(to === 'venus' ? 'mercury' : 'venus'),
      materialReady: window.__cssearthTest.object(to).runtime.selection().ready,
    }), { before, to });
    assert.equal(result.sameDocument, true);
    assert.equal(result.sameShell, true);
    assert.equal(result.url, `/${to}/`);
    assert.equal(result.liveCameraRoots, 1);
    assert.equal(result.oldOwnerGone, true);
    assert.equal(result.materialReady, true);
    assert.ok(result.samples.every(sample => sample.count !== undefined && sample.count <= 1));
    assert.ok(new Set(result.samples.map(sample => sample.distance).filter(Boolean)).size > 10, 'Flight must paint intermediate camera positions.');
    assert.ok(result.durationMs >= 1500 && result.durationMs < 20000);
    report.push({ from, to, pick, ...result });
    await page.screenshot({ path: `${output}/${to}-arrival.png` });
    console.log(`VISIBLE PLANET FLIGHT PASS ${from} → ${to}: ${result.samples.length} frames, ${Math.round(result.durationMs)}ms`);
  }
  assert.deepEqual(errors, []);
  console.log('WORLD NAVIGATION PASS: both rendered planet clicks fly in one document with one mounted object and retained shell');
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ report, errors }, null, 2));
  await browser.close();
}

async function ready(page: Page, id:string) {
  await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id,
    id, { timeout: 30000 });
}
async function visibleMarker(page: Page, from:string, to:string) {
  for (const distance of [5e6, 1e7, 2e7, 5e7]) for (let yaw = 0; yaw < 360; yaw += 30) {
    const point = await page.evaluate(({ from, to, distance, yaw }) => {
      window.__cssearthTest.object(from).camera.setState({ distance,
        pose: { schema: 'cssearth-camera-pose@2', scene: new DOMMatrix().rotateAxisAngle(1, 0, 0, 35).rotateAxisAngle(0, 1, 0, yaw).toString() } });
      const target = document.querySelector(`.planet-heliocentric-body-target[data-body="${to}"]`);
      if (!target || window.__cssearthTest.htmlElement(target).hidden || window.__cssearthTest.htmlElement(target).style.pointerEvents === 'none') return null;
      const bounds = target.getBoundingClientRect(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      if (x < 380 || x > innerWidth - 50 || y < 80 || y > innerHeight - 100) return null;
      if (!document.elementFromPoint(x,y)?.closest('.planet-input-surface')) return null;
      return { x, y, distance, yaw };
    }, { from, to, distance, yaw });
    if (point) return point;
  }
  throw new Error(`No visible ${to} marker found in the ${from} vault.`);
}
