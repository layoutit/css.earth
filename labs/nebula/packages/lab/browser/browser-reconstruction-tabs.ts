/** Actual cross-tab image correspondence. Args: [completed-ledger] [base-url] [output-directory]. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type { PreparedReconstruction } from '../src/features/reconstruction/reconstruction-types.ts';
import type { DensityOverlay } from '../src/features/legacy-viewer/controller';

interface Landmark { uv: [number, number]; pixel: [number, number]; }
interface Row { imageId: string; resultId: string; }
interface Fixture { row: Row; prepared: PreparedReconstruction; cataloguePath: string; image: DensityOverlay; landmarks: Landmark[]; }
const ledgerPath = resolve(process.argv[2] ?? '.local/nebula-lab/alignment-material-acceptance.json');
const baseURL = process.argv[3] ?? 'http://127.0.0.1:4331';
const output = resolve(process.argv[4] ?? '.local/nebula-lab/reconstruction-tabs');
const report: { ledger: string; passed: boolean; checks: unknown[]; errors: string[]; writes: string[]; metadataReads: string[]; failure?: string } = {
  ledger: ledgerPath, passed: false, checks: [], errors: [], writes: [], metadataReads: [],
};
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const screenshotName = (id: string, view: string) => `${output}/${id}-${view}.png`;

async function earthReady(page: Page) {
  await page.locator('#reference-view').click();
  await page.waitForFunction(() => {
    const host = document.querySelector<HTMLElement>('#viewer');
    return host?.dataset.ready === 'true' && Number(host.dataset.earthFramingRadius) > 0;
  });
  await page.waitForTimeout(100);
}
async function project(page: Page, selector: string, pixels: readonly number[][]) {
  return page.evaluate(({ selector, pixels }) => {
    const host = document.querySelector<HTMLElement>('#viewer')!;
    const leaves = [...host.querySelectorAll<HTMLElement>(selector)];
    const leaf = leaves.find(node => {
      const bank = node.closest<HTMLElement>('.css-volume-projection');
      return bank && getComputedStyle(bank).visibility === 'visible' && Number(getComputedStyle(bank).opacity) > 0;
    });
    if (!leaf) throw new Error(`No visible original leaf for ${selector}.`);
    const bank = leaf.closest<HTMLElement>('.css-volume-projection')!;
    const plane = new DOMMatrix(leaf.style.transform), scene = new DOMMatrix(bank.querySelector<HTMLElement>('.css-volume-scene')!.style.transform);
    const focal = parseFloat(bank.querySelector<HTMLElement>('.css-volume-camera')!.style.perspective);
    const hostTransform = new DOMMatrix(getComputedStyle(host).transform), box = host.getBoundingClientRect();
    const points = pixels.map(([u, v]) => {
      const p = scene.transformPoint(plane.transformPoint(new DOMPoint(u, v, 0, 1)));
      const denominator = focal * p.w - p.z;
      if (!(denominator > 0)) throw new Error('An image landmark is behind the Earth camera.');
      const screen = hostTransform.transformPoint(new DOMPoint(focal * p.x / denominator, focal * p.y / denominator, 0, 1));
      return [box.x + box.width / 2 + screen.x, box.y + box.height / 2 + screen.y];
    });
    return { points, distance: Number(host.dataset.distance), focal, framingRadius: Number(host.dataset.earthFramingRadius),
      cameraTransform: bank.querySelector<HTMLElement>('.css-volume-scene')!.style.transform,
      cameraMatrix: Array.from(scene.toFloat64Array()) };
  }, { selector, pixels });
}

await mkdir(output, { recursive: true });
let browser: Browser | undefined;
try {
  const ledger = await json(ledgerPath); assert.equal(ledger.pass, true);
  const rows = ledger.results as Row[];
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= 12);
  const fixtures: Fixture[] = [];
  for (const row of rows) {
    assert.match(row.imageId, /^[a-z0-9-]+$/); assert.match(row.resultId, /^[a-f0-9]{64}$/);
    const prepared = await json(`.local/nebula-lab/reconstructions/${row.resultId}/result.json`) as PreparedReconstruction;
    assert.equal(prepared.resultId, row.resultId); assert.equal(prepared.imageId, row.imageId);
    const provenance = await json(`${prepared.subject.directory}/source/provenance.json`);
    const landmarks = provenance.geometry.originalImageLandmarks as Landmark[];
    assert.ok(Array.isArray(landmarks) && landmarks.length === 9, 'Need nine source-UV landmarks from the actual original-image painter.');
    assert.deepEqual(landmarks.map(point => point.uv).sort(), [0, .5, 1].flatMap(v => [0, .5, 1].map(u => [u, v])).sort());
    assert.ok(landmarks.every(point => point.pixel.length === 2 && point.pixel.every(Number.isFinite)));
    const cataloguePath = prepared.subject.density?.overlays; assert.ok(cataloguePath);
    const catalogue = await json(cataloguePath), image = catalogue.overlays.find((item: DensityOverlay) => item.id === row.imageId) as DensityOverlay;
    assert.ok(image); fixtures.push({ row, prepared, cataloguePath, image, landmarks });
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 1 });
  await context.route('**/*', async route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    // This existing POST reads source identity/dimensions only. Preview/apply/job actions remain forbidden.
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === '/__nebula/star-removal') {
      const body = request.postDataJSON();
      if (body?.action === 'overview' && typeof body.imageId === 'string' && Object.keys(body).every(key => ['action', 'imageId'].includes(key))) {
        report.metadataReads.push(body.imageId); return route.continue();
      }
    }
    if (request.method() === 'POST' && path === '/__nebula/prepare-tone') {
      const body = request.postDataJSON(), tone = body?.tone;
      // Existing neutral-original pass-through verifies the asset and returns its URL; it never bakes pixels.
      if (body?.target === 'image' && body.imageLayer === 'original' &&
          tone?.brightness === 1 && tone.gamma === 1 && tone.black === 0 && tone.white === 1) {
        report.metadataReads.push(`neutral-original:${body.imageId}`); return route.continue();
      }
    }
    report.writes.push(`${route.request().method()} ${route.request().url()}`); await route.abort('blockedbyclient');
  });
  // Reproduce the exact placement approved for each saved result in an isolated context, never the user's storage.
  const catalogueRows = new Map<string, unknown[]>();
  for (const f of fixtures) {
    const list = catalogueRows.get(f.cataloguePath) ?? [];
    list.push({ id: f.row.imageId, enabled: false, opacity: .55, placement: f.prepared.placement,
      defaultPlacement: f.image.initialPlacement, basis: f.image.style.transform });
    catalogueRows.set(f.cataloguePath, list);
  }
  await context.addInitScript(catalogues => localStorage.setItem('cssearth-nebula-overlay-state-v1',
    JSON.stringify({ schema: 'cssearth-nebula-overlay-state@1', catalogues })), [...catalogueRows]);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  for (const fixture of fixtures) {
    const { row, prepared, image, landmarks } = fixture;
    console.log('RECONSTRUCTION_TABS_CHECK', row.imageId);
    const aligned: { route: string; projection: Awaited<ReturnType<typeof project>>; screenshot: string }[] = [];
    for (const route of ['lmc-particles', 'lmc-clouds']) {
      const url = new URL('/alignment', baseURL); url.searchParams.set('subject', route);
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
        !document.querySelector<HTMLSelectElement>('#overlay-choice')?.disabled, null, { timeout: 30000 });
      await page.selectOption('#overlay-choice', row.imageId);
      await page.locator('[data-image-layer="original"]').click();
      await page.locator('#overlay-enabled').check();
      await earthReady(page);
      await page.waitForFunction(id => [...document.querySelectorAll<HTMLElement>('[data-overlay-leaf]')]
        .some(node => node.dataset.overlayLeaf === id && node.dataset.imageLayer === 'original' && node.style.visibility !== 'hidden'), row.imageId);
      const projection = await project(page, `[data-overlay-leaf="${row.imageId}"]`, landmarks.map(point => [point.uv[0] * image.widthPx, point.uv[1] * image.heightPx]));
      const screenshot = screenshotName(row.imageId, `alignment-${route}`); await page.screenshot({ path: screenshot });
      aligned.push({ route, projection, screenshot });
    }
    const url = new URL('/reconstruction', baseURL); url.searchParams.set('subject', prepared.subject.id);
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(id => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' &&
      document.querySelector<HTMLElement>('[data-reconstruction-result]')?.dataset.reconstructionResult === id,
    row.resultId, { timeout: 30000 });
    await earthReady(page); await page.locator('#reconstruction-original-enabled').check();
    await page.locator('[data-reconstruction-original-leaf]').waitFor({ state: 'visible' });
    const reconstructed = await project(page, '[data-reconstruction-original-leaf]', landmarks.map(point => point.pixel));
    const screenshot = screenshotName(row.imageId, 'reconstruction'); await page.screenshot({ path: screenshot });
    for (const entry of aligned) {
      assert.equal(reconstructed.focal, entry.projection.focal, `${row.imageId}/${entry.route}: Earth lens changed across tabs.`);
      assert.equal(reconstructed.distance, entry.projection.distance, `${row.imageId}/${entry.route}: Earth observer distance changed.`);
      assert.equal(reconstructed.framingRadius, entry.projection.framingRadius, `${row.imageId}/${entry.route}: Earth framing changed.`);
      assert.ok(reconstructed.cameraMatrix.every((value, index) => Math.abs(value - entry.projection.cameraMatrix[index]) <= 1e-8),
        `${row.imageId}/${entry.route}: Earth camera matrix changed beyond floating-point transport precision.`);
      const errorsPx = reconstructed.points.map((point, index) => Math.hypot(point[0] - entry.projection.points[index][0], point[1] - entry.projection.points[index][1]));
      const maximumErrorPx = Math.max(...errorsPx);
      report.checks.push({ imageId: row.imageId, resultId: row.resultId, route: entry.route, placement: prepared.placement,
        alignment: entry.projection, reconstruction: reconstructed, errorsPx, maximumErrorPx, screenshots: [entry.screenshot, screenshot] });
      assert.ok(maximumErrorPx <= .05, `${row.imageId}/${entry.route}: same image landmarks moved ${maximumErrorPx}px between tabs.`);
    }
  }
  assert.equal(report.checks.length, fixtures.length * 2); assert.deepEqual(report.errors, []); assert.deepEqual(report.writes, []);
  report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
finally { await browser?.close(); await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`); }
console.log('RECONSTRUCTION_TABS_COMPLETE', JSON.stringify({ passed: report.passed, checks: report.checks.length, report: `${output}/report.json` }));
process.exitCode = report.passed ? 0 : 1;
