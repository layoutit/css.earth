import { required } from '../../tools/test-values.mts';
import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
import { requireRecord, requireString } from '../../tools/source-values.mts';
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
// Paired final builds, with saved URLs obtained through native interactions.
// Reload the same URL on both sides before comparing, so serialization precision
// cannot masquerade as a renderer difference. No camera APIs set a test pose.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scrollToDistance } from './wheel-zoom-distance.mts';

const referenceOrigin = process.env.REFERENCE_ORIGIN ?? 'http://127.0.0.1:4222';
const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const ids = (process.env.OBJECTS ?? 'deimos,phobos,phoebe').split(',');
const dpr = Number(process.env.DPR ?? 1);
const output = process.env.OUTPUT ?? `output/playwright/prepared-depth-visual-${dpr}`;
for (const directory of ['reference', 'repeat', 'candidate']) await mkdir(`${output}/${directory}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const options = { viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr };
const reference = await createTestPage(browser, options), candidate = await createTestPage(browser, options);
const report: {origin:string;referenceOrigin:string;dpr:number;browser:string;frames:unknown[];errors:string[];failure?:string} = { origin, referenceOrigin, dpr, browser: browser.version(), frames: [], errors: [] };
type PreparedEvidence = {sha256:string;groups:number;faces:number};
const prepared = new Map<string,PreparedEvidence>(), pending:Promise<void>[] = [];
for (const page of [reference, candidate]) {
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
    if (!/\/object\.[^/]+\.json$/.test(response.url())) return;
    pending.push(response.body().then(bytes => {
      const payload = requireRecord(JSON.parse(bytes.toString('utf8')));
      const data = parsePreparedObjectRuntime(payload.data);
      prepared.set(`${new URL(response.url()).origin}:${requireString(payload.id)}`, {
        sha256: createHash('sha256').update(bytes).digest('hex'), groups: data.depthPartitions?.groups.length ?? 0,
        faces: data.surfaceHit?.triangles.length ?? 0,
      });
    }));
  });
}
async function ready(page: Page) {
  await page.waitForFunction(() => window.__cssEarth?.error || window.__cssEarth?.ready, null, { timeout: 40000 });
  assert.equal(await page.evaluate(() => window.__cssearthTest.scene().error), null);
  await page.waitForTimeout(500);
}
const camera = (page: Page) => page.evaluate(() => window.__cssearthTest.physicalCamera());
async function drag() {
  await reference.mouse.move(1200, 590); await reference.mouse.down();
  for (let i = 1; i <= 60; i++) { await reference.mouse.move(1200 - i * 3, 590 - i); await reference.waitForTimeout(20); }
  await reference.mouse.up(); await reference.waitForTimeout(600);
}
try {
  for (const id of ids) {
    await reference.setViewportSize(options.viewport); await candidate.setViewportSize(options.viewport);
    await reference.goto(`${referenceOrigin}/${id}/`); await ready(reference);
    const initial = await camera(reference);
    await scrollToDistance(reference, initial.distanceKilometers * required(initial.silhouetteRadius) / 350);
    const nearDistance = (await camera(reference)).distanceKilometers;
    const lenses = await reference.locator('button[name="lens"]').evaluateAll(nodes => nodes.map(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Expected lens button'); return node.value; }));
    const defaultLens = await reference.locator('.planet-stage').getAttribute('data-lens');
    let lens = defaultLens;
    for (const action of ['near', 'orbit', 'dataset', 'marker', 'return', 'resize']) {
      if (action === 'orbit') await drag();
      if (action === 'dataset') lens = lenses.find(value => value !== defaultLens) ?? defaultLens;
      if (action === 'marker') await scrollToDistance(reference, nearDistance * 200);
      if (action === 'return') await scrollToDistance(reference, nearDistance);
      if (action === 'resize') { await reference.setViewportSize({ width: 1280, height: 800 }); await candidate.setViewportSize({ width: 1280, height: 800 }); }
      await reference.waitForTimeout(600);
      const url = reference.url();
      await reference.goto(url); await ready(reference);
      await candidate.goto(url.replace(referenceOrigin, origin)); await ready(candidate);
      // Saved view URLs encode the camera. Apply the dataset through its real
      // control on both pages after reloading that camera.
      if (lens !== defaultLens) for (const page of [reference, candidate]) {
        await page.locator(`button[name="lens"][value="${lens}"]`).click();
        await page.locator(`button[name="lens"][value="${lens}"][aria-pressed="true"]`).waitFor();
        await page.locator('.planet-lenses[aria-busy="false"]').waitFor();
        await page.waitForTimeout(250);
      }
      const before = await camera(reference), after = await camera(candidate);
      await Promise.all(pending);
      const source = prepared.get(`${referenceOrigin}:${id}`), loaded = prepared.get(`${origin}:${id}`);
      assert.ok(source && loaded, 'Both actual prepared payloads must be identified');
      assert.equal(loaded.faces, source.faces, 'Every original source face survives');
      assert.deepEqual(after, before, `${id} ${action}: both builds must use exactly the same camera`);
      const index = report.frames.length, filename = `${String(index).padStart(6, '0')}.png`;
      await reference.screenshot({ path: `${output}/reference/${filename}` });
      await reference.screenshot({ path: `${output}/repeat/${filename}` });
      await candidate.screenshot({ path: `${output}/candidate/${filename}` });
      const publication = await candidate.evaluate(id => {
        const root = window.__cssearthTest.element('.polycss-camera'), scene = window.__cssearthTest.element('.polycss-scene',root);
        const groups = [...root.children].filter(node => window.__cssearthTest.htmlElement(node).style.contain === 'paint');
        return { groups: groups.length, sceneCount: document.querySelectorAll('.planet-stage > .polycss-camera').length,
          sharedCamera: groups.every(group => window.__cssearthTest.htmlElement(group.firstElementChild).style.transform === window.__cssearthTest.htmlElement(scene).style.transform && window.__cssearthTest.htmlElement(group.firstElementChild).hidden === window.__cssearthTest.htmlElement(scene).hidden),
          images: [...new Set([...root.querySelectorAll(`.${id}-body > u`)].map(node => getComputedStyle(node).backgroundImage))],
          lens: window.__cssearthTest.html('.planet-stage').dataset.lens };
      }, id);
      assert.equal(publication.sceneCount, 1); assert.equal(publication.sharedCamera, true); assert.equal(publication.groups, loaded.groups);
      assert.ok(publication.images.every(image => image !== 'none'));
      assert.equal(publication.lens, lens);
      report.frames.push({ index, id, action, url, camera: before, publication, source, loaded, lenses });
      console.log(`PAIRED VIEW ${id} ${action} DPR ${dpr}`);
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
if (report.failure) throw new Error(report.failure);
