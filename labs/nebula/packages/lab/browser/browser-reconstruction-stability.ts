import { gestureCamera } from './browser-camera.ts';
/** Saved-output acceptance only. Args: [result-ledger.json] [base-url] [output-directory]. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import sharp from 'sharp';

type Axis = 'x' | 'y' | 'z';
type Rgb = [number, number, number];
interface Result { imageId: string; resultId: string; }
interface Bank {
  axis: Axis; index: number; opacity: number; visible: boolean;
  opticalCopies: string[]; transform: string;
}
interface BankImage {
  axis: Axis; screenshot: string; sha256: string; width: number; height: number;
  rgbTotals: Rgb; luminanceTotal: number; chromaticity: Rgb; nonblackPixels: number;
}
interface SeamReceipt {
  imageId: string; resultId: string; seam: string; banks: Bank[];
  camera: Awaited<ReturnType<typeof cameraReceipt>>; images: BankImage[];
  relativeLuminanceDifference: number; normalizedL1: number; passed: boolean;
}
interface Report {
  schema: 'cssearth-nebula-reconstruction-stability@1'; ledger: string; ledgerSha256?: string;
  thresholds: { relativeLuminanceDifference: number; normalizedL1: number };
  measurements: SeamReceipt[]; errors: string[]; failedRequests: [number, string][];
  forbiddenWrites: string[]; expectedComparisons: number; passed: boolean; failure?: string;
}

const ledgerPath = resolve(process.argv[2] ?? '.local/nebula-lab/alignment-material-acceptance.json');
const baseURL = process.argv[3] ?? 'http://127.0.0.1:4331';
const outputRoot = resolve(process.argv[4] ?? '.local/nebula-lab/reconstruction-stability');
const screenshots = `${outputRoot}/screenshots`;
const thresholds = { relativeLuminanceDifference: .05, normalizedL1: .04 };
const report: Report = { schema: 'cssearth-nebula-reconstruction-stability@1', ledger: ledgerPath,
  thresholds, measurements: [], errors: [], failedRequests: [], forbiddenWrites: [], expectedComparisons: 0, passed: false };
const seams = [{ axes: ['y', 'z'] as const, direction: 'vertical' }, { axes: ['x', 'z'] as const, direction: 'horizontal' }];
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

async function bankReceipt(page: Page): Promise<Bank[]> {
  return page.locator('#viewer .css-volume-projection:not(.reconstruction-original-projection)').evaluateAll(nodes => nodes.map((node, index) => {
    const element = node as HTMLElement;
    return { index, axis: (['x', 'y', 'z'] as const)[index], opacity: Number(element.style.opacity),
      visible: element.style.visibility !== 'hidden',
      opticalCopies: [1, 2].map(copy => element.style.getPropertyValue(`--volume-optical-copy-${copy}`)),
      transform: element.querySelector<HTMLElement>('.css-volume-scene')?.style.transform ?? '' };
  }));
}
async function cameraReceipt(page: Page) {
  return page.locator('#viewer').evaluate(element => ({
    revision: (element as HTMLElement).dataset.cameraRevision,
    distance: (element as HTMLElement).dataset.distance,
    transforms: [...element.querySelectorAll<HTMLElement>('.css-volume-scene')].map(node => node.style.transform),
    perspectives: [...element.querySelectorAll<HTMLElement>('.css-volume-camera')].map(node => node.style.perspective),
  }));
}
function activePair(banks: Bank[], axes: readonly Axis[]) {
  const active = banks.filter(bank => bank.visible && bank.opacity > .15);
  return active.length === 2 && axes.every(axis => active.some(bank => bank.axis === axis)) &&
    active[1].opacity > .25 && active[1].opacity < .75;
}
async function waitForStillCamera(page: Page) {
  let previous = JSON.stringify(await cameraReceipt(page)), stable = 0;
  for (let step = 0; step < 30; step++) {
    await page.waitForTimeout(100);
    const current = JSON.stringify(await cameraReceipt(page));
    stable = current === previous ? stable + 1 : 0;
    if (stable === 3) return;
    previous = current;
  }
  throw new Error('Camera did not settle within three seconds after drag.');
}
async function prepareSeam(page: Page, row: Result, seam: typeof seams[number]) {
  const url = new URL('/reconstruction', baseURL); url.searchParams.set('subject', `reconstruction-${row.resultId}`);
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(id => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
    document.querySelector<HTMLElement>('[data-reconstruction-result]')?.dataset.reconstructionResult === id,
  row.resultId, { timeout: 30000 });
  await page.locator('#cloud-stars-enabled').uncheck();
  await page.locator('#cloud-brightness-reset').click();
  await page.locator('#cloud-all').click();
  await gestureCamera(page, 'reference');
  await page.waitForFunction(() => {
    const host = document.querySelector<HTMLElement>('#viewer');
    return host?.dataset.cloudOpacity === '1' && host.dataset.cloudBrightness === '{"overall":1,"x":1,"y":1,"z":1}';
  });
  assert.equal(await page.locator('#cloud-density-cutoff').inputValue(), '0', 'Acceptance must use unfiltered saved outputs.');
  await page.addStyleTag({ content: 'aside,header{visibility:hidden!important} #viewer{background:#000!important} .prepared-lmc-stars,.reconstruction-original-projection{display:none!important}' });
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box, 'Viewer has no bounds.');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const maximum = Math.min(220, Math.floor((seam.direction === 'vertical' ? box.height : box.width) * .45 / 2));
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  let found = false;
  try {
    for (let step = 1; step <= maximum; step++) {
      await page.mouse.move(start.x + (seam.direction === 'horizontal' ? step * 2 : 0),
        start.y + (seam.direction === 'vertical' ? step * 2 : 0));
      await page.waitForTimeout(20);
      if (activePair(await bankReceipt(page), seam.axes)) { found = true; break; }
    }
    // Let the final pointer movement age before release, avoiding a fling through the seam.
    await page.waitForTimeout(300);
  } finally { await page.mouse.up(); }
  assert.ok(found, `${row.imageId}: did not reach ${seam.axes.join('/')} seam within the bounded drag.`);
  await waitForStillCamera(page);
  const banks = await bankReceipt(page);
  assert.equal(banks.length, 3, 'Expected the retained X/Y/Z volume banks.');
  assert.ok(activePair(banks, seam.axes), `${row.imageId}: camera drifted out of ${seam.axes.join('/')} seam.`);
  assert.ok(banks.every(bank => bank.transform.length > 0), 'A retained bank has no camera transform.');
  assert.ok(banks.every(bank => bank.transform === banks[0].transform), 'Bank cameras differ.');
  return banks;
}
async function captureBank(page: Page, row: Result, seam: string, bank: Bank) {
  // Override only whole-bank compositing. Retain native optical-copy correction and exact camera.
  const isolation = await page.addStyleTag({ content: `#viewer .css-volume-projection:not(.reconstruction-original-projection){opacity:0!important;visibility:hidden!important}
    #viewer .css-volume-projection:not(.reconstruction-original-projection)[data-acceptance-bank="${bank.index}"]{opacity:1!important;visibility:visible!important}` });
  try {
    const path = `${screenshots}/${row.imageId}-${seam}-${bank.axis}.png`;
    const encoded = await page.locator('#viewer').screenshot({ path, timeout: 15000 });
    const { data, info } = await sharp(encoded).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 3);
    const rgbTotals: Rgb = [0, 0, 0]; let nonblackPixels = 0;
    for (let index = 0; index < data.length; index += 3) {
      for (let channel = 0; channel < 3; channel++) rgbTotals[channel] += data[index + channel];
      if (data[index] + data[index + 1] + data[index + 2] > 0) nonblackPixels++;
    }
    assert.ok(nonblackPixels > 0 && sum(rgbTotals) > 0, `${row.imageId}/${seam}/${bank.axis}: empty black screenshot.`);
    const receipt: BankImage = { axis: bank.axis, screenshot: path, sha256: sha256(encoded), width: info.width, height: info.height,
      rgbTotals, luminanceTotal: rgbTotals[0] * .2126 + rgbTotals[1] * .7152 + rgbTotals[2] * .0722,
      chromaticity: rgbTotals.map(value => value / sum(rgbTotals)) as Rgb, nonblackPixels };
    return { data, receipt };
  } finally { await isolation.evaluate(node => node.parentNode?.removeChild(node)); }
}

await mkdir(screenshots, { recursive: true });
let browser: Browser | undefined;
try {
  const ledgerBytes = await readFile(ledgerPath), ledger = JSON.parse(ledgerBytes.toString());
  report.ledgerSha256 = sha256(ledgerBytes);
  assert.equal(ledger.pass, true, 'Result ledger must report verified completed bakes.');
  assert.ok(Array.isArray(ledger.results) && ledger.results.length > 0 && ledger.results.length <= 12, 'Result ledger is empty or unbounded.');
  const rows = ledger.results as Result[];
  assert.ok(rows.every(row => /^[a-z0-9-]+$/.test(row.imageId) && /^[0-9a-f]{64}$/.test(row.resultId)), 'Invalid saved result identity.');
  assert.equal(new Set(rows.map(row => row.resultId)).size, rows.length, 'Duplicate result IDs in ledger.');
  assert.equal(new Set(rows.map(row => row.imageId)).size, rows.length, 'Duplicate image IDs would overwrite screenshots.');
  report.expectedComparisons = rows.length * seams.length;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 1 });
  // This disposable context never reads or changes the user's browser storage. No processing requests are allowed.
  await context.route('**/*', async route => {
    const request = route.request();
    if (['GET', 'HEAD'].includes(request.method())) return route.continue();
    report.forbiddenWrites.push(`${request.method()} ${request.url()}`); await route.abort('blockedbyclient');
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });
  for (const row of rows) for (const seam of seams) {
    console.log('RECONSTRUCTION_STABILITY_CHECK', row.imageId, seam.axes.join('/'));
    const banks = await prepareSeam(page, row, seam), camera = await cameraReceipt(page);
    await page.locator('#viewer .css-volume-projection:not(.reconstruction-original-projection)').evaluateAll(nodes => nodes.forEach((node, index) => {
      (node as HTMLElement).dataset.acceptanceBank = String(index);
    }));
    const pair = banks.filter(bank => seam.axes.some(axis => axis === bank.axis));
    assert.equal(pair.length, 2);
    const [a, b] = [await captureBank(page, row, seam.axes.join('-'), pair[0]), await captureBank(page, row, seam.axes.join('-'), pair[1])];
    assert.deepEqual(await cameraReceipt(page), camera, 'Camera changed between isolated bank captures.');
    assert.equal(a.data.length, b.data.length, 'Screenshot dimensions changed.');
    assert.equal(a.receipt.width, b.receipt.width); assert.equal(a.receipt.height, b.receipt.height);
    let difference = 0; for (let index = 0; index < a.data.length; index++) difference += Math.abs(a.data[index] - b.data[index]);
    const relativeLuminanceDifference = Math.abs(a.receipt.luminanceTotal - b.receipt.luminanceTotal) / Math.max(a.receipt.luminanceTotal, b.receipt.luminanceTotal);
    const normalizedL1 = difference / (sum(a.receipt.rgbTotals) + sum(b.receipt.rgbTotals));
    const receipt: SeamReceipt = { imageId: row.imageId, resultId: row.resultId, seam: seam.axes.join('/'), banks, camera,
      images: [a.receipt, b.receipt], relativeLuminanceDifference, normalizedL1,
      passed: relativeLuminanceDifference <= thresholds.relativeLuminanceDifference && normalizedL1 <= thresholds.normalizedL1 };
    report.measurements.push(receipt);
    console.log('RECONSTRUCTION_STABILITY_MEASURED', JSON.stringify({ imageId: row.imageId, seam: receipt.seam,
      relativeLuminanceDifference, normalizedL1, passed: receipt.passed }));
  }
  assert.deepEqual(report.errors, [], 'Browser errors occurred.');
  assert.deepEqual(report.failedRequests, [], 'Saved resources failed to load.');
  assert.deepEqual(report.forbiddenWrites, [], 'Acceptance attempted a processing/write request.');
  assert.equal(report.measurements.length, report.expectedComparisons, 'Not all image/seam pairs were measured.');
  assert.ok(report.measurements.every(value => value.passed), 'Axis seam exceeds 5% relative luminance or 0.04 normalized L1.');
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  await writeFile(`${outputRoot}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
}
console.log('RECONSTRUCTION_STABILITY_COMPLETE', JSON.stringify({ passed: report.passed, comparisons: report.measurements.length,
  expectedComparisons: report.expectedComparisons, screenshots: report.measurements.length * 2, report: `${outputRoot}/report.json` }));
process.exitCode = report.passed ? 0 : 1;
