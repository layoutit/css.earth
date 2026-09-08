// Paired final builds, with saved URLs obtained through native interactions.
// Reload the same URL on both sides before comparing, so serialization precision
// cannot masquerade as a renderer difference. No camera APIs set a test pose.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { scrollToDistance } from './wheel-zoom-distance.mjs';

const referenceOrigin = process.env.REFERENCE_ORIGIN ?? 'http://127.0.0.1:4222';
const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const ids = (process.env.OBJECTS ?? 'deimos,phobos,phoebe').split(',');
const dpr = Number(process.env.DPR ?? 1);
const output = process.env.OUTPUT ?? `output/playwright/prepared-depth-visual-${dpr}`;
for (const directory of ['reference', 'repeat', 'candidate']) await mkdir(`${output}/${directory}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const options = { viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr };
const reference = await browser.newPage(options), candidate = await browser.newPage(options);
const report = { origin, referenceOrigin, dpr, browser: browser.version(), frames: [], errors: [] };
for (const page of [reference, candidate]) page.on('pageerror', error => report.errors.push(error.message));
async function ready(page) {
  await page.waitForFunction(() => window.__cssEarth?.error || window.__cssEarth?.ready, null, { timeout: 40000 });
  assert.equal(await page.evaluate(() => window.__cssEarth.error), null);
  await page.waitForTimeout(500);
}
const camera = page => page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.state());
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
    await scrollToDistance(reference, initial.distanceKilometers * initial.silhouetteRadius / 350);
    const nearDistance = (await camera(reference)).distanceKilometers;
    let lens = 'normal';
    for (const action of ['near', 'orbit', 'dataset', 'marker', 'return', 'resize']) {
      if (action === 'orbit') await drag();
      if (action === 'dataset') lens = 'elevation';
      if (action === 'marker') await scrollToDistance(reference, nearDistance * 200);
      if (action === 'return') await scrollToDistance(reference, nearDistance);
      if (action === 'resize') { await reference.setViewportSize({ width: 1280, height: 800 }); await candidate.setViewportSize({ width: 1280, height: 800 }); }
      await reference.waitForTimeout(600);
      const url = reference.url();
      await reference.goto(url); await ready(reference);
      await candidate.goto(url.replace(referenceOrigin, origin)); await ready(candidate);
      // Saved view URLs encode the camera. Apply the dataset through its real
      // control on both pages after reloading that camera.
      if (lens !== 'normal') for (const page of [reference, candidate]) {
        await page.locator(`button[name="lens"][value="${lens}"]`).click();
        await page.locator(`button[name="lens"][value="${lens}"][aria-pressed="true"]`).waitFor();
        await page.locator('.planet-lenses[aria-busy="false"]').waitFor();
        await page.waitForTimeout(250);
      }
      const before = await camera(reference), after = await camera(candidate);
      assert.deepEqual(after, before, `${id} ${action}: both builds must use exactly the same camera`);
      const index = report.frames.length, filename = `${String(index).padStart(6, '0')}.png`;
      await reference.screenshot({ path: `${output}/reference/${filename}` });
      await reference.screenshot({ path: `${output}/repeat/${filename}` });
      await candidate.screenshot({ path: `${output}/candidate/${filename}` });
      const publication = await candidate.evaluate(id => {
        const root = document.querySelector('.polycss-camera'), scene = root.querySelector('.polycss-scene');
        const groups = [...root.children].filter(node => node.style.contain === 'paint');
        return { groups: groups.length, sceneCount: document.querySelectorAll('.planet-stage > .polycss-camera').length,
          sharedCamera: groups.every(group => group.firstElementChild.style.transform === scene.style.transform && group.firstElementChild.hidden === scene.hidden),
          images: [...new Set([...root.querySelectorAll(`.${id}-body > u`)].map(node => getComputedStyle(node).backgroundImage))],
          lens: document.querySelector('.planet-stage').dataset.lens };
      }, id);
      assert.equal(publication.sceneCount, 1); assert.equal(publication.sharedCamera, true); assert.equal(publication.groups, 32);
      assert.ok(publication.images.every(image => image !== 'none'));
      assert.equal(publication.lens, lens);
      report.frames.push({ index, id, action, url, camera: before, publication });
      console.log(`PAIRED VIEW ${id} ${action} DPR ${dpr}`);
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
if (report.failure) throw new Error(report.failure);
