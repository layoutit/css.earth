declare global {interface Window {
__dblNavigations:{id:string;time:number}[];__dblInput:Element|null;__dblSamples:{id:string|undefined;time:number;count:number;starts:number}[];__dblSampling:boolean;
}}

import { required } from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
// Real native pointer gestures exercise the shared input owner in both directions.
// Diagnostics arrange the wide view and measure poses; they never trigger picking.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const output = '.local/navigation-picking-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [], errors:string[] = [];
try {
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']]) {
    const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/${from}/`, { waitUntil: 'networkidle' });
    await ready(page, from);
    await page.evaluate(id => {
      window.__cssearthTest.object(id).camera.setState({ distance: 2e7 });
      window.__dblNavigations = [];
      document.addEventListener('objectnavigate', event => {
        if (!(event instanceof CustomEvent)) throw new Error("Expected navigation event");
        const id=window.__cssearthTest.record(event.detail,"navigation detail").objectId;
        if(typeof id !== "string") throw new Error("Expected navigation object ID");
        window.__dblNavigations.push({ id, time: performance.now() });
      }, { capture: true });
      window.__dblInput = document.querySelector('.planet-input-surface');
    }, from);

    const blanks = [];
    for (const offset of [60, 330]) {
      const point = await page.evaluate(({ id, offset }) => {
        const bounds = window.__cssearthTest.element('.polycss-camera').getBoundingClientRect();
        for (const dy of [10, 40, -40, 100, -100]) {
          const x = bounds.x + bounds.width / 2 + offset, y = bounds.y + bounds.height / 2 + dy;
          if (!document.elementFromPoint(x, y)?.closest('.planet-input-surface')) continue;
          if (document.elementsFromPoint(x, y).some(element =>
            window.__cssearthTest.htmlElement(element).dataset?.objectNavigate && window.__cssearthTest.htmlElement(element).style.pointerEvents === 'auto')) continue;
          return { x, y, offset, radius: window.__cssearthTest.object(id).camera.state().silhouetteRadius };
        }
        return null;
      }, { id: from, offset });
      assert.ok(point, 'blank test point on native input');
      assert.ok(required(point.radius) < 10, 'wide view body is physically tiny');
      const before = await snapshot(page, from);
      await page.mouse.dblclick(point.x, point.y, { delay: 65 });
      await page.waitForTimeout(700);
      const after = await snapshot(page, from);
      assert.deepEqual(after, before, `${from} blank sky double click changes no camera pose or native flight count`);
      blanks.push({ point, before, after });
    }
    console.log(`BLANK SKY PASS ${from}: near drag sphere and wide vault`);

    const pick = await visibleMarker(page, from, to);
    await page.evaluate(() => {
      window.__dblSamples = [];
      window.__dblSampling = true;
      const sample = () => {
        if (!window.__dblSampling) return;
        const id = window.__cssEarth?.activeObjectId;
        window.__dblSamples.push({
          id, time: performance.now(), count: document.querySelectorAll('.polycss-camera').length,
          starts: window.__cssEarth?.object(id)?.camera.stats().dragInertia.surfaceFlyTo?.starts ?? 0,
        });
        requestAnimationFrame(sample);
      };
      sample();
    });
    await page.mouse.dblclick(pick.x, pick.y, { delay: 65 });
    await ready(page, to);
    await page.waitForTimeout(100);
    const flight = await page.evaluate(() => {
      window.__dblSampling = false;
      return {
        events: window.__dblNavigations, samples: window.__dblSamples, path: location.pathname,
        sameInput: window.__dblInput === document.querySelector('.planet-input-surface'), ready: window.__cssearthTest.scene().ready,
        count: document.querySelectorAll('.polycss-camera').length,
      };
    });
    assert.deepEqual(flight.events.map(event => event.id), [to], 'double click selects once');
    assert.equal(flight.path, `/${to}/`);
    assert.equal(flight.count, 1);
    assert.equal(flight.sameInput, true);
    assert.ok(flight.samples.every(sample => sample.count <= 1 && sample.starts === 0),
      'one detailed scene and no competing native surface flight');
    assert.ok(flight.samples.length > 20, 'actual flight continuation paints');

    const dragBefore = await snapshot(page, to);
    const dragPoint = await page.evaluate(() => {
      for (const [x, y] of [[1000, 500], [1100, 600], [850, 650]]) {
        if (document.elementFromPoint(x, y)?.closest('.planet-input-surface')) return { x, y };
      }
      return null;
    });
    assert.ok(dragPoint);
    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x + 70, dragPoint.y + 35, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const dragAfter = await snapshot(page, to);
    assert.notEqual(dragAfter.scene, dragBefore.scene, 'ordinary native drag remains effective');
    report.push({ from, to, blanks, pick, flight, dragBefore, dragAfter });
    console.log(`DOUBLE CLICK FLIGHT PASS ${from} → ${to}: ${flight.samples.length} frames, exactly one selection, drag remains`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('DOUBLE CLICK BROWSER PASS: empty physical sky is inert and visible planets fly exactly once in both directions');
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ report, errors }, null, 2));
  await browser.close();
}

async function ready(page: Page, id:string) {
  await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id,
    id, { timeout: 30000 });
}

async function snapshot(page: Page, id:string) {
  return page.evaluate(id => {
    const camera = window.__cssearthTest.object(id).camera, state = camera.state();
    return {
      scene: state.pose.scene, distance: state.distanceKilometers, bodyCenter: state.bodyCenterKilometers ?? null,
      starts: camera.stats().dragInertia.surfaceFlyTo?.starts ?? 0,
      events: window.__dblNavigations.map(event => event.id),
    };
  }, id);
}

async function visibleMarker(page: Page, from:string, to:string) {
  for (const distance of [5e6, 1e7, 2e7, 5e7]) for (let yaw = 0; yaw < 360; yaw += 30) {
    const result = await page.evaluate(({ from, to, distance, yaw }) => {
      window.__cssearthTest.object(from).camera.setState({ distance,
        pose: { schema: 'cssearth-camera-pose@2',
          scene: new DOMMatrix().rotateAxisAngle(1, 0, 0, 35).rotateAxisAngle(0, 1, 0, yaw).toString() } });
      const target = document.querySelector(`.planet-heliocentric-body-target[data-body="${to}"]`);
      if (!target || window.__cssearthTest.htmlElement(target).hidden || window.__cssearthTest.htmlElement(target).style.pointerEvents === 'none') return null;
      const bounds = target.getBoundingClientRect(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      if (x < 380 || x > innerWidth - 50 || y < 80 || y > innerHeight - 100 ||
        !document.elementFromPoint(x, y)?.closest('.planet-input-surface')) return null;
      return { x, y, distance, yaw };
    }, { from, to, distance, yaw });
    if (result) return result;
  }
  throw new Error(`No visible ${to} marker from ${from}`);
}
