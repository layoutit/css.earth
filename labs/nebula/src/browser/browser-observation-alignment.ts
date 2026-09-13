/** Real prepared observations: registration display, layer identity, persistence and shared shell. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readObservations } from '../alignment/observations-ui/model';

const manifestPath = '.local/nebula-lab/observations/helix/observations.json';
const data = readObservations(JSON.parse(await readFile(manifestPath, 'utf8')));
const alignmentOnly = process.argv.includes('--alignment-only');
assert.equal(data.images.length, 3);
assert.ok(data.images.every(image => image.registration.status === 'verified' && (alignmentOnly || (image.layers.diffuse && image.layers.stars))));
const directory = '.local/nebula-lab/observations/helix/browser';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage(), errors: string[] = [], writes: string[] = [], initialVolumes: string[] = [];
const densityOverviewRequests: string[] = [];
let checkInitialLoads = true;
let observationInspection = true;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() !== 'GET') {
    if (observationInspection) writes.push(request.url());
    else densityOverviewRequests.push(`${request.url()} ${request.postData() ?? ''}`);
  }
  if (checkInitialLoads && request.url().includes('/planetary/helix-model-prior/')) initialVolumes.push(request.url());
});
const matrices = async () => page.locator('.observation-frame img').evaluateAll(nodes => nodes.map(node => [node.getAttribute('data-observation'), (node as HTMLElement).style.transform]));
try {
  await page.goto('http://127.0.0.1:4331/alignment?subject=helix-model-prior');
  await page.locator('.observation-frame img').first().waitFor();
  assert.equal(await page.locator('#observation-image option').count(), 3);
  assert.equal(await page.locator('#observation-reference').count(), 0);
  assert.deepEqual(initialVolumes, [], 'Observation alignment must not require a baked volume.');
  checkInitialLoads = false;
  const originalMatrices = await matrices();
  const nodes = await page.locator('.observation-frame img').elementHandles();
  const switchingCamera = await page.locator('.observation-frame').getAttribute('style');
  for (const image of data.images) for (const label of alignmentOnly ? ['Original'] : ['Original', 'Without stars', 'Residual']) {
    await page.locator('#observation-image').selectOption(image.id);
    await page.getByRole('group', { name: 'Observation image layer' }).getByRole('button', { name: label, exact: true }).click();
    await page.locator('.observation-frame img').evaluateAll(async elements => { await Promise.all(elements.map(node => (node as HTMLImageElement).decode())); });
    assert.deepEqual(await page.locator('.observation-frame img').evaluateAll(elements => elements.filter(node => getComputedStyle(node).visibility === 'visible').map(node => node.getAttribute('data-observation'))), [image.id]);
    assert.equal(await page.locator('.observation-frame').getAttribute('style'), switchingCamera, 'Image switching must keep the shared camera.');
    assert.deepEqual(await matrices(), originalMatrices, 'All prepared layers must use identical registration.');
    for (const node of nodes) assert.equal(await node.evaluate(element => element.isConnected), true);
    await page.screenshot({ path: `${directory}/${image.id}-${label.toLowerCase().replaceAll(' ', '-')}.png` });
  }
  await page.locator('#observation-image').selectOption('eso-vista');
  await page.getByRole('group', { name: 'Observation image layer' }).getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Matched stars', exact: true }).check();
  const initialCamera = await page.locator('.observation-frame').getAttribute('style');
  const sky = await page.locator('.observation-sky').boundingBox(); assert.ok(sky);
  await page.mouse.move(sky.x + sky.width / 2, sky.y + sky.height / 2);
  await page.mouse.wheel(0, -450);
  await page.waitForTimeout(200);
  assert.notEqual(await page.locator('.observation-frame').getAttribute('style'), initialCamera);
  await page.screenshot({ path: `${directory}/matched-stars.png` });
  const zoomed = await page.locator('.observation-frame').getAttribute('style');
  await page.getByRole('button', { name: 'Reload prepared layers', exact: true }).click();
  await page.getByRole('button', { name: 'Reload prepared layers', exact: true }).waitFor();
  assert.equal(await page.locator('.observation-frame').getAttribute('style'), zoomed);
  await page.locator('#observation-fit-x').fill('0.15');
  await page.getByRole('button', { name: 'Copy positioning', exact: true }).click();
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(copied.imageId, 'eso-vista'); assert.equal(copied.adjustment.x, .15);
  await page.reload();
  await page.locator('.observation-frame img').first().waitFor();
  await page.locator('#observation-image').selectOption('eso-vista');
  assert.equal(await page.locator('#observation-fit-x').inputValue(), '0.15');
  await page.getByRole('button', { name: 'Reset alignment', exact: true }).click();
  assert.deepEqual(await matrices(), originalMatrices);
  await page.getByRole('tab', { name: 'Reconstruction', exact: true }).click();
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  await page.locator('#viewer[data-ready="true"]').waitFor();
  const mesh = await page.locator('.css-volume-mesh').first().elementHandle(); assert.ok(mesh);
  await page.getByRole('tab', { name: 'Alignment', exact: true }).click();
  await page.locator('.observation-frame img').first().waitFor();
  assert.equal(await mesh.evaluate(node => node.isConnected), true, 'Observation inspection must retain the existing 3D scene.');
  assert.deepEqual(writes, [], 'Observation inspection never starts processing.');
  observationInspection = false;
  await page.locator('#subject').selectOption('lmc-clouds');
  await page.locator('#viewer[data-ready="true"][data-mode="density"][data-subject="lmc-clouds"]').waitFor();
  assert.equal(await page.locator('.observation-alignment').count(), 0);
  await page.locator('#subject').selectOption('helix-model-prior');
  await page.locator('.observation-frame img').first().waitFor();
  await page.locator('#subject').selectOption('m2-9-inferred');
  await page.locator('#viewer[data-ready="true"][data-mode="photo"][data-subject="m2-9-inferred"]').waitFor();
  assert.equal(await page.locator('#subject').inputValue(), 'm2-9-inferred');
  assert.equal(await page.getByRole('tab', { name: 'Reconstruction', exact: true }).getAttribute('aria-selected'), 'true');
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, browser: browser.version(), viewport: { width: 1600, height: 1000 },
    checks: ['alignment without a prepared volume', 'one visible image at a time', 'switch images at an unchanged shared camera', 'three aligned native footprints', alignmentOnly ? 'three original layers decode' : 'all nine prepared layers decode', 'identical layer registration and retained images',
      'matched-star overlay', 'zoom and refresh retention', 'saved manual adjustments and copy', 'unchanged measured registration', 'shared density/symmetry/inference navigation'], errors, writes, densityOverviewRequests }, null, 2));
  console.log('NEBULA_OBSERVATION_BROWSER_PASS');
} finally { await browser.close(); }
