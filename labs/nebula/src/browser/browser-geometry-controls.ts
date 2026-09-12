/** Real slider gestures, visible drafts, source isolation and durable reload. Uses isolated browser storage. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue } from '../alignment/observations-ui/structures-model';
import { readGeometryMap } from '../alignment/observations-ui/geometry-model';
import { readCloudJob } from '../components/shape-cloud-client';
import { readDetectionResult } from '../reconstruction/geometry/jobs-model';

const cataloguePath = '.local/nebula-lab/observations/helix/structures/catalogue.json';
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8'))), source = catalogue.images[0]!, other = catalogue.images[1]!;
const output = '.local/nebula-lab/geometry-controls-browser'; await mkdir(output, { recursive: true });
const hash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
const pins = [cataloguePath, ...catalogue.images.flatMap(image => [`${image.directory}/source.png`, `${image.directory}/map.json`])];
const originals = await Promise.all(pins.map(async path => ({ path, hash: await hash(path) })));
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage(), errors: string[] = [], posts: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
const detectionPosts = () => posts.filter(url => url.endsWith('/geometry-jobs')).length;
const controls = page.getByRole('region', { name: 'Detector', exact: true });
async function cloudReady() {
  await page.waitForFunction(() => {
    const state = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    const detector = document.querySelector('.geometry-detection-controls');
    return Boolean(document.querySelector('.shape-cloud-error')) || (state?.getAttribute('data-preview-quality') === 'detailed' &&
      detector?.getAttribute('data-active') === 'false' && detector.getAttribute('data-quality') === 'detailed' && !['running', 'queued', 'cancelling'].includes(detector.getAttribute('data-job-status') ?? '') &&
      state.getAttribute('data-preview-current') === 'true' && state.getAttribute('data-preview-active') === 'false' &&
      state.getAttribute('data-result-id') === root?.getAttribute('data-shape-cloud-root') && root?.getAttribute('data-ready') === 'true');
  }, null, { timeout: 90_000 });
  assert.deepEqual(await page.locator('.shape-cloud-error').allTextContents(), []);
}
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4331';
try {
  await page.goto(`${baseUrl}/reconstruction?subject=helix-model-prior`); await cloudReady();
  assert.ok(source.geometry && other.geometry);
  assert.equal(await controls.getByRole('button', { name: /Detect|Apply|Accept/ }).count(), 0);
  assert.equal(detectionPosts(), 0, 'Opening an untouched detector must not start work.');
  const host = await page.locator('.shape-cloud-render-host').elementHandle(); assert.ok(host);
  const originalRoot = await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root');
  await page.getByRole('button', { name: 'Overlay', exact: true }).click();
  await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
  const viewport = await page.locator('.shape-cloud-output-slot .shape-cloud-viewport').boundingBox(); assert.ok(viewport);
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2); await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 + 35, viewport.y + viewport.height / 2 + 20); await page.mouse.up();
  const pose = await page.locator('[data-shape-cloud-root]').getAttribute('data-pose');
  const slider = page.locator('#detector-sensitivity'); await slider.scrollIntoViewIfNeeded();
  const bounds = await slider.boundingBox(); assert.ok(bounds);
  const drafts = new Set<string>(), start = Date.now(); let events = 0, firstDraftMs = 0;
  await page.mouse.move(bounds.x + bounds.width * .24, bounds.y + bounds.height / 2); await page.mouse.down();
  while (Date.now() - start < 25_000 && drafts.size < 2) {
    await page.mouse.move(bounds.x + bounds.width * (.25 + Math.min(.2, events++ * .003)), bounds.y + bounds.height / 2);
    await page.waitForTimeout(250);
    assert.equal(await slider.isEnabled(), true, 'Busy detector disabled live tuning.');
    assert.equal(await page.locator('.shape-cloud-workspace').isVisible(), true, 'A detector result switched out of the cloud.');
    const root = page.locator('[data-shape-cloud-root]');
    const id = await root.getAttribute('data-shape-cloud-root'); assert.ok(id, 'The cloud disappeared during processing.');
    const quality = await page.locator('.shape-cloud-workbench').getAttribute('data-preview-quality');
    if (id !== originalRoot && quality === 'draft') { drafts.add(id); if (!firstDraftMs) firstDraftMs = Date.now() - start; }
  }
  assert.ok(drafts.size >= 1, 'No changed cloud appeared while the detector slider was held.');
  await page.mouse.up(); await cloudReady();
  assert.equal(await host.evaluate(node => node.isConnected), true, 'Detection remounted the viewer host.');
  assert.equal(await page.locator('[data-shape-cloud-root]').getAttribute('data-pose'), pose, 'Detector changed the camera.');
  assert.equal(await page.getByRole('button', { name: 'Overlay', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.ok(detectionPosts() < events, 'Every pointer event became a queued detector job.');
  const sensitivity = Number(await slider.inputValue()) / 100;
  const id = await controls.getAttribute('data-job-id'); assert.ok(id);
  const response = await page.request.get(`${baseUrl}/__nebula/geometry-jobs/${id}`); assert.ok(response.ok());
  const envelope: unknown = await response.json();
  assert.ok(envelope && typeof envelope === 'object' && 'job' in envelope && envelope.job && typeof envelope.job === 'object' && 'result' in envelope.job);
  const result = readDetectionResult(envelope.job.result); assert.equal(result.quality, 'detailed'); assert.equal(result.settings.sensitivity, sensitivity);
  const geometry = readGeometryMap(JSON.parse(await readFile(`${source.directory}/${result.geometry.file}`, 'utf8')), source);
  const baseline = readGeometryMap(JSON.parse(await readFile(`${source.directory}/${source.geometry.file}`, 'utf8')), source);
  assert.notDeepEqual(geometry.candidates, baseline.candidates);
  assert.equal(await controls.getAttribute('data-applied-sha'), result.geometry.sha256);
  const completePosts = posts.length;
  await page.reload(); await cloudReady();
  assert.equal(posts.length, completePosts, 'Reload reprocessed the current final fit.');
  assert.equal(Number(await slider.inputValue()) / 100, sensitivity);
  const [started] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/geometry-jobs') && response.request().method() === 'POST' && response.ok() &&
      response.request().postDataJSON().request.quality === 'detailed'),
    slider.press('ArrowRight'),
  ]);
  const activeId = readCloudJob(await started.json(), source.id).id;
  await page.reload(); await cloudReady();
  assert.equal(await controls.getAttribute('data-job-id'), activeId, 'Refresh did not reconnect to the accepted final request.');
  await page.locator('#structure-image').selectOption(other.id);
  await page.waitForFunction(sha => document.querySelector('.geometry-detection-controls')?.getAttribute('data-applied-sha') === sha, other.geometry.sha256);
  assert.equal(await slider.inputValue(), '100', 'Detector settings leaked across sources.');
  await page.locator('#structure-image').selectOption(source.id); await cloudReady();
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: `${output}/live-structure-1600.png` });
  await page.setViewportSize({ width: 1000, height: 1000 });
  const rows = await controls.locator('.structure-slider').evaluateAll(nodes => nodes.map(node => {
    const children = [...node.children].map(child => child.getBoundingClientRect());
    return { overflow: node.scrollWidth > node.clientWidth + 1, centers: children.map(rect => rect.y + rect.height / 2) };
  }));
  assert.ok(rows.every(row => !row.overflow && Math.max(...row.centers) - Math.min(...row.centers) < 4));
  await page.screenshot({ path: `${output}/live-structure-1000.png` });
  for (const pin of originals) assert.equal(await hash(pin.path), pin.hash, `Detection changed ${pin.path}`);
  assert.deepEqual(errors, []);
  const report = { status: 'passed', visibleDrafts: drafts.size, firstDraftMs, events, detectionPosts: detectionPosts(),
    retainedHostAndCamera: true, refreshResumed: true, sourceIsolated: true, finalSettings: result.settings };
  await writeFile(`${output}/result.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) { await page.screenshot({ path: `${output}/failure.png` }); throw error; }
finally { await browser.close(); }
