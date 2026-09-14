declare global { interface Window { __cometNavigation: { document: Document; selectors: string[]; nodes: HTMLElement[]; universe: HTMLElement[]; maxScenes: number; observer: MutationObserver }; } }
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { SCENE_OBJECTS } from '../../../../site/objects.mts';
const origin = process.argv[2] ?? 'http://127.0.0.1:4258';
const comets = SCENE_OBJECTS.filter(object => object.classification === 'comet');
assert.ok(comets.length > 0);
const earth = SCENE_OBJECTS.find(o => o.id === 'earth'); assert.ok(earth, 'Earth is registered');
const browser = await chromium.launch({ channel: 'chrome', headless: true }), reports = [], errors: string[] = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await page.goto(`${origin}/earth/`, { waitUntil: 'networkidle' });
    await ready(page, 'earth');
    await page.evaluate(() => {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

      const selectors = ['.planet-stage', '.planet-sidebar', '.planet-input-surface', '.prepared-universe'];
      const probe = { document, selectors, nodes: selectors.map(s => requiredElement(document.querySelector(s))),
        universe: [...requiredElement(document.querySelector('.prepared-universe')).querySelectorAll<HTMLElement>('*')], maxScenes: 1 };
      const observer = new MutationObserver(() => { window.__cometNavigation.maxScenes = Math.max(window.__cometNavigation.maxScenes, document.querySelectorAll<HTMLElement>('.polycss-scene').length); });
      observer.observe(requiredElement(document.querySelector('.planet-stage')), { childList: true, subtree: true });
      window.__cometNavigation = { ...probe, observer };
    });
    const visits: { id: string; nodes: number; styleCount: number; documentRetained: boolean; shellRetained: boolean; universeRetained: boolean; scenes: number; maxScenes: number }[] = [];
    const itinerary: readonly (typeof SCENE_OBJECTS)[number][] = [...comets, earth, ...comets];
    for (const object of itinerary) {
      await page.locator('.planet-sidebar-search').fill(object.name);
      await page.locator(`a.planet-object-link[data-object-id="${object.id}"]`).click();
      await ready(page, object.id);
      const state = await page.evaluate(() => {
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

        const probe = window.__cometNavigation, universe = [...requiredElement(document.querySelector('.prepared-universe')).querySelectorAll<HTMLElement>('*')];
        return { documentRetained: document === probe.document, shellRetained: probe.selectors.every((s, i) => requiredElement(document.querySelector(s)) === probe.nodes[i]),
          universeRetained: universe.length === probe.universe.length && universe.every((n, i) => n === probe.universe[i]),
          scenes: document.querySelectorAll<HTMLElement>('.polycss-scene').length, maxScenes: probe.maxScenes,
          nodes: requiredElement(document.querySelector('.planet-stage')).querySelectorAll<HTMLElement>('*').length,
          styleCount: document.head.querySelectorAll<HTMLElement>('style,link[rel="stylesheet"]').length };
      });
      assert.ok(state.documentRetained && state.shellRetained && state.universeRetained);
      assert.equal(state.scenes, 1); assert.equal(state.maxScenes, 1);
      const prior: (typeof visits)[number] | undefined = visits.find(v => v.id === object.id);
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
async function ready(page: Page, id: string) {
  await page.waitForFunction(id => {
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return document.documentElement.dataset.ready === 'true' &&
    requiredElement(document.querySelector('.planet-stage')).dataset.objectId === id && location.pathname === `/${id}/`; }, id, { timeout: 60000 });
}
