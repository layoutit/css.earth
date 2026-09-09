import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mjs';
// Reuse an already-running server. Optionally select one body after the URL.
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const requestedId = process.argv[3];
const selected = requestedId ? OBJECTS.filter(object => object.id === requestedId) : OBJECTS;
assert.ok(selected.length, `Unknown object: ${requestedId}`);
const output = resolve('output/dom-cleanliness');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], navigation = [], problems = [];
try {
  for (const density of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: density });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
    for (const object of selected) {
      await page.goto(`${origin}${object.route}`, { waitUntil: 'networkidle' });
      await ready(page, object.id);
      const initial = await page.evaluate(census);
      assertClean(initial, `${object.id} DPR ${density}`);
      await page.evaluate(() => {
        const root = document.querySelector('.planet-stage');
        const nodes = [...root.querySelectorAll('*')];
        const records = [];
        const observer = new MutationObserver(batch => records.push(...batch));
        observer.observe(root, { subtree: true, childList: true });
        window.__domCleanlinessResult = () => {
          records.push(...observer.takeRecords()); observer.disconnect();
          const current = [...root.querySelectorAll('*')];
          return { retained: nodes.length === current.length && nodes.every((node, i) => node === current[i]),
            topologyChanges: records.filter(record => record.type === 'childList' &&
              [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1)).length };
        };
      });
      const beforeDrag = await page.locator('.polycss-scene').evaluate(node => getComputedStyle(node).transform);
      await page.mouse.move(950, 460); await page.mouse.down();
      await page.mouse.move(1120, 515, { steps: 16 });
      await page.waitForFunction(before => getComputedStyle(document.querySelector('.polycss-scene')).transform !== before, beforeDrag);
      await page.mouse.up();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const interaction = await page.evaluate(() => window.__domCleanlinessResult());
      assert.deepEqual(interaction, { retained: true, topologyChanges: 0 });
      assertClean(await page.evaluate(census), `${object.id} after drag`);
      reports.push({ object: object.id, density, initial, interaction });
      console.log(`PASS ${object.id} DPR ${density}: ${initial.nodes} nodes; retained interaction`);
    }

    if (requestedId) { await page.close(); continue; }
    // Search is the visible product navigation, including the Earth -> Saturn
    // transition that used to detach loaded stylesheets and collapse the camera.
    await page.goto(`${origin}/earth/`, { waitUntil: 'networkidle' });
    await ready(page, 'earth');
    await page.evaluate(() => {
      const selectors = ['.planet-stage', '.planet-sidebar', '.planet-input-surface', '.prepared-universe'];
      window.__domNavigation = { selectors, nodes: selectors.map(selector => document.querySelector(selector)),
        document, universeNodes: [...document.querySelector('.prepared-universe').querySelectorAll('*')], maxScenes: 1 };
      const probe = window.__domNavigation;
      probe.observer = new MutationObserver(() => {
        probe.maxScenes = Math.max(probe.maxScenes, document.querySelectorAll('.polycss-scene').length);
      });
      probe.observer.observe(document.querySelector('.planet-stage'), { childList: true, subtree: true });
    });
    const visits = [];
    for (const id of ['saturn', 'mercury', 'earth', 'saturn', 'mercury', 'earth']) {
      await page.locator('.planet-sidebar-search').fill(id);
      await page.locator(`a.planet-object-link[data-object-id="${id}"]`).click();
      await ready(page, id);
      const result = await page.evaluate(() => {
        const probe = window.__domNavigation;
        const current = [...document.querySelector('.prepared-universe').querySelectorAll('*')];
        return { ...censusForNavigation(), retained: probe.document === document &&
          probe.selectors.every((selector, i) => document.querySelector(selector) === probe.nodes[i]),
          universeRetained: current.length === probe.universeNodes.length && current.every((node, i) => node === probe.universeNodes[i]) };
        function censusForNavigation() {
          const camera = document.querySelector('.polycss-camera'), rect = camera.getBoundingClientRect();
          return { object: document.querySelector('.planet-stage').dataset.objectId,
            nodes: document.querySelector('.planet-stage').querySelectorAll('*').length + 1,
            scenes: document.querySelectorAll('.polycss-scene').length,
            width: rect.width, height: rect.height, perspective: parseFloat(getComputedStyle(camera).perspective),
            styleCount: document.head.querySelectorAll('style,link[rel="stylesheet"]').length,
            loadedSheets: [...document.head.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet !== null) };
        }
      });
      assert.ok(result.retained && result.universeRetained && result.loadedSheets);
      assert.ok(result.width > 0 && result.height > 0 && result.perspective > 0);
      assert.equal(result.scenes, 1);
      const previous = visits.find(visit => visit.object === id);
      if (previous) {
        assert.equal(result.nodes, previous.nodes, `${id}: no DOM accumulation on return`);
        assert.equal(result.styleCount, previous.styleCount, `${id}: no stylesheet accumulation on return`);
      }
      assertClean(await page.evaluate(census), `${id} after navigation`);
      visits.push(result);
    }
    const maxScenes = await page.evaluate(() => { window.__domNavigation.observer.disconnect(); return window.__domNavigation.maxScenes; });
    assert.equal(maxScenes, 1);
    navigation.push({ density, visits, maxScenes });
    console.log(`NAVIGATION PASS DPR ${density}: six hops; retained universe and shell; no node or stylesheet growth`);
    await page.close();
  }
  assert.deepEqual(problems, []);
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ browser: browser.version(), reports, navigation, problems }, null, 2) + '\n');
  await browser.close();
}

async function ready(page, id) {
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'error' ||
    (document.documentElement.dataset.ready === 'true' && document.querySelector('.planet-stage').dataset.objectId === id &&
      location.pathname === `/${id}/`), id, { timeout: 60000 });
  assert.equal(await page.locator('html').getAttribute('data-ready'), 'true', `${id}: renderer failed`);
}
function census() {
  const stage = document.querySelector('.planet-stage');
  const camera = stage.querySelector('.polycss-camera');
  const rect = camera.getBoundingClientRect();
  return { nodes: stage.querySelectorAll('*').length + 1,
    sceneCount: stage.querySelectorAll('.polycss-scene').length,
    cameraWidth: rect.width, cameraHeight: rect.height,
    texturedLeaves: [...stage.querySelectorAll(':scope > .polycss-camera :is(s,u)')].filter(node => getComputedStyle(node).backgroundImage !== 'none').length,
    forbiddenRenderers: stage.querySelectorAll('canvas,svg').length,
    duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id)
      .filter((id, i, ids) => ids.indexOf(id) !== i) };
}
function assertClean(result, message) {
  assert.ok(result.nodes > 1, message);
  assert.ok(result.texturedLeaves > 0, `${message}: surface textures must be present`);
  assert.ok(result.cameraWidth > 0 && result.cameraHeight > 0, message);
  assert.equal(result.sceneCount, 1, message);
  assert.equal(result.forbiddenRenderers, 0, message);
  assert.deepEqual(result.duplicateIds, [], message);
}
