/** Image-first alignment must retain its scene, camera and image placement when density is toggled. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/alignment-default';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const subject of ['lmc-clouds', 'smc-particles']) {
    await page.goto(`${base}/alignment?subject=${subject}`);
    await page.waitForFunction(id => {
      const host = document.querySelector<HTMLElement>('#viewer');
      return host?.dataset.ready === 'true' && host.dataset.subject === id && document.querySelector<HTMLInputElement>('#overlay-enabled')?.checked;
    }, subject, { timeout: 90_000 });
    const toggle = page.locator('#density-overlay-enabled');
    assert.equal(await toggle.isChecked(), false);
    const density = '#viewer .css-volume-mesh:not([data-overlay-mesh]) > s';
    assert.ok(await page.locator(density).count() > 0);
    assert.equal(await page.locator(density).evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'hidden')), true);
    const image = page.locator('[data-overlay-leaf]').first();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-overlay-leaf]')].some(node => getComputedStyle(node).visibility === 'visible'));
    const pose = await page.locator('#viewer .css-volume-scene').first().getAttribute('style');
    const placement = await image.getAttribute('style');
    const retained = await page.locator(density).first().elementHandle();
    await page.locator('#viewer').screenshot({ path: `${output}/${subject}-image.png` });
    await toggle.check();
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(node => getComputedStyle(node).visibility === 'visible'), density);
    assert.equal(await retained!.evaluate(node => node.isConnected), true);
    assert.equal(await page.locator('#viewer .css-volume-scene').first().getAttribute('style'), pose);
    assert.equal(await image.getAttribute('style'), placement);
    await page.locator('#viewer').screenshot({ path: `${output}/${subject}-density.png` });
    await toggle.uncheck();
    assert.equal(await page.locator(density).evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'hidden')), true);
    assert.equal(await retained!.evaluate(node => node.isConnected), true);
    await page.reload();
    await page.waitForFunction(id => document.querySelector<HTMLElement>('#viewer')?.dataset.subject === id && document.querySelector<HTMLInputElement>('#overlay-enabled')?.checked, subject, { timeout: 90_000 });
    assert.equal(await toggle.isChecked(), false);
  }
  console.log('ALIGNMENT_IMAGE_FIRST_OK: LMC/SMC default, retained toggle, placement, camera and reload');
} finally { await browser.close(); }
