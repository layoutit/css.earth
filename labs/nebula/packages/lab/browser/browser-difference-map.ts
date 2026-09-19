/**
 * The difference-map tool in the real Reconstruction tab, for two saved image lenses.
 *
 * Read-only. Per lens: the round button sits directly under Levels; toggling it mounts the server's map on the
 * original image's registered quad (same plane transform, same camera, same on-screen box); the legend labels
 * the scale; orbiting hides the map and says why; the Earth view shows it again; and the unpainted density has
 * no tool. Args: [base-url] [output-directory] [lensResultId…].
 *
 * A lens outside the lab's current finite-lens bundle (an older model's lens) is shown by rewriting, in this
 * test browser only, the catalogue response so that lens is its image's saved result. Nothing is written.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { gestureCamera } from './browser-camera.ts';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = resolve(process.argv[3] ?? '.local/nebula-lab/difference-map');
const lenses = process.argv.slice(4).filter(value => /^[a-f0-9]{64}$/.test(value));
if (!lenses.length) throw new TypeError('Usage: browser-difference-map [base-url] [output-directory] <lensResultId…>');
await mkdir(output, { recursive: true });

const differenceRoot = '#viewer .reconstruction-difference-projection', originalRoot = '#viewer .reconstruction-original-projection';
const errors: string[] = [], report: unknown[] = [];
let stage = 'start';
async function settle(page: Page) {
  const receipt = () => page.locator('#viewer').evaluate(host => `${(host as HTMLElement).dataset.cameraRevision}|${(host as HTMLElement).dataset.distance}`);
  let previous = await receipt(), stable = 0;
  for (let step = 0; step < 60 && stable < 3; step++) {
    await page.waitForTimeout(100); const current = await receipt();
    stable = current === previous ? stable + 1 : 0; previous = current;
  }
}
const visibility = (page: Page) => page.locator(differenceRoot).evaluate(node => getComputedStyle(node).visibility);
async function tooltip(page: Page) {
  await page.locator('[data-workspace-tool="difference"]').hover();
  const text = await page.getByRole('tooltip').textContent();
  await page.mouse.move(5, 5); return text ?? '';
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  page.on('pageerror', error => errors.push(`${stage}: ${error}`));
  page.on('console', message => { if (message.type() === 'error' && !/favicon/.test(message.text())) errors.push(`${stage}: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400 && !/favicon/.test(response.url())) errors.push(`http ${response.status()} ${response.url()}`); });
  let pinned: { resultId: string; imageId: string; prepared: unknown } | null = null;
  await page.route(/\/__nebula\/reconstruction\?subjectId=/, async route => {
    const response = await route.fetch(), catalogue = await response.json();
    if (pinned) {
      const row = catalogue.candidates.find((item: { imageId: string }) => item.imageId === pinned!.imageId);
      if (row) row.prepared = pinned.prepared;
      const model = (pinned.prepared as { finiteMaterial?: { modelResultId?: string } }).finiteMaterial?.modelResultId;
      if (catalogue.finiteModel && model) catalogue.finiteModel.modelResultId = model;
    }
    await route.fulfill({ response, json: catalogue });
  });
  for (const [index, id] of lenses.entries()) {
    const prepared = await (await fetch(`${base}/__nebula/reconstruction/result/${id}`)).json();
    pinned = { resultId: id, imageId: prepared.imageId, prepared };
    stage = `load ${id.slice(0, 8)}`;
    await page.goto(`${base}/reconstruction?subject=reconstruction-${id}`);
    await page.waitForFunction(value => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
      document.querySelector<HTMLElement>('#viewer')?.dataset.subject === `reconstruction-${value}` &&
      document.querySelector('.reconstruction-controls')?.getAttribute('data-reconstruction-result') === value, id, { timeout: 120000 });
    await page.locator('#reference-view').click(); await settle(page);

    // The second of three round buttons, directly under Levels (Radial profile sits third, under Difference map).
    const order = await page.locator('.workspace-tool-buttons [data-workspace-tool]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.workspaceTool));
    assert.deepEqual(order, ['levels', 'difference', 'radial'], `tool order ${order.join(',')}`);
    const [levelsBox, differenceBox] = await Promise.all(['levels', 'difference'].map(tool => page.locator(`[data-workspace-tool="${tool}"]`).boundingBox()));
    assert.ok(levelsBox && differenceBox && differenceBox.y > levelsBox.y + levelsBox.height - 1 && Math.abs(differenceBox.x - levelsBox.x) < .5, 'not under Levels');

    const button = page.locator('[data-workspace-tool="difference"]');
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    stage = 'toggle'; await button.click();
    await page.waitForFunction(selector => { const node = document.querySelector(selector); return Boolean(node) && getComputedStyle(node!).visibility === 'visible'; }, differenceRoot, { timeout: 60000 });
    await page.locator(`[data-difference-legend="${id}"]`).waitFor({ timeout: 60000 });
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const legend = await page.locator(`[data-difference-legend="${id}"]`).innerText();
    assert.match(legend, /-64[\s\S]*±6[\s\S]*\+64/, legend);
    const mapFor = await page.locator(differenceRoot).evaluate(node => (node as HTMLElement).dataset.differenceResult);
    assert.equal(mapFor, id, 'the map belongs to another lens');
    await page.screenshot({ path: `${output}/earth-${index}-${id.slice(0, 8)}.png` });

    // Aligned: the difference plane is the original's registered plane, under the same camera, on the same box.
    stage = 'original'; await page.locator('#reconstruction-original-enabled').check();
    await page.waitForFunction(selector => { const node = document.querySelector(selector); return Boolean(node) && getComputedStyle(node!).visibility === 'visible'; }, originalRoot, { timeout: 60000 });
    const alignment = await page.evaluate(() => {
      const leaf = (name: string) => document.querySelector<HTMLElement>(`[data-reconstruction-${name}-leaf]`)!;
      const root = (name: string) => leaf(name).closest<HTMLElement>('.css-volume-projection')!;
      const pick = (name: string) => ({ plane: leaf(name).style.transform, width: leaf(name).style.width, height: leaf(name).style.height,
        size: leaf(name).style.backgroundSize, scene: root(name).querySelector<HTMLElement>('.css-volume-scene')!.style.transform,
        perspective: root(name).querySelector<HTMLElement>('.css-volume-camera')!.style.perspective, box: leaf(name).getBoundingClientRect().toJSON() });
      return { original: pick('original'), difference: pick('difference') };
    });
    const { box: originalBox, ...original } = alignment.original, { box: diffBox, ...difference } = alignment.difference;
    assert.deepEqual(difference, original, 'The difference plane is not the original plane.');
    for (const key of ['x', 'y', 'width', 'height'] as const)
      assert.ok(Math.abs(diffBox[key] - originalBox[key]) < .01, `box ${key} ${diffBox[key]} vs ${originalBox[key]}`);
    await page.screenshot({ path: `${output}/with-original-${index}-${id.slice(0, 8)}.png` });
    await page.locator('#reconstruction-original-enabled').uncheck();

    // Orbiting hides the map and says why; the Earth view brings it back.
    stage = 'orbit';
    const earthTooltip = await tooltip(page);
    await gestureCamera(page, 'horizontal-positive-short'); await settle(page);
    assert.equal(await visibility(page), 'hidden', 'map still shown while orbited');
    assert.equal(await page.locator('[data-difference-hidden="orbit"]').count(), 1);
    const orbitTooltip = await tooltip(page);
    assert.match(orbitTooltip, /hidden.*Earth view/i, orbitTooltip);
    await page.screenshot({ path: `${output}/orbit-${index}-${id.slice(0, 8)}.png` });
    await page.locator('#reference-view').click(); await settle(page);
    assert.equal(await visibility(page), 'visible', 'map not restored at the Earth view');

    // No tool for the unpainted density.
    stage = 'benchmark'; await page.selectOption('#reconstruction-image', 'benchmark');
    await page.waitForFunction(() => !document.querySelector('[data-workspace-tool="difference"]'), undefined, { timeout: 60000 });
    // Let the unpainted density finish mounting, so the next navigation never aborts its texture decodes.
    await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
      !document.querySelector('.reconstruction-controls')?.getAttribute('data-reconstruction-result'), undefined, { timeout: 120000 });
    await settle(page);
    report.push({ id, order, legend, earthTooltip, orbitTooltip, alignment });
  }
  assert.deepEqual(errors, [], `Console errors: ${errors.join(' | ')}`);
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ base, lenses, errors, report }, null, 2) + '\n');
console.log('DIFFERENCE_MAP_BROWSER_OK', output, lenses.length);
