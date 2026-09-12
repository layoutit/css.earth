/** Real detector jobs and source-scoped proposal inspection; isolated browser storage only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue } from '../alignment/observations-ui/structures-model.js';
import { readGeometryMap } from '../alignment/observations-ui/geometry-model.js';
import { readDetectionResult } from '../reconstruction/geometry/jobs-model.js';

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
const cloudPosts = () => posts.filter(url => url.endsWith('/shape-cloud-jobs')).length;
const controls = page.getByRole('region', { name: 'Detector', exact: true });
async function cloudReady() {
  await page.waitForFunction(() => {
    const state = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    return Boolean(document.querySelector('.shape-cloud-error')) || (state?.getAttribute('data-preview-quality') === 'detailed' &&
      state.getAttribute('data-preview-current') === 'true' && state.getAttribute('data-preview-active') === 'false' &&
      state.getAttribute('data-result-id') === root?.getAttribute('data-shape-cloud-root') && root?.getAttribute('data-ready') === 'true');
  }, null, { timeout: 90_000 });
  assert.deepEqual(await page.locator('.shape-cloud-error').allTextContents(), []);
}
async function proposal() {
  await page.waitForFunction(() => {
    const detector = document.querySelector('.geometry-detection-controls');
    return Boolean(detector?.querySelector('[role="alert"]')) || Boolean(detector?.getAttribute('data-pending-sha'));
  }, null, { timeout: 90_000 });
  assert.deepEqual(await controls.getByRole('alert').allTextContents(), []);
  const id = await controls.getAttribute('data-job-id'); assert.ok(id);
  const response = await page.request.get(`${baseUrl}/__nebula/geometry-jobs/${id}`);
  assert.ok(response.ok());
  const envelope: unknown = await response.json();
  assert.ok(envelope && typeof envelope === 'object' && 'job' in envelope && envelope.job && typeof envelope.job === 'object' && 'result' in envelope.job);
  const result = readDetectionResult(envelope.job.result);
  const bytes = await readFile(`${source.directory}/${result.geometry.file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), result.geometry.sha256);
  return { result, geometry: readGeometryMap(JSON.parse(bytes.toString()), source) };
}
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4331';
try {
  await page.goto(`${baseUrl}/reconstruction?subject=helix-model-prior`); await cloudReady();
  assert.ok(source.geometry && other.geometry);
  const weightSlider = page.locator('#shape-cloud-weight'); await weightSlider.press('ArrowRight'); await weightSlider.press('ArrowRight'); await cloudReady();
  const weight = await weightSlider.inputValue(), rootId = await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root');
  const root = await page.locator('[data-shape-cloud-root]').elementHandle(); assert.ok(root);
  const oldCloudPosts = cloudPosts();
  await controls.getByRole('button', { name: 'Detect', exact: true }).click();
  const first = await proposal();
  const canonical = readGeometryMap(JSON.parse(await readFile(`${source.directory}/${source.geometry.file}`, 'utf8')), source);
  assert.deepEqual(first.geometry, canonical, '100% default changed the accepted automatic initialization.');
  assert.equal(await root.evaluate(node => node.isConnected), true, 'Detect replaced the edited cloud scene.');
  assert.equal(cloudPosts(), oldCloudPosts, 'Detection must not bake or apply a cloud.');
  assert.equal(await controls.getAttribute('data-applied-sha'), source.geometry.sha256);
  assert.equal(await page.locator('.shape-cloud-workspace').isVisible(), false);
  assert.equal(await page.locator('.structure-geometry:visible').count(), 1);
  await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: `${output}/default-proposals-1600.png` });
  const beforeControls = detectionPosts();
  await page.locator('#detector-sensitivity').press('End');
  await page.locator('#detector-minimum-size').press('Home');
  await page.locator('#detector-maximum-shapes').press('End');
  assert.equal(detectionPosts(), beforeControls);
  assert.equal(await controls.getByRole('button', { name: 'Apply proposals', exact: true }).isEnabled(), false);
  // Refresh after the server acknowledges ownership, rather than before the click's async submission.
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/geometry-jobs') && response.request().method() === 'POST' && response.ok()),
    controls.getByRole('button', { name: 'Detect', exact: true }).click(),
  ]);
  await page.reload();
  const second = await proposal();
  assert.equal(detectionPosts(), beforeControls + 1, 'Reload started another detector job.');
  assert.equal(second.result.settings.sensitivity, 4); assert.equal(second.result.settings.minRadiusFraction, .02); assert.equal(second.result.settings.maxCandidates, 32);
  assert.notDeepEqual(second.geometry.candidates, first.geometry.candidates, 'Detector controls did not change actual proposals.');
  assert.equal(await controls.getAttribute('data-applied-sha'), source.geometry.sha256);
  await cloudReady(); assert.equal(await weightSlider.inputValue(), weight);
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.getByRole('button', { name: 'Fit all images', exact: true }).click();
  await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
  const rows = await controls.locator('.structure-slider').evaluateAll(nodes => nodes.map(node => {
    const children = [...node.children].map(child => child.getBoundingClientRect());
    return { overflow: node.scrollWidth > node.clientWidth + 1, centers: children.map(rect => rect.y + rect.height / 2) };
  }));
  assert.ok(rows.every(row => !row.overflow && Math.max(...row.centers) - Math.min(...row.centers) < 4), 'Detector sliders must stay on a single line.');
  await page.screenshot({ path: `${output}/sensitive-proposals-1000.png` });
  await controls.getByRole('button', { name: 'Apply proposals', exact: true }).click(); await cloudReady();
  assert.equal(await controls.getAttribute('data-applied-sha'), second.result.geometry.sha256);
  assert.notEqual(await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root'), rootId);
  const appliedPosts = posts.length;
  await page.reload(); await cloudReady();
  assert.equal(await controls.getAttribute('data-applied-sha'), second.result.geometry.sha256);
  assert.equal(posts.length, appliedPosts, 'Reload reprocessed a completed applied proposal.');
  await controls.getByRole('button', { name: 'Restore previous cloud', exact: true }).click(); await cloudReady();
  assert.equal(await controls.getAttribute('data-applied-sha'), source.geometry.sha256);
  assert.equal(await weightSlider.inputValue(), weight, 'Restore lost the previous authored weight.');
  assert.equal(await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root'), rootId);
  await page.locator('#structure-image').selectOption(other.id);
  await page.waitForFunction(sha => document.querySelector('.geometry-detection-controls')?.getAttribute('data-applied-sha') === sha, other.geometry.sha256);
  assert.equal(await page.locator('#detector-sensitivity').inputValue(), '100');
  assert.equal(await controls.getAttribute('data-pending-sha'), '');
  await controls.getByRole('button', { name: 'Detect', exact: true }).click();
  await controls.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.geometry-detection-controls')?.getAttribute('data-job-status') === 'cancelled', null, { timeout: 30_000 });
  assert.equal(await controls.getAttribute('data-pending-sha'), '');
  assert.equal(await controls.getAttribute('data-applied-sha'), other.geometry.sha256);
  for (const pin of originals) assert.equal(await hash(pin.path), pin.hash, `Detection changed ${pin.path}`);
  assert.deepEqual(errors, []);
  const result = { status: 'passed', baselineCandidates: first.geometry.candidates.length, sensitiveCandidates: second.geometry.candidates.length,
    sourceAndCatalogueUnchanged: true, retainedBeforeApply: true, restoredEditedCloud: true, refreshResumed: true, cancelled: true, detectionPosts: detectionPosts() };
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) { await page.screenshot({ path: `${output}/failure.png` }); throw error; }
finally { await browser.close(); }
