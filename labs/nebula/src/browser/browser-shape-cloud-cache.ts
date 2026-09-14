/** Exercise an actual pre-upgrade receipt in a fresh browser context; never modify source receipts or user storage. */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue } from '../alignment/observations-ui/structures-model';
import { readShapeCloudResult } from '../reconstruction/shape-cloud/result';
import { readShapeCloudSettings } from '../reconstruction/shape-cloud/model';
import { SHAPE_CLOUD_PREPARATION_VERSION } from '../reconstruction/shape-cloud/quality';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const cataloguePath = '.local/nebula-lab/observations/helix/structures/catalogue.json';
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8'))), image = catalogue.images[0]!;
const jobs = '.local/nebula-lab/shape-cloud-jobs';
let legacy: { id: string; result: ReturnType<typeof readShapeCloudResult> } | undefined;
for (const name of await readdir(jobs)) {
  if (!name.endsWith('.json')) continue;
  const value: unknown = JSON.parse(await readFile(`${jobs}/${name}`, 'utf8'));
  if (!object(value) || value.status !== 'completed' || typeof value.id !== 'string' || !object(value.result) ||
      value.result.preparationVersion !== undefined || value.result.imageId !== image.id || value.result.geometrySha256 !== image.geometry?.sha256) continue;
  const result = readShapeCloudResult(value.result); if (result.quality !== 'detailed' || !result.neutral || result.empty) continue;
  const bank: unknown = JSON.parse(await readFile(result.neutral.path, 'utf8'));
  if (object(bank) && typeof bank.id === 'string' && bank.id.startsWith('shape-cloud-')) { legacy = { id: value.id, result }; break; }
}
assert.ok(legacy, 'This migration check needs an existing completed pre-upgrade shape-cloud receipt.');
const key = `nebula:shape-cloud:1:${cataloguePath}:${image.id}:${image.sourceSha256}:${image.mapSha256}:${image.geometry?.sha256}`;
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4331';
const directory = '.local/nebula-lab/shape-cloud/cache-browser'; await mkdir(directory, { recursive: true });
const posts: unknown[] = [], errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/__nebula/shape-cloud-jobs')) posts.push(request.postDataJSON()); });
await page.addInitScript(({ key, id, settings }) => {
  if (sessionStorage.getItem('cloud-cache-check-seeded')) return;
  localStorage.setItem(key, JSON.stringify(settings)); localStorage.setItem(`${key}:job`, id);
  sessionStorage.setItem('cloud-cache-check-seeded', 'true');
}, { key, id: legacy.id, settings: legacy.result.settings });
let release = () => {};
const gate = new Promise<void>(resolve => { release = resolve; });
await page.route('**/__nebula/shape-cloud-jobs', async route => { await gate; await route.continue(); });
try {
  await page.goto(`${baseUrl}/reconstruction?subject=helix-model-prior`);
  await page.locator(`[data-shape-cloud-root="${legacy.result.id}"][data-ready="true"]`).waitFor({ timeout: 60_000 });
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), String(legacy.result.settings.components[0]!.weight));
  assert.equal(posts.length, 1, 'A legacy completed preview was not refreshed automatically.');
  const posted = posts[0]; assert.ok(object(posted) && object(posted.request));
  assert.deepEqual(readShapeCloudSettings(posted.request.settings, image.width, image.height), legacy.result.settings, 'Automatic upgrade replaced authored settings.');
  await page.screenshot({ path: `${directory}/legacy-visible-during-upgrade.png` }); release();
  await page.waitForFunction(old => {
    const state = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    return root?.getAttribute('data-ready') === 'true' && root.getAttribute('data-shape-cloud-root') !== old &&
      state?.getAttribute('data-preview-active') === 'false' && state.getAttribute('data-result-id') === root.getAttribute('data-shape-cloud-root');
  }, legacy.result.id, { timeout: 120_000 });
  const currentId = await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root');
  const jobId = await page.evaluate(key => localStorage.getItem(`${key}:job`), key); assert.ok(jobId);
  const response: unknown = await page.request.get(`${baseUrl}/__nebula/shape-cloud-jobs/${jobId}`).then(response => response.json());
  assert.ok(object(response) && object(response.job));
  const upgraded = readShapeCloudResult(response.job.result);
  assert.equal(upgraded.preparationVersion, SHAPE_CLOUD_PREPARATION_VERSION); assert.deepEqual(upgraded.settings, legacy.result.settings);
  await page.reload(); await page.locator(`[data-shape-cloud-root="${currentId}"][data-ready="true"]`).waitFor({ timeout: 60_000 });
  assert.equal(posts.length, 1, 'Reload baked the current preparation version again.');
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', legacyJobId: legacy.id, legacyResultId: legacy.result.id,
    upgradedResultId: currentId, preparationVersion: upgraded.preparationVersion, posts: posts.length, authoredSettingsPreserved: true }, null, 2));
  console.log(JSON.stringify({ status: 'passed', legacyJobId: legacy.id, upgradedResultId: currentId, posts: posts.length }));
} catch (error) { release(); await page.screenshot({ path: `${directory}/failure.png` }); throw error; }
finally { await browser.close(); }
