import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mjs';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const sourcePath = '/sun/?overview=solar-system&v=QMa8GhQkxq0kCjwwjGyvKEVkwdEH0KlHMa5BQsczQAAAAD_NAzq-TAs4v9ZvIAwo9nM_43yA9Ilr5wABAAAAAAAAAAA';
const output = 'output/playwright/navigation-capacity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    // Navigation catches preparation errors, so pageerror alone misses this regression.
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin + sourcePath);
    await ready(page, 'sun');
    for (const object of OBJECTS) {
      const bank = await page.evaluate(async ({ id, sourceFrame }) => {
        const { loadPackagedObject } = await import('/site/packaged-object-runtime.mjs');
        const descriptor = await (await fetch(`/src/planets/${id}/object.json`)).json();
        const factory = await loadPackagedObject(descriptor);
        const source = window.__sun.camera;
        const state = source.state(), frame = factory.navigation.frame;
        const viewport = { widthPixels: 1280, heightPixels: 1100, focalPixels: state.focal, principalOffsetPixels: state.principalOffset };
        let view = { world: source.captureWorldCamera(sourceFrame), viewport };
        const prepared = await factory.navigation.prepare({ signal: new AbortController().signal, getView: () => view });
        let adopted;
        try {
          // Ready but still unpublished: replace the entire view twice before claim.
          // This exercises actual residency, not just equality of address resolvers.
          for (const angle of [1.3, -2.1]) {
            view = { viewport, world: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
              pose: { positionM: frame.originM.map((value, axis) => value + (axis === 2 ? frame.bodyRadiusM * 5 : 0)),
                orientationXyzw: [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)] } } };
            await prepared.prepareView(() => view);
          }
          adopted = prepared.resources.claim(prepared.definition.assets, {});
          const stats = adopted.stats();
          return { id, pools: stats.pools.map(({ id, resident, nativeSlots, capacity }) => ({ id, resident, nativeSlots, capacity })),
            committed: stats.committed, allReady: stats.committed.every(key => adopted.resources.has(key)), scenes: document.querySelectorAll('.polycss-camera').length };
        } finally { adopted?.destroy(); prepared.destroy(); }
      }, { id: object.id, sourceFrame: OBJECTS.find(object => object.id === 'sun').worldFrame });
      for (const pool of bank.pools) { assert.ok(pool.resident <= pool.capacity); assert.ok(pool.nativeSlots <= pool.capacity); }
      assert.equal(bank.allReady, true); assert.equal(bank.scenes, 1);
      results.push({ dpr, type: 'bank', ...bank });
      console.log(`BANK PASS ${object.id} DPR ${dpr}: startup, two view replacements, claim within capacity`);
    }
    // Real flights on the small lighting pools, plus a full default body bank.
    for (const id of ['mars', 'mercury', 'earth', 'saturn', 'haumea', 'makemake', 'eris']) {
      await page.goto(origin + sourcePath); await ready(page, 'sun');
      const object = OBJECTS.find(object => object.id === id);
      await page.locator('.planet-sidebar-search').fill(object.name);
      await page.evaluate(id => {
        window.__flightSelections = [];
        window.__flightCard = null;
        document.addEventListener('click', () => {
          window.__flightCard = document.querySelector('.planet-information-panel').firstChild;
          window.__initialSelection = window.__cssEarth.selectedObjectId;
          window.__sampling = true;
          const sample = () => {
            if (!window.__sampling) return;
            window.__flightSelections.push({ selected: window.__cssEarth.selectedObjectId, mounted: window.__cssEarth.mountedObjectCount,
              retainedCard: document.querySelector('.planet-information-panel').firstChild === window.__flightCard });
            requestAnimationFrame(sample);
          }; sample();
        }, { once: true });
      }, id);
      await page.locator(`.planet-object-link[data-object-id="${id}"]`).click();
      await ready(page, id);
      const flight = await page.evaluate(id => {
        window.__sampling = false;
        return { id, initial: window.__initialSelection, samples: window.__flightSelections,
          phases: performance.getEntriesByType('mark').filter(mark => mark.name.startsWith('cssEarth:navigation:')).map(mark => mark.name.split(':').at(-1)),
          pools: window[`__${id}`].runtime.resources().pools };
      }, id);
      assert.equal(flight.initial, id);
      assert.ok(flight.samples.length > 10);
      assert.ok(flight.samples.every(sample => sample.selected === id && sample.retainedCard && sample.mounted <= 1));
      assert.ok(flight.phases.includes('finished')); assert.ok(!flight.phases.includes('failed')); assert.ok(!flight.phases.includes('cancelled'));
      for (const pool of flight.pools) assert.ok(pool.resident <= pool.capacity);
      if (id === 'mars' || id === 'mercury') assert.equal(flight.pools.find(pool => pool.id === 'lighting').capacity, 3);
      await page.screenshot({ path: `${output}/${id}-dpr-${dpr}.png` });
      results.push({ dpr, type: 'flight', ...flight });
      console.log(`FLIGHT PASS ${id} DPR ${dpr}: no reset, retained card, bounded pools`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
async function ready(page, id) {
  await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id && window[`__${id}`]?.ready, id, { timeout: 30000 });
}
console.log(`NAVIGATION CAPACITY PASSED ${results.length} checks`);
