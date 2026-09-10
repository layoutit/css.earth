/** Capture the installed LMC lenses at one saved world camera. No processing or user storage changes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = resolve(root, 'docs/galaxies');
const base = process.argv[2] ?? 'http://127.0.0.1:4210';
const view = 'QIZAIGJN0vGp_MBQYk3S8an8Q6NAziEHSnBBQsczQAAAAL-SHHY-Jtf4v8cBng4F6eS_uKhrxCWwLAABAAAAAAAAAAA';
const ids = ['vista-infrared', 'horalek-widefield', 'wise-wide-infrared'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const relative = path => resolve(root, path);
const receipt = {
  schema: 'cssearth-galaxy-documentation-captures@1',
  renderCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  capture: 'Actual Chromium app viewport; WebP quality 90, no crop, resize, color or exposure changes.',
  deliveryManifestSha256: sha256(await readFile(relative('src/objects/lmc/source/lens-manifest.json'))),
  passed: false, images: [], errors: [],
};
await mkdir(resolve(directory, 'images'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: receipt.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => receipt.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) receipt.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${base}/sun/?focus=lmc&focusLens=vista-infrared&v=${view}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cssEarth?.ready && window.__sun?.ready, null, { timeout: 60000 });
  const cloud = page.locator('[data-volume-lens-object="lmc"]');
  await cloud.waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-focus-stars]').isChecked(), true);
  assert.equal(await cloud.locator('.prepared-catalogue-points s').count(), 943);
  const camera = await page.evaluate(() => window.__sun.camera.state());
  for (const id of ids) {
    await page.locator(`[data-focus-lens][value="${id}"]`).click();
    await page.waitForFunction(lens => {
      const publication = window.__sun.camera.publication();
      return document.querySelector('[data-volume-lens-object="lmc"]')?.dataset.selectedLens === lens &&
        publication.requestedRevision === publication.presentedRevision;
    }, id);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-volume-lens-object="lmc"] s')]
      .map(node => getComputedStyle(node).backgroundImage).filter(value => value.startsWith('url('))
      .map(value => { const image = new Image(); image.src = value.slice(5, -2); return image.decode(); })));
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert.deepEqual(await page.evaluate(() => window.__sun.camera.state()), camera);
    const bytes = await sharp(await page.screenshot()).webp({ quality: 90, effort: 5 }).toBuffer();
    const path = `images/lmc-${id}.webp`;
    await writeFile(resolve(directory, path), bytes);
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
