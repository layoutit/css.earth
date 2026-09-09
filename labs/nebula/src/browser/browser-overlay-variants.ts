/** Focused Alignment gate: prepared image layers retain geometry, controls and tone identity. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { overlayVariantsPath, parseOverlayVariants } from '../viewer/overlay-variants.js';

declare global { interface Window { __variantLeaves?: HTMLElement[]; } }
const rows = parseOverlayVariants(JSON.parse(await readFile(overlayVariantsPath, 'utf8')));
assert.ok(rows.length, 'No prepared image layers are available.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
const errors: string[] = [], checks: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const output = '.local/nebula-lab/overlay-variants-check'; await mkdir(output, { recursive: true });
async function waitLayer(id: string, layer: string) {
  await page.waitForFunction(([imageId, expected]) => {
    const nodes = [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${imageId}"]`)];
    return nodes.length === 3 && nodes.every(node => node.dataset.imageLayer === expected) &&
      document.querySelector<HTMLElement>('#overlay-layer')?.dataset.value === expected;
  }, [id, layer], { timeout: 30000 });
}
async function chooseLayer(layer: string) {
  await page.locator(`#overlay-layer [data-image-layer="${layer}"]`).click();
}
const geometry = () => page.evaluate(() => ({
  camera: document.querySelector<HTMLElement>('#viewer')?.dataset.cameraRevision,
  transforms: window.__variantLeaves!.map(node => node.style.transform),
  opacity: window.__variantLeaves!.map(node => node.style.opacity),
  retained: window.__variantLeaves!.every(node => node.isConnected),
}));
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/?subject=lmc-clouds&tab=alignment`);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
    document.querySelector<HTMLElement>('#viewer')?.dataset.subject === 'lmc-clouds' && document.querySelectorAll('#overlay-choice option').length === 8, { timeout: 30000 });
  assert.equal(await page.locator('#overlay-layer-control').isVisible(), false, 'Original-only source should not expose empty layer controls.');
  for (const row of rows) {
    await page.selectOption('#overlay-choice', row.imageId); await waitLayer(row.imageId, 'original');
    assert.equal(await page.locator('#overlay-layer-control').isVisible(), true);
    await page.evaluate(id => { window.__variantLeaves = [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${id}"]`)]; }, row.imageId);
    const before = await geometry();
    for (const layer of row.layers) {
      await chooseLayer( layer.id); await waitLayer(row.imageId, layer.id);
      assert.deepEqual(await geometry(), before, 'Layer switching changed placement, opacity or camera.');
      assert.ok(await page.locator(`[data-overlay-leaf="${row.imageId}"]`).first().evaluate(node => (node as HTMLElement).style.backgroundImage.includes('lmc-star-separation/prepared/')));
    }
    await page.locator('#image-tone-brightness').fill('1.2'); await page.locator('#image-tone-brightness').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied', { timeout: 30000 });
    await chooseLayer( 'diffuse'); await waitLayer(row.imageId, 'diffuse');
    assert.equal(await page.locator('#image-tone-brightness').inputValue(), '1.2', 'Tone should be shared across layers.');
    await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied', { timeout: 30000 });
    assert.deepEqual(await geometry(), before);
    await chooseLayer( 'original'); await waitLayer(row.imageId, 'original');
    assert.equal(await page.locator('#image-tone-brightness').inputValue(), '1.2');
    await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied', { timeout: 30000 });
    assert.deepEqual(await geometry(), before);
    await chooseLayer( 'stars'); await waitLayer(row.imageId, 'stars');
    await page.locator('#reset-image-tone').click();
    await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied');
    await chooseLayer( 'original'); await waitLayer(row.imageId, 'original');
    await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied');
    assert.equal(await page.locator('#image-tone-brightness').inputValue(), '1');
    assert.ok(await page.locator(`[data-overlay-leaf="${row.imageId}"]`).first().evaluate(node =>
      (node as HTMLElement).style.backgroundImage.includes('lmc-candidates/prepared/')), 'Neutral shared tone must restore the original, not an old tone cache.');
    await page.screenshot({ path: `${output}/${row.imageId}.png` }); checks.push(`${row.imageId}: original + both layers, retained placement/camera, shared tone`);
  }
  await page.selectOption('#overlay-choice', 'smash-original');
  await page.waitForFunction(() => (document.querySelector<HTMLElement>('#overlay-layer-control'))?.hidden === true);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }
