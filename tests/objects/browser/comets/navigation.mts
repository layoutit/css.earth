import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { OBJECTS } from '../../../../site/objects.mts';
const origin = process.argv[2] ?? 'http://127.0.0.1:4258';
const comets = OBJECTS.filter(object => object.classification === 'comet');
assert.ok(comets.length > 0);
const browser = await chromium.launch({ channel: 'chrome', headless: true }), reports = [], errors = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await page.goto(`${origin}/earth/`, { waitUntil: 'networkidle' });
    await ready(page, 'earth');
    await page.evaluate(() => {
      const selectors = ['.planet-stage', '.planet-sidebar', '.planet-input-surface', '.prepared-universe'];
      const probe = window.__cometNavigation = { document, selectors, nodes: selectors.map(s => document.querySelector(s)),
        universe: [...document.querySelector('.prepared-universe').querySelectorAll('*')], maxScenes: 1 };
      probe.observer = new MutationObserver(() => { probe.maxScenes = Math.max(probe.maxScenes, document.querySelectorAll('.polycss-scene').length); });
      probe.observer.observe(document.querySelector('.planet-stage'), { childList: true, subtree: true });
    });
    const visits = [];
    for (const object of [...comets, OBJECTS.find(o => o.id === 'earth'), ...comets]) {
      await page.locator('.planet-sidebar-search').fill(object.name);
      await page.locator(`a.planet-object-link[data-object-id="${object.id}"]`).click();
      await ready(page, object.id);
      const state = await page.evaluate(() => {
        const probe = window.__cometNavigation, universe = [...document.querySelector('.prepared-universe').querySelectorAll('*')];
        return { documentRetained: document === probe.document, shellRetained: probe.selectors.every((s, i) => document.querySelector(s) === probe.nodes[i]),
          universeRetained: universe.length === probe.universe.length && universe.every((n, i) => n === probe.universe[i]),
          scenes: document.querySelectorAll('.polycss-scene').length, maxScenes: probe.maxScenes,
          nodes: document.querySelector('.planet-stage').querySelectorAll('*').length,
          styleCount: document.head.querySelectorAll('style,link[rel="stylesheet"]').length };
      });
      assert.ok(state.documentRetained && state.shellRetained && state.universeRetained);
      assert.equal(state.scenes, 1); assert.equal(state.maxScenes, 1);
      const prior = visits.find(v => v.id === object.id);
      if (prior) { assert.equal(state.nodes, prior.nodes); assert.equal(state.styleCount, prior.styleCount); }
      visits.push({ id: object.id, ...state });
    }
    await page.evaluate(() => window.__cometNavigation.observer.disconnect());
    reports.push({ dpr, visits }); await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await mkdir('output/comet-navigation', { recursive: true });
  await writeFile('output/comet-navigation/report.json', JSON.stringify({ browser: browser.version(), reports, errors }, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${comets.length} registry-derived comets: DPR 1 and 2, retained shell and universe, one scene throughout.`);
async function ready(page, id) {
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    document.querySelector('.planet-stage').dataset.objectId === id && location.pathname === `/${id}/`, id, { timeout: 60000 });
}
