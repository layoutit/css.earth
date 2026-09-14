/** Empty observation-only subjects must remain navigable without starting processing. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const candidates = ['m42', 'm8', 'carina', 'ngc6357', 'm78', 'horsehead'];
const output = '.local/nebula-lab/candidate-workspaces-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage(), errors: string[] = [], posts: string[] = [], baselineRequests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() === 'POST') posts.push(request.url());
  if (/compiler-published\/(?:m42|m8|carina|ngc6357|m78|horsehead)\//.test(request.url())) baselineRequests.push(request.url());
});
// Model a clean installation even while the operator prepares candidates in another session.
await page.route(url => candidates.some(id => url.pathname.includes(`/observations/${id}/`) || url.pathname.endsWith(`/compiler-published/${id}.json`)),
  route => route.fulfill({ status: 404, body: 'Not prepared' }));
try {
  for (const id of candidates) {
    await page.goto(`${base}/alignment?subject=${id}`);
    await page.getByRole('button', { name: 'Open nebula compiler', exact: true }).waitFor();
    assert.equal(await page.locator('#subject').inputValue(), id);
    assert.equal(await page.getByRole('tab', { name: 'Alignment', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Open nebula compiler', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false');
    assert.equal(await page.getByRole('button', { name: 'Compile nebula', exact: true }).isEnabled(), true);
    const inspection = page.getByRole('group', { name: 'Inspection mode', exact: true });
    assert.deepEqual(await inspection.getByRole('button').allTextContents(), ['Nebula', 'Structure map', 'Combined']);
    assert.equal(await page.locator('.compiler-empty').isVisible(), true);
    if (id === 'horsehead') await page.screenshot({ path: `${output}/horsehead-empty.png` });
  }
  await page.goto(`${base}/reconstruction?subject=helix-model-prior&inspection=compiler`);
  await page.getByRole('group', { name: 'Inspection mode', exact: true }).waitFor();
  assert.deepEqual(await page.getByRole('group', { name: 'Inspection mode', exact: true }).getByRole('button').allTextContents(),
    ['Nebula', 'Structure map', 'Combined', 'Velocity', 'Joint fit', 'Volume']);
  await page.locator('#subject').selectOption('m42');
  await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false');
  assert.equal(await page.getByRole('button', { name: 'Compile nebula', exact: true }).isEnabled(), true);
  assert.deepEqual(posts, [], 'Browsing started processing.');
  assert.deepEqual(baselineRequests, [], 'An observation-only subject requested an invented volume baseline.');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'passed', candidates, browser: browser.version(),
    missingInputsNavigable: true, compilerAvailable: true, legacyHelixPreserved: true, processingRequests: posts, baselineRequests, errors }, null, 2));
  console.log('PASS six candidate workspaces: clean-input navigation, compiler action, no fake baselines, no processing, Helix capabilities preserved.');
} finally { await browser.close(); }
