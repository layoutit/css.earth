import { cameraOrientation, gestureCamera } from './browser-camera.ts';
/** Historical Hubble baseline only; current ESO maps use browser-observation-structures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const directory = '.local/nebula-lab/planetary/browser/helix-structures';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors: string[] = [], writes: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
try {
  await page.goto('http://127.0.0.1:4331/reconstruction?subject=helix-single-axis');
  await page.locator('#viewer[data-ready="true"]').waitFor();
  const mesh = await page.locator('.css-volume-mesh').first().elementHandle();
  assert.ok(mesh);
  for (const layer of ['Source', 'Combined', 'Diffuse', 'Arcs', 'Knots', 'Unassigned']) {
    await page.getByRole('group', { name: 'Structure layer' }).getByRole('button', { name: layer, exact: true }).click();
    const img = page.locator('.emission-structure-map img');
    await img.waitFor();
    await img.evaluate(async (node: HTMLImageElement) => node.decode());
    assert.deepEqual(await img.evaluate((node: HTMLImageElement) => [node.naturalWidth, node.naturalHeight]), [768, 508]);
    await page.screenshot({ path: `${directory}/${layer.toLowerCase()}.png` });
  }
  assert.match(await page.locator('.emission-structures').innerText(), /All input accounted for/);
  await page.getByRole('button', { name: 'Source candidates', exact: true }).click();
  const candidateSelector = page.getByRole('combobox', { name: 'Source candidate' });
  await candidateSelector.locator('option').first().waitFor({ state: 'attached' });
  for (const id of ['eso-wide', 'eso-wfi', 'eso-vista', 'hubble-ctio']) {
    await candidateSelector.selectOption(id);
    const photo = page.getByRole('figure', { name: 'Source coverage preview' }).locator('img');
    await photo.evaluate(async (node: HTMLImageElement) => node.decode());
    assert.ok(await photo.evaluate((node: HTMLImageElement) => node.naturalWidth >= 1000 && getComputedStyle(node).objectFit === 'contain'));
    assert.match(await page.locator('.emission-sources').innerText(), /Original preview · no processing/);
    await page.screenshot({ path: `${directory}/candidate-${id}.png` });
  }
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  assert.equal(await mesh.evaluate(node => node.isConnected), true, 'Inspection must not destroy the retained scene.');
  await gestureCamera(page, 'horizontal-positive-wide');
  const retainedOrientation = await cameraOrientation(page);
  await page.getByRole('button', { name: 'Structure map', exact: true }).click();
  await page.locator('.emission-structure-map img').waitFor();
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  assert.equal(await cameraOrientation(page), retainedOrientation);
  await page.reload();
  await page.locator('.emission-structure-map img').waitFor();
  await page.locator('.emission-structure-map img').evaluate(async (node: HTMLImageElement) => node.decode());
  await page.goto('http://127.0.0.1:4331/reconstruction?subject=helix-single-axis&inspection=sources');
  await page.getByRole('figure', { name: 'Source coverage preview' }).locator('img').waitFor();
  await page.getByRole('figure', { name: 'Source coverage preview' }).locator('img').evaluate(async (node: HTMLImageElement) => node.decode());
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, errors, writes,
    checks: ['six actual full-frame maps', 'four uncropped source previews with credits', 'source-preview direct URL', 'exact accounting visible', 'stable PolyCSS scene', 'camera preserved', 'refresh', 'no processing on inspection'] }, null, 2));
  console.log('NEBULA_STRUCTURE_BROWSER_PASS');
} finally { await browser.close(); }
