import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { selectObject } from './navigate-object.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4212';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
type ProductionSample = {count:number;transform:string|undefined;opacity:number;universes:number};
declare global { interface Window { __productionDocument:Document; __productionShell:Element|null;
  __productionSamples:ProductionSample[]; __productionFrame:number; } }
const errors:string[] = [];
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/mercury/`, { waitUntil: 'networkidle' });
  await ready(page, 'mercury');
  await page.evaluate(() => {
    window.__productionDocument = document;
    window.__productionShell = document.querySelector('.planet-sidebar');
  });
  for (const id of ['venus', 'mercury']) {
    await page.evaluate(() => {
      window.__productionSamples = [];
      const sample = () => {
        const stage = window.__cssearthTest.element('.planet-stage');
        // The shared world presents beside the detail stage and owns the loading opacity.
        const world = window.__cssearthTest.element('.planet-world-stage');
        const scene = document.querySelector<HTMLElement>('.planet-stage [class$="-scene"]');
        window.__productionSamples.push({ count: document.querySelectorAll('.polycss-camera').length,
          transform: scene?.style.transform,
          opacity: Number(getComputedStyle(window.__cssearthTest.required(stage, 'computed style element')).opacity)
            * Number(getComputedStyle(window.__cssearthTest.required(world, 'computed style element')).opacity),
          universes: world?.querySelectorAll('.prepared-universe').length ?? 0 });
        window.__productionFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    await selectObject(page, id);
    await ready(page, id);
    const result = await page.evaluate(id => {
      cancelAnimationFrame(window.__productionFrame);
      return { document: window.__productionDocument === document,
        shell: window.__productionShell === document.querySelector('.planet-sidebar'),
        current: window.__cssearthTest.html('.planet-stage').dataset.objectId,
        roots: document.querySelectorAll('.polycss-camera').length,
        assets: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(node => node.href),
        diagnostics: window.__cssEarth !== undefined,
        samples: window.__productionSamples,
      };
    }, id);
    assert.equal(result.document, true); assert.equal(result.shell, true);
    assert.equal(result.current, id); assert.equal(result.roots, 1);
    assert.equal(result.diagnostics, false);
    assert.ok(result.samples.every(sample => sample.count <= 1));
    assert.ok(result.samples.every(sample => sample.opacity === 1 && sample.universes === 1),
      'Production handoffs keep the world fully visible at every painted frame.');
    assert.ok(new Set(result.samples.map(sample => sample.transform).filter(Boolean)).size > 10);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), id[0].toUpperCase() + id.slice(1));
    console.log(`PRODUCTION NAVIGATION PASS ${id}: ${result.samples.length} frames, one scene, retained shell, no diagnostics`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

async function ready(page: Page, id:string) {
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    window.__cssearthTest.html('.planet-stage').dataset.objectId === id && location.pathname === `/${id}/`, id, { timeout: 30000 });
}
