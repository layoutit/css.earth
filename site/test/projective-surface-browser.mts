import { createTestPage } from './browser-observations.mts';
// Native camera proof: a prepared surface may only paint inside its projected leaves.
import assert from 'node:assert/strict';
import { required } from '../../tools/test-values.mts';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { wheelWithReceipt } from './wheel-zoom-distance.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://localhost:4210';
const output = '.local/projective-surface-browser';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['jupiter', 'saturn'];
interface SurfaceSample { id: string; pose: string; bounds: { left: number; top: number; right: number; bottom: number; leaves: number }; escapedPixels: number; surfacePixels: number; url: string; }
const report: {samples: SurfaceSample[]; errors: string[]} = { samples: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  for (const id of ids) {
    await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth?.object(id)?.ready, id);
    const motion = page.locator('input[name="motion"]');
    if (await motion.isChecked()) await motion.uncheck({ force: true });
    const bodies = page.locator(`.${id}-body`);
    assert.ok(await bodies.count(), `${id}: actual prepared surface is mounted`);
    for (const pose of ['close', 'rotated']) {
      if (pose === 'rotated') {
        await page.mouse.move(1050, 470);
        const delta = await page.evaluate(id => Math.log(8) / window.__cssearthTest.required(window.__cssearthTest.object(id).camera.stats().dolly, 'dolly diagnostics').wheelStepPerDelta, id);
        await wheelWithReceipt(page, delta);
        await page.waitForFunction(id => !window.__cssearthTest.required(window.__cssearthTest.object(id).camera.stats().dragInertia.wheelZoom, 'wheel zoom diagnostics').active, id);
        await page.mouse.move(1100, 410); await page.mouse.down();
        await page.mouse.move(960, 465, { steps: 12 }); await page.mouse.up();
        await page.waitForTimeout(600);
      }
      // Label fades are independent of surface paint. Require a stable real
      // background before measuring what hiding only the surface changes.
      await page.evaluate(async () => {
        let previous = '', stable = 0;
        for (let sample = 0; sample < 30; sample++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const current = [...document.querySelectorAll('.prepared-star-label')]
            .map(label => `${label.textContent}:${window.__cssearthTest.htmlElement(label).style.opacity}:${window.__cssearthTest.htmlElement(label).style.transform}`).join('|');
          stable = current === previous ? stable + 1 : 0;
          if (stable >= 3) return;
          previous = current;
        }
        throw new Error('Star label background did not settle for the surface paint measurement.');
      });
      const bounds = await bodies.evaluateAll(nodes => {
        const rectangles = nodes.flatMap(node => [...node.querySelectorAll('s')].map(leaf => leaf.getBoundingClientRect()));
        return { left: Math.min(...rectangles.map(rect => rect.left)) - 3,
          top: Math.min(...rectangles.map(rect => rect.top)) - 3,
          right: Math.max(...rectangles.map(rect => rect.right)) + 3,
          bottom: Math.max(...rectangles.map(rect => rect.bottom)) + 3,
          leaves: rectangles.length };
      });
      assert.ok(bounds.leaves > 100 && Object.values(bounds).every(Number.isFinite), `${id}: finite actual leaf bounds`);
      const visible = await page.screenshot({ path: `${output}/${id}-${pose}.png` });
      await bodies.evaluateAll(nodes => nodes.forEach(node => { node.dataset.proofVisibility = node.style.visibility; node.style.visibility = 'hidden'; }));
      const hidden = await page.screenshot({ path: `${output}/${id}-${pose}-hidden.png` });
      await bodies.evaluateAll(nodes => nodes.forEach(node => { node.style.visibility = window.__cssearthTest.required(node.dataset.proofVisibility, 'saved visibility'); delete node.dataset.proofVisibility; }));
      const before = PNG.sync.read(visible), after = PNG.sync.read(hidden);
      let escapedPixels = 0, surfacePixels = 0;
      for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
        const offset = (y * before.width + x) * 4;
        const changed = [0, 1, 2].some(channel => Math.abs(required(before.data[offset + channel]) - required(after.data[offset + channel])) > 8);
        if (!changed) continue;
        if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) surfacePixels++;
        else escapedPixels++;
      }
      report.samples.push({ id, pose, bounds, escapedPixels, surfacePixels, url: page.url() });
      assert.ok(surfacePixels > 100, `${id}/${pose}: the prepared surface actually paints`);
      assert.ok(escapedPixels <= 32, `${id}/${pose}: ${escapedPixels} painted pixels escaped finite prepared leaf bounds`);
      console.log(`PROJECTIVE SURFACE PASS ${id}/${pose}: ${surfacePixels} surface pixels, ${escapedPixels} escaped`);
    }
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
