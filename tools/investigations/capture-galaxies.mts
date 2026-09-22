/** Capture the installed LMC lenses at one saved world camera. No processing or user storage changes. */
import { sha256 } from '../../src/platform/sha256.mts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = resolve(root, 'tests/galaxies');
const base = process.argv[2] ?? 'http://127.0.0.1:4210';
const view = 'QIZAIGJN0vGp_MBQYk3S8an8Q6NAziEHSnBBQsczQAAAAL-SHHY-Jtf4v8cBng4F6eS_uKhrxCWwLAABAAAAAAAAAAA';
const ids = ['vista-infrared', 'horalek-widefield', 'wise-wide-infrared'];

const relative = (path: string) => resolve(root, path);
type Capture = { imageId: string; path: string; bytes: number; sha256: string; route: string; stars: number; sameCamera: boolean };
const images: Capture[] = [];
const errors: string[] = [];
// Evaluated in Chromium: validate the published runtime diagnostics before use.
function readWorldDiagnostics(lens?: string) {
  const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
  const app: unknown = Reflect.get(window, '__cssEarth');
  const sun: unknown = Reflect.get(window, '__sun');
  if (!record(app) || !app.ready || !record(sun) || !sun.ready || !record(sun.camera)) return false;
  const camera = sun.camera;
  if (typeof camera.state !== 'function' || typeof camera.publication !== 'function') return false;
  const publication: unknown = camera.publication();
  if (!record(publication) || publication.requestedRevision !== publication.presentedRevision) return false;
  if (lens && document.querySelector<HTMLElement>('[data-volume-lens-object="lmc"]')?.dataset.selectedLens !== lens) return false;
  const state: unknown = camera.state();
  return { state };
}
const receipt = {
  schema: 'cssearth-galaxy-documentation-captures@1',
  renderCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  capture: 'Actual Chromium app viewport; WebP quality 90, no crop, resize, color or exposure changes.',
  deliveryManifestSha256: sha256(await readFile(relative('src/objects/lmc/source/lens-manifest.json'))),
  passed: false, images, errors,
};
await mkdir(resolve(root, 'docs/images/galaxies'), { recursive: true });
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: receipt.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => receipt.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) receipt.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${base}/sun/?focus=lmc&focusLens=vista-infrared&v=${view}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(readWorldDiagnostics, undefined, { timeout: 60000 });
  const cloud = page.locator('[data-volume-lens-object="lmc"]');
  await cloud.waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-focus-stars]').isChecked(), true);
  assert.equal(await cloud.locator('.prepared-catalogue-points s').count(), 943);
  const camera = await page.evaluate(readWorldDiagnostics, undefined);
  for (const id of ids) {
    await page.locator(`[data-focus-lens][value="${id}"]`).click();
    await page.waitForFunction(readWorldDiagnostics, id);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-volume-lens-object="lmc"] s')]
      .map(node => getComputedStyle(node).backgroundImage).filter(value => value.startsWith('url('))
      .map(value => { const image = new Image(); image.src = value.slice(5, -2); return image.decode(); })));
    await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    assert.deepEqual(await page.evaluate(readWorldDiagnostics, undefined), camera);
    const bytes = await sharp(await page.screenshot()).webp({ quality: 90, effort: 5 }).toBuffer();
    const path = `docs/images/galaxies/lmc-${id}.webp`;
    await writeFile(resolve(root, path), bytes);
    receipt.images.push({ imageId: id, path, bytes: bytes.length, sha256: sha256(bytes),
      route: `/sun/?focus=lmc&focusLens=${id}&v=${view}`, stars: 943, sameCamera: true });
    console.log(`CAPTURED ${id}: ${bytes.length} bytes`);
  }
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await browser.close();
  await writeFile(resolve(directory, 'captures.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log('GALAXY_CAPTURES_COMPLETE', receipt.images.length);
