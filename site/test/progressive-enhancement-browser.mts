import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

declare global { interface Window { __progressiveNodes: Element[]; __progressiveControls: Element[]; } }
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/progressive-enhancement');
await mkdir(output, { recursive: true });
const browser = await chromium.launch((await conformanceBrowserLaunch({ evidenceDirectory: output })).options);
const cases: string[] = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport });
    const page = await context.newPage();
    const scripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto(`${origin}/earth/`);
    assert.equal(await page.locator('.planet-stage').count(), 1);
    assert.ok(await page.locator('.planet-stage [data-prepared-node]').count() > 500);
    assert.equal(await page.locator('.planet-world-stage').evaluate(node => getComputedStyle(node).opacity), '1');
    if (viewport.width < 821) {
      await page.locator('.planet-sheet-handle').check();
      // Poll from Node: a script-disabled document cannot run page timers.
      for (let i = 0; i < 40; i++) {
        if (await page.locator('.planet-sidebar').evaluate(node => getComputedStyle(node).transform) === 'none') break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    await page.locator('label[for="earth-factsheet-tab"]').click();
    assert.equal(await page.locator('#earth-factsheet-content').isVisible(), true);
    assert.equal(await page.locator('[data-body-overview][data-information-panel="factsheet"]').isVisible(), false);
    assert.equal(await page.locator('#earth-dataset-content').isVisible(), false);
    await page.locator('#earth-factsheet-tab').press('ArrowRight');
    assert.equal(await page.locator('#earth-moons-content').isVisible(), true);
    await page.screenshot({ path: `${output}/native-${viewport.width}.png` });
    const moon = page.locator('#earth-moons-content a[href="/moon/"]').first();
    await moon.click();
    await page.waitForURL(`${origin}/moon/`);
    assert.equal(await page.locator('.planet-stage').getAttribute('data-object-id'), 'moon');
    assert.equal(scripts.length, 0, 'Native panel selection and navigation load no application scripts');
    cases.push(`Native information controls, keyboard, one scene and ordinary links at ${viewport.width}px`);
    await context.close();
  }
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    let release!: () => void;
    const navigations: string[] = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*', async route => {
      if (route.request().resourceType() === 'script') await gate;
      await route.continue();
    });
    await page.goto(`${origin}/saturn/`, { waitUntil: 'commit' });
    await page.locator('[data-prepared-node="971"]').waitFor({ state: 'attached' });
    const count = await page.evaluate(() => {
      window.__progressiveNodes = [...document.querySelectorAll('.planet-stage [data-prepared-node]')];
      window.__progressiveControls = [...document.querySelectorAll('.planet-native-tab')];
      return window.__progressiveNodes.length;
    });
    if (viewport.width < 821) await page.locator('.planet-sheet-handle').check();
    await page.locator('label[for="saturn-factsheet-tab"]').click();
    const tabStyle = () => page.locator('label[for="saturn-factsheet-tab"]').evaluate(node => {
      const style = getComputedStyle(node);
      return ['font', 'padding', 'margin', 'color', 'background-color', 'border', 'outline', 'text-decoration'].map(name => style.getPropertyValue(name));
    });
    const initialTabStyle = await tabStyle();
    release();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' || document.documentElement.dataset.ready === 'error', undefined, { timeout: 60000 });
    assert.equal(await page.locator('html').getAttribute('data-ready'), 'true');
    assert.equal(await page.evaluate(() => Array.isArray(window.__progressiveNodes)), true,
      `The document reloaded during adoption: ${JSON.stringify(navigations)}`);
    const adopted = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.planet-stage [data-prepared-node]')];
      return { sameNodes: nodes.length === window.__progressiveNodes.length && nodes.every((node, i) => node === window.__progressiveNodes[i]),
        sameControls: window.__progressiveControls.every(node => node.isConnected),
        scenes: document.querySelectorAll('.planet-stage .polycss-scene').length };
    });
    assert.deepEqual(adopted, { sameNodes: true, sameControls: true, scenes: 1 });
    assert.equal(await page.locator('.planet-stage').getAttribute('data-prepared-object'), null);
    assert.equal(await page.locator('#saturn-factsheet-tab').isChecked(), true, 'Startup preserves an early native selection');
    assert.deepEqual(await tabStyle(), initialTabStyle, 'JavaScript does not restyle the selected tab');
    assert.equal(await page.locator('.planet-information-panel > .planet-dataset-context-rail').isVisible(), false, 'Dataset context follows native panel selection');
    if (viewport.width < 821) {
      assert.equal(await page.locator('.planet-sheet-handle').isChecked(), true, 'Startup preserves the open sheet');
      await page.locator('.planet-sheet-handle').uncheck();
      await page.waitForFunction(() => {
        const sheet = document.querySelector('.planet-sidebar')!;
        return Math.abs(sheet.getBoundingClientRect().top - (innerHeight - parseFloat(getComputedStyle(sheet).getPropertyValue('--sheet-peek')))) < 1;
      });
    }
    const scene = page.locator('.planet-stage .polycss-scene');
    const before = await scene.getAttribute('style');
    const bounds = await page.locator('.planet-input-surface').boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .5);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .6, { steps: 12 }); await page.mouse.up();
    assert.notEqual(await scene.getAttribute('style'), before);
    assert.equal(await page.locator('.planet-stage [data-prepared-node]').count(), count);
    if (viewport.width < 821) await page.locator('.planet-sheet-handle').check();
    await page.locator('label[for="saturn-dataset-tab"]').click();
    assert.equal(await page.locator('.planet-information-panel > .planet-dataset-context-rail').isVisible(), true);
    await page.locator('button[name="dataset"][value="ultraviolet"]').click();
    await page.screenshot({ path: `${output}/enhanced-${viewport.width}.png` });
    cases.push(`Interactive startup adopts all ${count} scene elements, preserves native selection, and adds drag and dataset controls at ${viewport.width}px`);
    await context.close();
  }

  const focused = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const focus = await focused.newPage();
  await focus.goto(`${origin}/sun/?focus=m42`);
  await focus.waitForFunction(() => document.documentElement.dataset.ready === 'true' && new URL(location.href).searchParams.has('v'));
  await focus.locator('[data-focus-lens-bank="m42"] button[value="eso-optical"]').click();
  await focus.locator('[data-focus-lens-bank="m42"] [data-dataset-context="eso-optical"]').waitFor({ state: 'visible' });
  const session = await focused.newCDPSession(focus);
  await session.send('Emulation.setScriptExecutionDisabled', { value: true });
  await focus.locator('#prepared-focus-dataset-tab').press('ArrowDown');
  assert.equal(await focus.locator('#prepared-focus-factsheet-content').isVisible(), true);
  assert.equal(await focus.locator('[data-focus-lens-bank="m42"] > .planet-dataset-context-rail').isVisible(), false);
  await focus.locator('#prepared-focus-factsheet-tab').press('ArrowUp');
  assert.equal(await focus.locator('#prepared-focus-dataset-content').isVisible(), true);
  assert.equal(await focus.locator('[data-focus-lens-bank="m42"] > .planet-dataset-context-rail').isVisible(), true);
  const stars = focus.locator('.prepared-volume-lenses[data-volume-lens-object="m42"] .prepared-catalogue-points');
  assert.equal(await focus.locator('[data-focus-stars]').count(), 0);
  assert.equal(await stars.evaluate(node => getComputedStyle(node).display), 'none');
  await session.send('Emulation.setScriptExecutionDisabled', { value: false });
  cases.push('Prepared focus keeps native information tabs, arrow keys and context visibility without duplicating the shell-level 3D-stars setting');
  await focused.close();
  // M31 is an image-layer bank, not a volume lens bank; dw1343+58 carries a plus sign in its catalogue id.
  for (const id of ['m_031', 'dw1343+58']) assert.equal((await fetch(`${origin}/sun/?focus=${encodeURIComponent(id)}`)).status, 200, `Direct focus load: ${id}`);
  cases.push('Direct focus loads serve an image-layer galaxy and a catalogue id with a plus sign');

  const failed = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const failure = await failed.newPage();
  await failure.route('**/objects/earth/*.json', route => route.abort());
  await failure.goto(`${origin}/earth/`);
  await failure.waitForFunction(() => document.documentElement.dataset.ready === 'error', undefined, { timeout: 60000 });
  assert.ok(await failure.locator('.planet-stage [data-prepared-node]').count() > 500);
  assert.equal(await failure.locator('.planet-world-stage').evaluate(node => getComputedStyle(node).opacity), '1');
  await failure.locator('label[for="earth-factsheet-tab"]').click();
  assert.equal(await failure.locator('#earth-factsheet-content').isVisible(), true);
  cases.push('Failed object transport preserves the existing scene and working native controls');
  await failed.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ browser: browser.version(), cases }, null, 2) + '\n');
  console.log(cases.join('\n'));
} finally { await browser.close(); }
