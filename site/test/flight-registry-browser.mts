import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mts';
import { browserObjects } from './browser-objects.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/flight-registry';
const start = `${origin}/sun/?overview=solar-system&v=QMbBjrZTdiHH30GM5sCQv8l4wiAhrbgbKXxBQsczQAAAAD_Kd0sE6289P8zJjb7eDje_4KrSDNFvFQABAAAAAAAAAAA`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors: string[] = [];
await mkdir(output, { recursive: true });
try {
  for (const dpr of [1, 2]) {
    const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    for (const { id } of browserObjects()) {
      await page.goto(start);
      await page.waitForFunction(() => window.__cssEarth?.ready);
      await page.evaluate(id => window.__cssearthTest.htmlElement(document.querySelector(`.planet-object-link[data-object-id="${id}"]`)).click(), id);
      await page.waitForFunction(id => window.__cssEarth?.activeObjectId === id && window.__cssearthTest.scene().ready, id, { timeout: 30000 });
      const state = await page.evaluate(() => ({
        scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length,
        error: window.__cssearthTest.scene().error,
        indicatorsRestored: [...document.querySelectorAll('[data-context-indicator]')].some(node => window.__cssearthTest.htmlElement(node).style.opacity !== '0'),
      }));
      assert.equal(state.scenes, 1, `${id}: exactly one detailed scene`);
      assert.equal(state.error, null, `${id}: successful generic handoff`);
      assert.equal(state.indicatorsRestored, true, `${id}: overlay owner restored`);
      results.push({ id, dpr, ...state });
      console.log(`PASS ${id} DPR ${dpr}`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
