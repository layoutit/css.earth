/** Inspect CLI-prepared candidates through their public lab URLs without recompiling. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const checkCancellation = process.argv.includes('--cancel');
const candidates = process.argv.slice(3).filter(value => value !== '--cancel'); if (!candidates.length) candidates.push('m42');
if (candidates.some(id => !/^[a-z0-9-]+$/.test(id))) throw new TypeError('Invalid candidate id.');
const output = '.local/nebula-lab/candidate-published-browser'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 } });
const page = await context.newPage(), errors: string[] = [], posts: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
async function ready() {
  await page.waitForFunction(() => Boolean(document.querySelector('.compiler-progress [role="alert"], .compiler-stage [role="alert"]')) ||
    document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false' &&
    document.querySelector('.compiler-stage')?.getAttribute('data-compiler-ready') === 'true', null, { timeout: 60000 });
  assert.deepEqual(await page.locator('.compiler-progress [role="alert"], .compiler-stage [role="alert"]').allTextContents(), []);
}
async function material(id: string, mode = 'textured') {
  await page.waitForFunction(({ id, mode }) => {
    const root = document.querySelector('[data-compiler-root]');
    return root?.getAttribute('data-material') === mode && (mode === 'neutral' || root?.getAttribute('data-lens') === id);
  }, { id, mode }, { timeout: 60000 });
}
async function snapshot(name: string) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await page.screenshot({ path: `${output}/${name}.png` }); }
const receipts: { id: string; result: string; lenses: string[]; stars: number }[] = [];
try {
  for (const id of candidates) {
    await page.goto(`${base}/reconstruction?subject=${id}&inspection=compiler`); await ready();
    const result = await page.locator('.compiler-controls').getAttribute('data-result-id'); assert.ok(result);
    const lenses = await page.locator('#compiler-lens option').evaluateAll(items => items.map(item => (item as HTMLOptionElement).value));
    assert.ok(lenses.length > 0);
    const stars = await page.locator('div[data-compiler-stars] s').count(); assert.ok(stars > 0);
    for (const lens of lenses) {
      await page.locator('#compiler-lens').selectOption(lens); await material(lens); await snapshot(`${id}-${lens}-earth`);
    }
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    const rect = await page.locator('.compiler-stage .shape-cloud-viewport').boundingBox(); assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 170, rect.y + rect.height / 2 - 100, { steps: 12 }); await page.mouse.up();
    const pose = await page.locator('.compiler-stage').getAttribute('data-compiler-pose'); assert.notEqual(pose, '0,0');
    for (const lens of lenses) {
      await page.locator('#compiler-lens').selectOption(lens); await material(lens); await snapshot(`${id}-${lens}-oblique`);
      assert.equal(await page.locator('.compiler-stage').getAttribute('data-compiler-pose'), pose);
    }
    await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral'); await snapshot(`${id}-neutral-oblique`);
    await page.getByRole('checkbox', { name: 'Stars', exact: true }).uncheck();
    assert.equal(await page.locator('div[data-compiler-stars]').evaluate(node => getComputedStyle(node).display), 'none');
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Original', exact: true }).check();
    await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('[data-compiler-original-source]'); return image?.complete && image.naturalWidth > 0; });
    await snapshot(`${id}-original`); await page.reload(); await ready();
    assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), result);
    assert.equal(await page.getByRole('checkbox', { name: 'Original', exact: true }).isChecked(), true);
    receipts.push({ id, result, lenses, stars });
  }
  assert.deepEqual(errors, []); assert.deepEqual(posts, [], 'Inspecting a CLI-prepared cloud started processing.');
  if (checkCancellation) {
    const originalResult = await page.locator('.compiler-controls').getAttribute('data-result-id');
    const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/__nebula/compiler-jobs'));
    await page.locator('#compiler-depth').press('ArrowRight'); assert.ok((await accepted).ok());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-job-status') === 'cancelled');
    const cancelledPosts = posts.length; await page.reload(); await ready();
    assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), originalResult);
    assert.equal(posts.length, cancelledPosts, 'Cancelled publication refit restarted on refresh.');
  }
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'passed', candidates: receipts, browser: browser.version(),
    directLoad: true, sourceSwitch: true, orbit: true, stars: true, originalOverlay: true, refresh: true, cancelledRefitRefresh: checkCancellation, errors, posts }, null, 2));
  console.log(`PASS prepared candidate inspection: ${receipts.map(item => `${item.id} (${item.lenses.length} lenses, ${item.stars} stars)`).join(', ')}.`);
} catch (error) { await snapshot('failure'); throw error; } finally { await browser.close(); }
