/** Current ESO structure review, real prepared artifacts, and no volume dependency. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue, reviewStorageKey } from '../src/features/observations/models/structures-model';
import { checkObservationGeometry } from './check-observation-geometry';

const cataloguePath = '.local/nebula-lab/observations/helix/structures/catalogue.json';
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8')));
const directory = '.local/nebula-lab/observations/helix/structures/browser';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors: string[] = [], writes: string[] = [], volumeRequests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() !== 'GET') writes.push(request.url());
  if (request.url().includes('/planetary/helix-model-prior/')) volumeRequests.push(request.url());
});
// Simulate absent historical volume without moving/deleting the user's real caches.
await page.route('**/planetary/helix-model-prior/**', route => route.abort());
try {
  await page.goto('http://127.0.0.1:4331/alignment?subject=helix-model-prior');
  await page.locator('.observation-frame img').first().waitFor();
  await page.locator('#observation-image').selectOption('eso-vista');
  await page.getByRole('group', { name: 'Observation image layer' }).getByRole('button', { name: 'Without stars', exact: true }).click();
  await page.locator('#observation-fit-x').fill('0.15');
  await page.locator('#observation-fit-rotation').fill('12');
  await page.getByRole('button', { name: 'Earth view · fit all', exact: true }).click();
  const alignmentBounds = await page.locator('.observation-frame img[data-observation="eso-vista"]').boundingBox();
  assert.ok(alignmentBounds);
  await page.getByRole('tab', { name: 'Reconstruction', exact: true }).click();
  await page.locator('#structure-image').waitFor();
  assert.equal(await page.locator('#structure-image option').count(), catalogue.images.length);
  await page.getByRole('group', { name: 'Structure inspection mode' }).getByRole('button', { name: 'Regions', exact: true }).click();

  await page.locator('#structure-image').selectOption('eso-vista');
  const activePlane = () => page.locator(`[data-structure-image="${catalogue.images.find(image => image.id === 'eso-vista')!.id}"]`);
  await activePlane().locator('.structure-evidence-image').evaluate(async (node: HTMLImageElement) => node.decode());
  const structureBounds = await activePlane().boundingBox(); assert.ok(structureBounds);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    assert.ok(Math.abs(structureBounds[key] - alignmentBounds[key]) < .05, `Alignment/structure ${key} differs, including saved rotation and offset.`);
  assert.deepEqual(volumeRequests, [], 'Review must be usable without a historical volume.');
  assert.equal(await page.locator('#viewer').evaluate(node => (node as HTMLElement).inert), true);
  await page.screenshot({ path: `${directory}/manual-fit.png` });

  // Restore a neutral pose in this isolated browser, never the user's own storage.
  await page.getByRole('tab', { name: 'Alignment', exact: true }).click();
  await page.locator('#observation-image').selectOption('eso-vista');
  await page.getByRole('button', { name: 'Reset alignment', exact: true }).click();
  await page.getByRole('tab', { name: 'Reconstruction', exact: true }).click();
  await page.locator('.structure-region').first().waitFor({ state: 'attached' });
  await page.getByRole('group', { name: 'Structure inspection mode' }).getByRole('button', { name: 'Regions', exact: true }).click();
  const sceneCamera = await page.locator('.observation-structure-frame').getAttribute('style');
  const sourceNodes = await page.locator('[data-structure-image]').elementHandles();
  const sourceChecks = [], geometryChecks = [];
  for (const image of catalogue.images) {
    await page.locator('#structure-image').selectOption(image.id);
    const plane = page.locator(`[data-structure-image="${image.id}"]`);
    await plane.locator('.structure-evidence-image').evaluate(async (node: HTMLImageElement) => node.decode());
    assert.equal(await page.locator('.observation-structure-frame').getAttribute('style'), sceneCamera, 'Source selection changed the camera.');
    if (image.geometry) geometryChecks.push(await checkObservationGeometry(page, image, directory));
    const regionNode = await plane.locator('[data-region-id]').first().elementHandle(); assert.ok(regionNode);
    const registration = await plane.getAttribute('style');
    const candidates = plane.locator('[data-region-id]:not([hidden])');
    const count = await candidates.count(); assert.ok(count > 0);
    const target = await candidates.nth(Math.floor(count / 2)).boundingBox(); assert.ok(target);
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down(); await page.mouse.move(target.x + target.width / 2 + 25, target.y + target.height / 2 + 15); await page.mouse.up();
    assert.notEqual(await page.locator('.observation-structure-frame').getAttribute('style'), sceneCamera, 'Highlighted regions blocked drag-to-pan.');
    await page.getByRole('button', { name: 'Fit all images', exact: true }).click();
    assert.equal(await page.locator('.observation-structure-frame').getAttribute('style'), sceneCamera);
    for (const filter of ['area', 'contrast', 'elongation']) {
      const slider = page.locator(`#structure-${filter}`), original = await slider.inputValue();
      assert.equal(await slider.getAttribute('type'), 'range');
      await slider.press('End');
      assert.equal(await candidates.count(), 0, `${filter} did not filter candidates.`);
      await slider.evaluate((node: HTMLInputElement, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
      }, original);
      assert.equal(await candidates.count(), count, 'Restoring filter lost candidates.');
    }
    const scaleSlider = page.locator('#structure-scale');
    assert.equal(await scaleSlider.getAttribute('type'), 'range');
    await scaleSlider.press('End');
    for (const id of await candidates.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-region-id')))) assert.match(id!, /^s5-/);
    await scaleSlider.press('Home');
    for (let step = 0; step < 3; step++) await scaleSlider.press('ArrowRight');
    for (const label of ['Compact', 'Elongated', 'Diffuse']) await page.getByRole('group', { name: 'Morphology filters' }).getByRole('checkbox', { name: label, exact: true }).uncheck();
    assert.equal(await candidates.count(), 0);
    for (const label of ['Compact', 'Elongated', 'Diffuse']) await page.getByRole('group', { name: 'Morphology filters' }).getByRole('checkbox', { name: label, exact: true }).check();
    assert.equal(await candidates.count(), count);
    for (const label of ['Source', 'Combined', 'Diffuse', 'Arcs', 'Knots', 'Unassigned']) {
      await page.getByRole('group', { name: 'Structure layer' }).getByRole('button', { name: label, exact: true }).click();
      const natural = await plane.locator('.structure-evidence-image').evaluate(async (node: HTMLImageElement) => { await node.decode(); return [node.naturalWidth, node.naturalHeight]; });
      assert.deepEqual(natural, [image.width, image.height]);
      assert.equal(await plane.getAttribute('style'), registration, 'Evidence layers changed registration.');
    }
    await page.getByRole('group', { name: 'Structure layer' }).getByRole('button', { name: 'Source', exact: true }).click();
    assert.equal(await regionNode.evaluate(node => node.isConnected), true, 'Filtering recreated support nodes.');
    const selectedId = await page.locator('[data-selected-region]').getAttribute('data-selected-region'); assert.ok(selectedId);
    const decision = page.getByRole('group', { name: 'Region decision' }).getByRole('button', { name: 'Keep', exact: true });
    await decision.click(); assert.equal(await decision.getAttribute('aria-pressed'), 'true');
    await page.locator('#structure-review-filter').selectOption('keep');
    assert.equal(await candidates.count(), 1);
    assert.equal(await candidates.first().getAttribute('data-region-id'), selectedId);
    await page.locator('#structure-review-filter').selectOption('all');
    const stored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), reviewStorageKey(cataloguePath, image)) ?? '{}');
    assert.equal(stored[selectedId], 'keep');
    await page.screenshot({ path: `${directory}/${image.id}.png` });
    sourceChecks.push({ id: image.id, selectedId, visibleCandidates: count, mapSha256: image.mapSha256 });
  }
  for (const node of sourceNodes) assert.equal(await node.evaluate(element => element.isConnected), true);
  await page.reload();
  await page.locator('#structure-image').waitFor();
  if (catalogue.images.some(image => image.geometry)) await page.getByRole('group', { name: 'Structure inspection mode' }).getByRole('button', { name: 'Regions', exact: true }).click();
  for (const checked of sourceChecks) {
    await page.locator('#structure-image').selectOption(checked.id);
    await page.locator(`[data-structure-image="${checked.id}"]`).waitFor();
    await page.locator('#structure-review-filter').selectOption('keep');
    assert.equal(await page.locator('[data-selected-region]').getAttribute('data-selected-region'), checked.selectedId);
    assert.equal(await page.getByRole('group', { name: 'Region decision' }).getByRole('button', { name: 'Keep', exact: true }).getAttribute('aria-pressed'), 'true');
  }
  assert.deepEqual(volumeRequests, []);
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.deepEqual(errors, []);
  assert.ok(writes.every(url => url.endsWith('/__nebula/shape-cloud-jobs')), 'Inspection must not start extraction or star removal; Shapes only prepares its live preview.');
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, browser: browser.version(),
    viewport: { width: 1600, height: 1000 }, cataloguePath, sourceChecks, geometryChecks,
    checks: ['structure inspection without historical volume', 'same Alignment registration and saved manual fit', 'three source switches keep camera',
      '18 full-frame evidence images decode', 'area/contrast/elongation/scale/morphology/review filters affect actual supports',
      'retained support nodes', 'drag-to-pan across highlighted regions', 'decisions restore for every source after refresh', 'only authorized live shape previews on inspection'], errors, writes, volumeRequests }, null, 2));
  console.log('NEBULA_OBSERVATION_STRUCTURES_BROWSER_PASS');
} finally { await browser.close(); }
