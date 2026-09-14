import type {ObjectRuntimeDiagnostics} from '../env.d.ts';
type ResourceState=ReturnType<ObjectRuntimeDiagnostics['runtime']['resources']>;
declare global {interface Window {__decodedImages:{url:string;time:number}[];__firstMaterial?:{required:readonly string[];pools:ResourceState['pools']};}}

import { required } from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mts';
import { browserObjects } from './browser-objects.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/navigation-resources';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors:string[] = [];
try {
  for (const dpr of [1, 2]) {
    const page = await createTestPage(browser, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    // Every registered body exercises the preflight address resolver against
    // its real mounted camera, including default, rotated and coarse views.
    for (const object of browserObjects()) {
      await page.goto(`${origin}/${object.id}/`);
      await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth?.object(id)?.ready, object.id);
      const checks = await page.evaluate(async ({ id, frame }) => {
        const testingUrl='/src/renderers/css/dist/testing.js',rendererUrl='/src/renderers/css/dist/index.js';
        const { createObjectViewDemand, resolvePreparedPresentation, initialObjectSelection }:typeof import('../../src/renderers/css/dist/testing.js') = await import(testingUrl);
        const {loadPreparedCssObject}:typeof import('../../src/renderers/css/dist/index.js')=await import(rendererUrl);
        // The transport references shared banks; load it the way the application does.
        const descriptor:unknown=await (await fetch(`/src/objects/${id}/object.json`)).json();
        const definition = await loadPreparedCssObject(descriptor, { read: async url => (await fetch(`/src/objects/${id}/${url}`)).arrayBuffer(), sharedUrl: '/shared' });
        const demand = createObjectViewDemand(definition, window.__cssearthTest.required(frame,"world frame")), owner = window.__cssearthTest.object(id);
        const checks = [];
        for (const [pitch, yaw, scale] of [[0, 0, 1], [47, 123, 1], [-76, -215, .001]]) {
          const state = owner.camera.state();
          owner.camera.setState({ controlPitch: definition.camera.defaultControlPitchDegrees + pitch,
            controlYaw: definition.camera.defaultControlYawDegrees + yaw, zoom: state.zoom * scale });
          const world = owner.camera.captureWorldCamera(window.__cssearthTest.required(frame,"world frame"));
          // Navigation applies this same physical pose across object owners.
          owner.camera.applyWorldCamera(world, window.__cssearthTest.required(frame,"world frame"));
          const view = window.__cssearthTest.required(owner.runtime.view(),"published view");
          const predicted = demand({ world, viewport: { focalPixels: window.__cssearthTest.number(view.focal,"focal length"), principalOffsetPixels: [window.__cssearthTest.number(view.principalOffset?.[0],"principal x"),window.__cssearthTest.number(view.principalOffset?.[1],"principal y")] } });
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
        let diagnostic:ObjectRuntimeDiagnostics|undefined;
        delete window.__firstMaterial;
        Object.defineProperty(window, `__${id}`, { configurable: true,
          get: () => diagnostic, set(value:ObjectRuntimeDiagnostics|undefined) {
            diagnostic = value;
            if (value && !window.__firstMaterial) window.__firstMaterial = {
              required: window.__cssearthTest.required(value.runtime.selection().plan,"initial material plan").required,
              pools: value.runtime.resources().pools,
            };
          } });
      }, id);
      await page.locator('.planet-sidebar-search').fill(required(OBJECTS.find(object => object.id === id)).name);
      await page.locator(`.planet-object-link[data-object-id="${id}"]`).click();
      await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id, id);
      const preparation = await page.evaluate(async id => {
        const rendererUrl="/src/renderers/css/dist/index.js";
        const {loadPreparedCssObject}:typeof import("../../src/renderers/css/dist/index.js")=await import(rendererUrl);
        const descriptor:unknown=await (await fetch(`/src/objects/${id}/object.json`)).json();
        const definition = await loadPreparedCssObject(descriptor, { read: async url => (await fetch(`/src/objects/${id}/${url}`)).arrayBuffer(), sharedUrl: '/shared' });
        const handoff = window.__cssearthTest.required(performance.getEntriesByType('mark').findLast(entry => entry.name.endsWith(':handoff')),'handoff mark').startTime;
        const material=window.__cssearthTest.required(window.__firstMaterial,"first material");
        return { handoff, pools: material.pools,
          resources: material.required.map(key => {
            const url = new URL(window.__cssearthTest.required(definition.assets.entries.find(entry => entry.key === key),"required asset").url, location.origin).href;
            const decoded = window.__decodedImages.find(entry => entry.url === url);
            return { key, url, decoded: decoded?.time ?? null };
          }) };
      }, id);
      assert.ok(preparation.resources.length > 0);
      for (const resource of preparation.resources) assert.ok(resource.decoded !== null && resource.decoded <= preparation.handoff,
        `${id} DPR ${dpr}: ${resource.key} must decode before handoff`);
      for (const pool of preparation.pools) assert.ok(pool.resident <= pool.capacity, `${id}: bounded ${pool.id}`);
      assert.equal(await page.evaluate(() => window.__cssearthTest.scene().mountedObjectCount), 1);
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
