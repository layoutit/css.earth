/** Inspect the real Alignment controls and decoded prepared pixels; never runs separation. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Response } from 'playwright';
import sharp from 'sharp';
import { overlayVariantsPath, parseOverlayVariants } from '../viewer/overlay-variants.js';

declare global { interface Window { __strengthLeaves?: HTMLElement[]; __releaseLayer?: () => void; __restoreImageDecode?: () => void; } }
const rows = parseOverlayVariants(JSON.parse(await readFile(overlayVariantsPath, 'utf8')));
const baseURL = process.argv.slice(2).find(value => !value.startsWith('--')) ?? 'http://127.0.0.1:4331';
const sourceId = 'wise-wide-infrared', row = rows.find(item => item.imageId === sourceId)!;
assert.ok(row, 'WISE prepared variants are missing.');
const diffuse = row.layers.find(item => item.id === 'diffuse')!;
const manifest = JSON.parse(await readFile('labs/nebula/models/lmc/candidates/overlays.json', 'utf8'));
const original = manifest.overlays.find((item: { id: string }) => item.id === sourceId);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage(), errors: string[] = [], latencies: { strength: number; elapsedMs: number }[] = [];
page.on('pageerror', error => errors.push(error.message));
const output = '.local/nebula-lab/removal-strength-check'; await mkdir(output, { recursive: true });
function matches(response: Response, id: string, strength: number) {
  if (!response.url().endsWith('/__nebula/prepare-tone')) return false;
  const request = response.request().postDataJSON();
  return request.imageId === id && request.imageLayer === 'diffuse' && request.removalStrength === strength;
}
async function select(id: string) {
  await page.selectOption('#overlay-choice', id);
  await page.waitForFunction(value => document.querySelector<HTMLElement>('#image-overlay-panel')?.dataset.selectedOverlay === value &&
    document.querySelectorAll(`[data-overlay-leaf="${value}"]`).length === 3, id);
}
async function strength(value: number, id = sourceId) {
  const response = page.waitForResponse(reply => matches(reply, id, value));
  const start = performance.now();
  await page.locator('#star-removal').fill(String(value)); await page.locator('#star-removal').dispatchEvent('change');
  const prepared = await response; assert.equal(prepared.status(), 200);
  const body = await prepared.json();
  await page.waitForFunction(([imageId, url]) => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied' &&
    [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${imageId}"]`)].every(node => node.style.backgroundImage.includes(url)), [id, body.resources[0].url]);
  latencies.push({ strength: value, elapsedMs: Math.round(performance.now() - start) });
  return body.resources[0];
}
const geometry = () => page.evaluate(() => ({ camera: document.querySelector<HTMLElement>('#viewer')?.dataset.cameraRevision,
  transforms: window.__strengthLeaves!.map(node => node.style.transform), opacity: window.__strengthLeaves!.map(node => node.style.opacity),
  retained: window.__strengthLeaves!.every(node => node.isConnected) }));
try {
  await page.goto(`${baseURL}/?subject=lmc-clouds&tab=alignment`);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' && document.querySelectorAll('#overlay-choice option').length === 8);
  assert.equal(await page.locator('#star-removal').isVisible(), false);
  for (const candidate of rows) { await select(candidate.imageId); assert.equal(await page.locator('#star-removal').isVisible(), true); assert.equal(await page.locator('#star-removal-range').isVisible(), true); }
  await select(sourceId);
  assert.equal(await page.locator('#star-removal-range').getAttribute('max'), '100', 'WISE must retain its existing range.');
  assert.equal(await page.locator('#star-removal').getAttribute('max'), '100');
  assert.equal(await page.locator('#star-removal').inputValue(), '100');
  await page.evaluate(id => { window.__strengthLeaves = [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${id}"]`)]; }, sourceId);
  const before = await geometry();
  const decoded: Buffer[] = [];
  for (const value of [0, 50, 100]) {
    const resource = await strength(value);
    decoded.push(await sharp(resource.url.slice(4)).ensureAlpha().raw().toBuffer());
    assert.equal(await page.locator('#overlay-layer').getAttribute('data-value'), 'diffuse');
    assert.equal(await page.locator('#star-removal-range').inputValue(), String(value));
    assert.deepEqual(await geometry(), before);
  }
  const sourcePixels = await sharp(`labs/nebula/models/lmc/candidates/${original.texturePath}`)
    .resize(diffuse.widthPx, diffuse.heightPx, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const endpointPixels = await sharp(diffuse.texturePath).ensureAlpha().raw().toBuffer();
  assert.equal(Buffer.compare(decoded[0]!, sourcePixels), 0, '0% must contain original pixels on the endpoint grid.');
  assert.equal(Buffer.compare(decoded[2]!, endpointPixels), 0, '100% must contain endpoint pixels.');
  let maxError = 0, changed = 0;
  for (let index = 0; index < decoded[1]!.length; index++) {
    const expected = index % 4 === 3 ? sourcePixels[index]! : Math.round((sourcePixels[index]! + endpointPixels[index]!) / 2);
    maxError = Math.max(maxError, Math.abs(decoded[1]![index]! - expected));
    if (sourcePixels[index] !== endpointPixels[index]) changed++;
  }
  assert.equal(maxError, 0, '50% must contain the midpoint pixels before neutral tone.'); assert.ok(changed > 0);

  let release!: () => void, started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), arrived = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/__nebula/prepare-tone', async route => {
    if (route.request().postDataJSON().removalStrength !== 25) return route.continue();
    const response = await route.fetch(); started(); await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator('#star-removal').fill('25'); await page.locator('#star-removal').dispatchEvent('change'); await arrived;
  await strength(75); release(); await page.unroute('**/__nebula/prepare-tone');
  assert.equal(await page.locator('#star-removal').inputValue(), '75'); assert.deepEqual(await geometry(), before);
  await strength(50);
  await select('horalek-widefield'); assert.equal(await page.locator('#star-removal').inputValue(), '100');
  await strength(33, 'horalek-widefield'); await select(sourceId); assert.equal(await page.locator('#star-removal').inputValue(), '50');
  await page.evaluate(path => {
    const decode = HTMLImageElement.prototype.decode; let held = false;
    window.__restoreImageDecode = () => { HTMLImageElement.prototype.decode = decode; };
    HTMLImageElement.prototype.decode = function () {
      const ready = decode.call(this);
      if (!held && this.src.endsWith(path)) {
        held = true; return ready.then(() => new Promise<void>(resolve => { window.__releaseLayer = resolve; }));
      }
      return ready;
    };
  }, original.texturePath);
  await page.locator('#overlay-layer [data-image-layer="original"]').click();
  await page.waitForFunction(() => Boolean(window.__releaseLayer));
  await select('horalek-widefield'); await select(sourceId);
  await page.evaluate(() => { window.__releaseLayer!(); window.__restoreImageDecode!(); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#overlay-layer').getAttribute('data-value'), 'diffuse');
  assert.ok(await page.locator(`[data-overlay-leaf="${sourceId}"]`).evaluateAll(nodes => nodes.every(node => (node as HTMLElement).dataset.imageLayer === 'diffuse')),
    'A cancelled layer decode must not change an image after it is reselected.');
  await page.locator('#copy-image-tone').click();
  await page.waitForFunction(() => document.querySelector('#copy-image-tone')?.textContent === 'Copied!');
  const tone = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())); assert.equal(tone.removalStrength, 50);
  await page.locator(`#copy-placement-${sourceId}`).click();
  await page.waitForFunction(id => document.querySelector(`#copy-placement-${id}`)?.textContent?.includes('Copied'), sourceId);
  const placement = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())); assert.equal(placement.removalStrength, 50);
  await page.reload(); await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true');
  await page.waitForFunction(id => document.querySelector<HTMLSelectElement>('#overlay-choice')?.value === id, sourceId);
  assert.equal(await page.locator('#star-removal').inputValue(), '50'); assert.equal(await page.locator('#overlay-layer').getAttribute('data-value'), 'original');
  await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied');
  await page.screenshot({ path: `${output}/sidebar.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ passed: true, latencies, midpointMaximumPixelError: maxError, endpointChangedChannels: changed }, null, 2));
  console.log(JSON.stringify({ passed: true, latencies }));
} finally { await browser.close(); }
