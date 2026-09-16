import { gestureCamera } from './browser-camera.ts';
/** Saved-output checks. Args: [result-ledger.json] [base-url] [output-directory] [--single-source]. Never starts processing. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type { PreparedReconstruction } from '../src/features/reconstruction/reconstruction-types.ts';
import type { DensityOverlay } from '../src/features/legacy-viewer/controller';
import type { PreparedLmcStars } from '../src/adapters/viewer/catalogue-stars';

interface Result { imageId: string; resultId: string; }
interface ProjectionMatch { id: string; pixel: number[]; projected: number[]; star: number[]; errorPx: number; }
interface Receipt {
  imageId: string; resultId: string; originalPath: string; originalSha256: string;
  earthDistance: number; projectedStars: ProjectionMatch[]; maximumStarErrorPx: number;
  cameraReset: boolean; opacityIndependent: boolean; sourceSwitchRetainsCamera: boolean; screenshot: string;
}
const ledgerPath = resolve(process.argv[2] ?? '.local/nebula-lab/alignment-material-acceptance.json');
const baseURL = process.argv[3] ?? 'http://127.0.0.1:4331';
const outputRoot = resolve(process.argv[4] ?? '.local/nebula-lab/reconstruction-reference');
const singleSource = process.argv.includes('--single-source');
const report: { ledger: string; ledgerSha256?: string; receipts: Receipt[]; errors: string[]; forbiddenWrites: string[];
  failedRequests: [number, string][]; scope: string; passed: boolean; failure?: string } = {
    ledger: ledgerPath, receipts: [], errors: [], forbiddenWrites: [], failedRequests: [], passed: false,
    scope: singleSource ? 'single-source; source switching not checked' : 'all sources and source switching',
  };
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const originalSelector = '#viewer .reconstruction-original-projection';
const cloudSelector = '#viewer .css-volume-projection:not(.reconstruction-original-projection)';

async function cameraReceipt(page: Page) {
  return page.locator('#viewer').evaluate(host => ({
    distance: Number((host as HTMLElement).dataset.distance),
    transforms: [...host.querySelectorAll<HTMLElement>('.css-volume-projection:not(.reconstruction-original-projection) .css-volume-scene')].map(node => node.style.transform),
    perspectives: [...host.querySelectorAll<HTMLElement>('.css-volume-projection:not(.reconstruction-original-projection) .css-volume-camera')].map(node => node.style.perspective),
  }));
}
async function settle(page: Page) {
  let previous = JSON.stringify(await cameraReceipt(page)), stable = 0;
  for (let step = 0; step < 40; step++) {
    await page.waitForTimeout(100);
    const current = JSON.stringify(await cameraReceipt(page));
    stable = current === previous ? stable + 1 : 0;
    if (stable === 3) return;
    previous = current;
  }
  throw new Error('Reference camera did not settle within four seconds.');
}
async function ready(page: Page, row: Result) {
  await page.waitForFunction(id => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
    document.querySelector<HTMLElement>('#viewer')?.dataset.subject === `reconstruction-${id}` &&
    document.querySelector<HTMLElement>('[data-reconstruction-result]')?.dataset.reconstructionResult === id,
  row.resultId, { timeout: 30000 });
  await page.locator('#reconstruction-image').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector<HTMLSelectElement>('#reconstruction-image')?.disabled);
}
async function originalReady(page: Page, texturePath: string) {
  await page.waitForFunction(path => {
    const status = document.querySelector<HTMLElement>('#status');
    if (status?.dataset.error === 'true') throw new Error(status.textContent ?? 'Original reference failed.');
    const root = document.querySelector<HTMLElement>('.reconstruction-original-projection');
    const leaf = root?.querySelector<HTMLElement>('[data-reconstruction-original-leaf]');
    return root && getComputedStyle(root).visibility === 'visible' && leaf?.style.backgroundImage.includes(path);
  }, texturePath, { timeout: 30000 });
}
async function slider(page: Page, id: string, value: number) {
  await page.locator(`#${id}`).evaluate((node, number) => {
    const input = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(number));
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function moveCamera(page: Page) {
  await gestureCamera(page, 'horizontal-positive-short');
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -180); await settle(page);
}
async function projectionMatches(page: Page, overlay: DensityOverlay, stars: PreparedLmcStars, distance: number) {
  return page.evaluate(({ overlay, points, distance }) => {
    const leaf = document.querySelector<HTMLElement>('[data-reconstruction-original-leaf]')!;
    const root = leaf.closest('.reconstruction-original-projection')!;
    const plane = new DOMMatrix(leaf.style.transform), inverse = plane.inverse();
    const scene = new DOMMatrix(root.querySelector<HTMLElement>('.css-volume-scene')!.style.transform);
    const focal = parseFloat(root.querySelector<HTMLElement>('.css-volume-camera')!.style.perspective);
    const matches: ProjectionMatch[] = [];
    for (const point of points) {
      const node = [...document.querySelectorAll<HTMLElement>('.prepared-lmc-stars [data-catalogue-source]')].find(node => node.dataset.catalogueSource === point.id);
      if (!node || node.style.visibility === 'hidden') continue;
      const [x, y, z] = point.positionUnits, rayFactor = 1 + z / distance;
      // Ray-plane intersection at tangent z=0. Prepared geometry carries the single physical XY/CSS bridge.
      const uv = inverse.transformPoint(new DOMPoint(50 * y / rayFactor, 50 * x / rayFactor, 0, 1));
      const pixel = [uv.x / uv.w, uv.y / uv.w];
      if (pixel[0] < 0 || pixel[1] < 0 || pixel[0] >= overlay.widthPx || pixel[1] >= overlay.heightPx) continue;
      const imagePoint = plane.transformPoint(new DOMPoint(pixel[0], pixel[1], 0, 1));
      const cameraPoint = scene.transformPoint(imagePoint), scale = focal / (focal - cameraPoint.z / cameraPoint.w);
      const projected = [cameraPoint.x / cameraPoint.w * scale, cameraPoint.y / cameraPoint.w * scale];
      const transform = new DOMMatrix(node.style.transform);
      const star = [transform.m41 + parseFloat(node.style.width) / 2, transform.m42 + parseFloat(node.style.height) / 2];
      matches.push({ id: point.id, pixel, projected, star, errorPx: Math.hypot(projected[0] - star[0], projected[1] - star[1]) });
      if (matches.length === 25) break;
    }
    return matches;
  }, { overlay, points: stars.stars, distance });
}

await mkdir(outputRoot, { recursive: true });
let browser: Browser | undefined;
try {
  const ledgerBytes = await readFile(ledgerPath), ledger = JSON.parse(ledgerBytes.toString()); report.ledgerSha256 = sha256(ledgerBytes);
  assert.equal(ledger.pass, true, 'Need a verified completed reconstruction ledger.');
  const rows = ledger.results as Result[];
  assert.ok(Array.isArray(rows) && rows.length >= (singleSource ? 1 : 2) && rows.length <= 12, 'Need at least two saved images to verify source switching; --single-source is an explicitly limited smoke check.');
  assert.ok(rows.every(row => /^[a-z0-9-]+$/.test(row.imageId) && /^[0-9a-f]{64}$/.test(row.resultId)));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 1 });
  await context.route('**/*', async route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    report.forbiddenWrites.push(`${route.request().method()} ${route.request().url()}`); await route.abort('blockedbyclient');
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });
  let switchCamera: Awaited<ReturnType<typeof cameraReceipt>> | undefined;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]; console.log('RECONSTRUCTION_REFERENCE_CHECK', row.imageId);
    const response = await context.request.get(new URL(`/__nebula/reconstruction/result/${row.resultId}`, baseURL).href);
    assert.equal(response.status(), 200);
    const prepared = await response.json() as PreparedReconstruction, subject = prepared.subject;
    assert.equal(prepared.imageId, row.imageId); assert.equal(prepared.resultId, row.resultId);
    assert.ok(subject.reconstructionOverlay && subject.stars && subject.referenceDistanceUnits);
    const catalogue = JSON.parse(await readFile(subject.reconstructionOverlay, 'utf8'));
    assert.equal(catalogue.overlays.length, 1);
    const overlay = catalogue.overlays[0] as DensityOverlay;
    const directory = subject.reconstructionOverlay.slice(0, subject.reconstructionOverlay.lastIndexOf('/') + 1);
    const originalPath = `${directory}${overlay.texturePath}`, originalBytes = await readFile(originalPath);
    assert.equal(sha256(originalBytes), overlay.sha256, 'Prepared original source bytes changed.');
    const stars = JSON.parse(await readFile(subject.stars, 'utf8')) as PreparedLmcStars;
    if (index === 0) {
      const url = new URL('/reconstruction', baseURL); url.searchParams.set('subject', subject.id);
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } else await page.selectOption('#reconstruction-image', row.imageId);
    await ready(page, row);
    if (switchCamera) { await settle(page); assert.deepEqual(await cameraReceipt(page), switchCamera, `${row.imageId}: source selection changed the camera.`); }
    await page.locator('#reference-view').click(); await settle(page);
    const earth = await cameraReceipt(page);
    assert.ok(Math.abs(earth.distance - subject.referenceDistanceUnits) < 1e-10, 'Earth view used a fitted distance.');
    await page.locator('#cloud-stars-enabled').check();
    await page.locator('#reconstruction-original-enabled').check(); await originalReady(page, originalPath);
    assert.equal(await page.locator(originalSelector).count(), 1);
    assert.equal(await page.locator(cloudSelector).count(), 3);
    const samePlane = await page.locator('[data-reconstruction-original-leaf]').evaluate((node, transform) => {
      // Compare the exact browser-normalized declaration; CSSOM rounds its numeric serialization.
      const expected = document.createElement('s'); expected.style.transform = transform;
      return (node as HTMLElement).style.transform === expected.style.transform;
    }, overlay.style.transform);
    assert.equal(samePlane, true, 'Original plane differs from the saved registration.');
    const matches = await projectionMatches(page, overlay, stars, earth.distance);
    assert.ok(matches.length >= 5, 'Too few visible catalogue rays inside the original image for a comparison.');
    const maximumStarErrorPx = Math.max(...matches.map(match => match.errorPx));
    assert.ok(maximumStarErrorPx <= .02, `Original plane and catalogue projections differ by ${maximumStarErrorPx}px.`);
    await slider(page, 'reconstruction-original-opacity', 35);
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.reconstruction-original-projection')?.style.opacity === '0.35');
    await slider(page, 'cloud-brightness-overall', 25);
    await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.cloudOpacity === '0.25');
    assert.equal(await page.locator(originalSelector).evaluate(node => (node as HTMLElement).style.opacity), '0.35', 'Cloud brightness changed original-image opacity.');
    const leafHandle = await page.locator('[data-reconstruction-original-leaf]').elementHandle(); assert.ok(leafHandle);
    await page.locator('#reconstruction-original-enabled').uncheck();
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.reconstruction-original-projection')?.style.visibility === 'hidden');
    await page.locator('#reconstruction-original-enabled').check(); await originalReady(page, originalPath);
    assert.equal(await leafHandle.evaluate(node => node === document.querySelector('[data-reconstruction-original-leaf]')), true, 'Toggling recreated the prepared original plane.');
    await page.locator('#cloud-brightness-reset').click();
    await moveCamera(page); assert.notDeepEqual(await cameraReceipt(page), earth, 'Rotate/zoom did not move the camera.');
    await page.locator('#reference-view').click(); await settle(page);
    assert.deepEqual(await cameraReceipt(page), earth, 'Earth reset did not restore the same orientation and observer distance.');
    const screenshot = `${outputRoot}/${row.imageId}-earth-original-stars.png`; await page.screenshot({ path: screenshot });
    report.receipts.push({ imageId: row.imageId, resultId: row.resultId, originalPath, originalSha256: sha256(originalBytes),
      earthDistance: earth.distance, projectedStars: matches, maximumStarErrorPx, cameraReset: true, opacityIndependent: true,
      sourceSwitchRetainsCamera: Boolean(switchCamera), screenshot });
    await moveCamera(page); switchCamera = await cameraReceipt(page);
  }
  assert.equal(report.receipts.length, rows.length);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); assert.deepEqual(report.forbiddenWrites, []);
  report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
finally { await browser?.close(); await writeFile(`${outputRoot}/report.json`, `${JSON.stringify(report, null, 2)}\n`); }
console.log('RECONSTRUCTION_REFERENCE_COMPLETE', JSON.stringify({ passed: report.passed, scope: report.scope, sources: report.receipts.length, report: `${outputRoot}/report.json` }));
process.exitCode = report.passed ? 0 : 1;
