import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

declare global { interface Window { __nativeShellNodes: Element[]; } }
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/native-shell');
await mkdir(output, { recursive: true });
const browser = await chromium.launch((await conformanceBrowserLaunch({ evidenceDirectory: output })).options);
const cases: string[] = [];
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/saturn/?dataset=ultraviolet`, { waitUntil: 'domcontentloaded' });
    const rail = page.locator('.planet-information-panel > .planet-dataset-context-rail');
    assert.equal(await rail.locator('[data-dataset-context="ultraviolet"] [data-mission="cassini"]').isVisible(), true);
    assert.equal(await rail.locator('[data-dataset-context="ultraviolet"] [data-source]').count() > 0, true);
    assert.equal(await page.locator('template[data-prepared-detail="dataset-context"]').count(), 0);
    await page.locator('.planet-native-tab-label[for="saturn-factsheet-tab"]').click();
    assert.equal(await rail.isVisible(), false);
    await page.locator('.planet-native-tab-label[for="saturn-dataset-tab"]').click();
    assert.equal(await rail.isVisible(), true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const panel = page.locator('.planet-settings-panel');
    assert.equal(await panel.isVisible(), true);
    assert.equal(await rail.isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator('.planet-settings-action').evaluate(node => node === document.activeElement), true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await panel.locator('label:has(input[name="shadows"])').click();
    await panel.getByRole('button', { name: 'Apply settings' }).click();
    await page.waitForURL(url => url.searchParams.get('settings') === '1');
    assert.equal(new URL(page.url()).searchParams.get('dataset'), 'ultraviolet');
    assert.equal(await page.locator('.polycss-scene').count(), 1);
    assert.equal(JSON.parse(await page.locator('.planet-stage').getAttribute('data-prepared-settings') ?? '{}').shadows, true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.locator('.planet-settings input[name="shadows"]').isChecked(), true);
    await page.screenshot({ path: `${output}/native-settings-${width}.png` });
    await page.keyboard.press('Escape');
    await page.locator('button[name="dataset"][value="normal"]').click();
    await page.waitForURL(url => url.searchParams.get('dataset') === 'normal');
    assert.equal(JSON.parse(await page.locator('.planet-stage').getAttribute('data-prepared-settings') ?? '{}').shadows, true);
    cases.push(`Native cards, tabs, Settings, keyboard dismissal and persistent scene settings at ${width}px`);
    console.log(cases.at(-1));
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  // Warm the dev server's one-time dependency optimization before identity checks.
  await page.goto(`${origin}/saturn/?dataset=ultraviolet`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', undefined, { timeout: 90_000 });
  await context.close();
  for (const failure of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*', async route => {
      if (route.request().resourceType() === 'script') await gate;
      if (failure && /\/objects\/saturn\/[^/]+\.json$/u.test(route.request().url())) await route.abort();
      else await route.continue();
    });
    await page.goto(`${origin}/saturn/?dataset=ultraviolet&settings=1&shadows=on`, { waitUntil: 'commit' });
    await page.locator('.planet-information-panel > .planet-dataset-context-rail [data-mission="cassini"]').first().waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.evaluate(() => { window.__nativeShellNodes = [...document.querySelectorAll('.planet-information-panel > .planet-dataset-context-rail, .planet-settings-panel, .planet-settings input, .planet-stage [data-prepared-node]')]; });
    release();
    await page.waitForFunction(expected => document.documentElement.dataset.ready === expected, failure ? 'error' : 'true', { timeout: 90_000 });
    assert.equal(await page.locator('.planet-settings-panel').isVisible(), true);
    assert.equal(await page.locator('.planet-settings input[name="shadows"]').isChecked(), true);
    assert.equal(await page.evaluate(() => window.__nativeShellNodes.every(node => node.isConnected)), true);
    assert.equal(await page.locator('.polycss-scene').count(), 1);
    cases.push(`${failure ? 'Failed' : 'Delayed'} renderer retains native cards, open Settings, choices and scene nodes`);
    console.log(cases.at(-1));
    await context.close();
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ origin, cases }, null, 2) + '\n');
  await browser.close();
}
