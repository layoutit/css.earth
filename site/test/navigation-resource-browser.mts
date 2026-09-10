import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/navigation-resources';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    // Every registered body exercises the preflight address resolver against
    // its real mounted camera, including default, rotated and coarse views.
    for (const object of OBJECTS) {
      await page.goto(`${origin}/${object.id}/`);
      await page.waitForFunction(id => window.__cssEarth?.ready && window[`__${id}`]?.ready, object.id);
      const checks = await page.evaluate(async ({ id, frame }) => {
        const { createObjectViewDemand, resolvePreparedPresentation, initialObjectSelection } =
          await import('/src/renderers/css/dist/testing.js');
        const definition = (await (await fetch(`/src/planets/${id}/prepared/object.json`)).json()).data;
        const demand = createObjectViewDemand(definition, frame), owner = window[`__${id}`];
        const checks = [];
        for (const [pitch, yaw, scale] of [[0, 0, 1], [47, 123, 1], [-76, -215, .001]]) {
          const state = owner.camera.state();
          owner.camera.setState({ controlPitch: definition.camera.defaultControlPitchDegrees + pitch,
            controlYaw: definition.camera.defaultControlYawDegrees + yaw, zoom: state.zoom * scale });
          const world = owner.camera.captureWorldCamera(frame);
          // Navigation applies this same physical pose across object owners.
          owner.camera.applyWorldCamera(world, frame);
          const view = owner.runtime.view();
          const predicted = demand({ world, viewport: { focalPixels: view.focal, principalOffsetPixels: view.principalOffset } });
          const actual = resolvePreparedPresentation(definition, { selection: initialObjectSelection(definition.controls), view });
          checks.push({ pitch, yaw, scale, predicted, actual });
        }
        return checks;
      }, { id: object.id, frame: object.worldFrame });
      for (const check of checks) assert.deepEqual(check.predicted, check.actual, `${object.id} DPR ${dpr} view ${check.pitch}/${check.yaw}`);
      results.push({ id: object.id, dpr, views: checks.length });
      console.log(`${object.id} DPR ${dpr}: ${checks.length} matching material demands`);
    }
    for (const id of ['saturn', 'ceres', 'earth']) {
      await page.goto(`${origin}/sun/?overview=solar-system&v=QMZBtanKo8iixjxxYIMYX7RAwePn46QAMwJBQsczQAAAAD_E2KUfHzakP9G9rdLKWIG_2AwMFIfdHwABAAAAAAAAAAA`);
      await page.waitForFunction(() => window.__cssEarth?.ready && window.__sun?.ready);
      await page.evaluate(id => {
        window.__decodedImages = [];
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function () {
          const url = this.src;
          return decode.call(this).then(value => {
            window.__decodedImages.push({ url, time: performance.now() });
            return value;
          });
        };
        let diagnostic;
        Object.defineProperty(window, `__${id}`, { configurable: true,
          get: () => diagnostic, set(value) {
            diagnostic = value;
            if (value && !window.__firstMaterial) window.__firstMaterial = {
              required: value.runtime.selection().plan.required,
              pools: value.runtime.resources().pools,
            };
          } });
      }, id);
      await page.locator('.planet-sidebar-search').fill(OBJECTS.find(object => object.id === id).name);
      await page.locator(`.planet-object-link[data-object-id="${id}"]`).click();
      await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id, id);
      const preparation = await page.evaluate(async id => {
        const definition = (await (await fetch(`/src/planets/${id}/prepared/object.json`)).json()).data;
        const handoff = performance.getEntriesByType('mark').findLast(entry => entry.name.endsWith(':handoff')).startTime;
        return { handoff, pools: window.__firstMaterial.pools,
          resources: window.__firstMaterial.required.map(key => {
            const url = new URL(definition.assets.entries.find(entry => entry.key === key).url, location.origin).href;
            const decoded = window.__decodedImages.find(entry => entry.url === url);
            return { key, url, decoded: decoded?.time ?? null };
          }) };
      }, id);
      assert.ok(preparation.resources.length > 0);
      for (const resource of preparation.resources) assert.ok(resource.decoded !== null && resource.decoded <= preparation.handoff,
        `${id} DPR ${dpr}: ${resource.key} must decode before handoff`);
      for (const pool of preparation.pools) assert.ok(pool.resident <= pool.capacity, `${id}: bounded ${pool.id}`);
      assert.equal(await page.evaluate(() => window.__cssEarth.mountedObjectCount), 1);
      results.push({ id, dpr, handoff: preparation });
      console.log(`${id} DPR ${dpr}: all ${preparation.resources.length} initial resources decoded before handoff`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
