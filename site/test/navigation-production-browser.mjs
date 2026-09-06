import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4212';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
        const stage = document.querySelector('.planet-stage');
        const scene = document.querySelector('.planet-stage [class$="-scene"]');
        window.__productionSamples.push({ count: document.querySelectorAll('.polycss-camera').length,
          transform: scene?.style.transform, opacity: Number(getComputedStyle(stage).opacity),
          skies: stage.querySelectorAll('.planet-cubic-sky').length,
          vaults: stage.querySelectorAll('.planet-heliocentric-sky').length });
        window.__productionFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    await page.locator(`.scale-planet[data-planet-id="${id}"] a`).click();
    await ready(page, id);
    const result = await page.evaluate(id => {
      cancelAnimationFrame(window.__productionFrame);
      return { document: window.__productionDocument === document,
        shell: window.__productionShell === document.querySelector('.planet-sidebar'),
        current: document.querySelector('.planet-stage').dataset.objectId,
        roots: document.querySelectorAll('.polycss-camera').length,
        assets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(node => node.href),
        diagnostics: window.__cssEarth !== undefined,
        samples: window.__productionSamples,
      };
    }, id);
    assert.equal(result.document, true); assert.equal(result.shell, true);
    assert.equal(result.current, id); assert.equal(result.roots, 1);
    assert.equal(result.diagnostics, false);
    assert.ok(result.samples.every(sample => sample.count <= 1));
    assert.ok(result.samples.every(sample => sample.opacity === 1 && sample.skies >= 1 && sample.vaults >= 1),
      'Production handoffs keep the world fully visible at every painted frame.');
    assert.ok(new Set(result.samples.map(sample => sample.transform).filter(Boolean)).size > 10);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), id[0].toUpperCase() + id.slice(1));
    console.log(`PRODUCTION NAVIGATION PASS ${id}: ${result.samples.length} frames, one scene, retained shell, no diagnostics`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

async function ready(page, id) {
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    document.querySelector('.planet-stage').dataset.objectId === id && location.pathname === `/${id}/`, id, { timeout: 30000 });
}
