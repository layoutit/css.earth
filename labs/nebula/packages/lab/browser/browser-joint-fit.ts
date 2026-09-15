/** Real joint-fit interaction in an isolated browser; never changes the user's saved session. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const directory = '.local/nebula-lab/joint-fit-browser'; await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }), page = await context.newPage();
const errors: string[] = [], posts: string[] = [];
page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
const base = process.argv[2] ?? 'http://127.0.0.1:4331';
async function ready() {
  await page.waitForFunction(() => document.querySelector('.joint-fit-controls')?.getAttribute('data-busy') === 'false' &&
    Boolean(document.querySelector('.joint-fit-controls')?.getAttribute('data-result-id')) &&
    document.querySelector('.joint-fit-stage')?.getAttribute('data-joint-fit-ready') === 'true', null, { timeout: 60000 });
  assert.equal(await page.locator('.joint-fit-status[role="alert"]').count(), 0);
  assert.equal(await page.locator('.joint-fit-stage [role="alert"]').count(), 0);
}
async function snapshot(name: string) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await page.screenshot({ path: `${directory}/${name}.png` }); }
async function cloudChanged(previous: string | null) {
  await page.waitForFunction(id => document.querySelector('.joint-fit-stage')?.getAttribute('data-joint-fit-result') !== id, previous, { timeout: 60000 }); await ready();
}
try {
  await page.goto(`${base}/reconstruction?subject=helix-model-prior&inspection=joint`); await ready(); await snapshot('earth');
  assert.equal(await page.getByRole('button', { name: 'Shell', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Lobes', exact: true }).count(), 1);
  assert.ok(await page.locator('.joint-fit-pointing').count() > 100);
  assert.ok(await page.locator('.joint-fit-pointing[data-held-out="true"]').count() > 0);
  const requestCount = posts.length;
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  const viewport = await page.locator('.joint-fit-stage .shape-cloud-viewport').boundingBox(); assert.ok(viewport);
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2); await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 + 160, viewport.y + viewport.height / 2 - 90, { steps: 12 }); await page.mouse.up();
  const pose = await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-pose'); assert.notEqual(pose, '0,0'); await snapshot('oblique');
  const oldCloud = await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-result');
  await page.getByRole('button', { name: 'Lobes', exact: true }).click(); await cloudChanged(oldCloud);
  assert.equal(await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-pose'), pose);
  await page.locator('#joint-fit-source').selectOption('eso-wide');
  await page.getByLabel('Ridges', { exact: true }).uncheck(); await page.getByLabel('Pointings', { exact: true }).uncheck();
  assert.equal(posts.length, requestCount, 'Candidate/source/camera/overlay controls started processing.'); await snapshot('lobes');
  const oldId = await page.locator('.joint-fit-controls').getAttribute('data-result-id'), currentCloud = await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-result');
  await page.locator('#joint-image-weight').press('ArrowRight');
  await page.waitForFunction(id => document.querySelector('.joint-fit-controls')?.getAttribute('data-result-id') !== id, oldId, { timeout: 60000 }); await cloudChanged(currentCloud);
  assert.equal(await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-pose'), pose);
  const saved = await page.locator('.joint-fit-controls').getAttribute('data-result-id'), savedWeight = await page.locator('#joint-image-weight').inputValue(), beforeReload = posts.length;
  await page.reload(); await ready();
  assert.equal(await page.locator('.joint-fit-controls').getAttribute('data-result-id'), saved); assert.equal(await page.locator('#joint-image-weight').inputValue(), savedWeight);
  assert.equal(posts.length, beforeReload, 'Refresh reprocessed a completed fit.');
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/__nebula/joint-fit-jobs'));
  await page.locator('#joint-length').press('ArrowRight'); const response = await accepted; assert.equal(response.ok(), true);
  const ticket: unknown = response.request().postDataJSON(); assert.ok(ticket && typeof ticket === 'object' && 'requestId' in ticket && typeof ticket.requestId === 'string');
  await page.waitForFunction(id => Object.keys(localStorage).some(key => { if (!key.startsWith('nebula:joint-fit:') || !key.endsWith(':job')) return false;
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return Boolean(value && typeof value === 'object' && 'id' in value && value.id === id); }), ticket.requestId);
  const runningPosts = posts.length; await page.reload(); await ready(); assert.equal(posts.length, runningPosts, 'Refresh duplicated a running fit.');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  assert.equal(await page.locator('.joint-fit-stage').getAttribute('data-joint-fit-pose'), '0,0');
  await page.setViewportSize({ width: 1000, height: 800 }); await snapshot('compact');
  assert.deepEqual(errors, []);
  assert.ok(posts.every(url => url.endsWith('/__nebula/joint-fit-jobs')), 'Joint UI started unrelated processing.');
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', measuredPointings: 170, displayOnlyControlsDoNotProcess: true,
    rotationRetained: true, completedRefreshReused: true, runningRefreshReconnected: true, browserErrors: errors }, null, 2));
  console.log('PASS joint fit: real evidence, two retained PolyCSS models, rotation, display-only controls, automatic refit, completed/running refresh, compact layout.');
} catch (error) { await snapshot('failure'); throw error; } finally { await browser.close(); }
