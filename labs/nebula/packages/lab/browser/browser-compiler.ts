/** Full real compiler flow in an isolated browser; never resets the operator's saved session. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const directory = '.local/nebula-lab/compiler-browser'; await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1600, height: 1050 } }), page = await context.newPage();
const errors: string[] = [], posts: string[] = []; page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
const base = process.argv[2] ?? 'http://127.0.0.1:4331';
async function snapshot(name: string) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); await page.screenshot({ path: `${directory}/${name}.png` }); }
async function ready() {
  await page.waitForFunction(() => Boolean(document.querySelector('.compiler-progress [role="alert"], .compiler-stage [role="alert"]')) ||
    document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false' &&
    document.querySelector('.compiler-stage')?.getAttribute('data-compiler-ready') === 'true' &&
    document.querySelector('.compiler-stage')?.getAttribute('data-compiler-result') === document.querySelector('.compiler-controls')?.getAttribute('data-result-id'), null, { timeout: 180000 });
  assert.equal(await page.locator('.compiler-stage [role="alert"]').count(), 0);
  assert.equal(await page.locator('.compiler-progress [role="alert"]').count(), 0);
}
async function material(id: string, mode = 'textured') {
  await page.waitForFunction(({ id, mode }) => {
    if (document.querySelector('.compiler-stage [role="alert"]')) return true;
    const root = document.querySelector('[data-compiler-root]'); return root?.getAttribute('data-material') === mode && (mode === 'neutral' || root?.getAttribute('data-lens') === id);
  }, { id, mode }, { timeout: 60000 });
  assert.equal(await page.locator('.compiler-stage [role="alert"]').count(), 0, 'Prepared material failed to load.');
}
try {
  await page.goto(`${base}/reconstruction?subject=helix-model-prior&inspection=compiler`);
  await page.getByRole('button', { name: 'Compile nebula', exact: true }).click(); await ready();
  const initialId = await page.locator('.compiler-controls').getAttribute('data-result-id'); assert.ok(initialId);
  const initialLens = await page.locator('#compiler-lens').inputValue(); await material(initialLens); await snapshot('earth');
  const requestCount = posts.length, nodeCount = await page.locator('div[data-compiler-stars] s').count(); assert.ok(nodeCount > 20);
  const host = page.locator('.compiler-stage .shape-cloud-viewport'), rect = await host.boundingBox(); assert.ok(rect);
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 170, rect.y + rect.height / 2 - 100, { steps: 12 }); await page.mouse.up();
  const pose = await page.locator('.compiler-stage').getAttribute('data-compiler-pose'); assert.notEqual(pose, '0,0'); await snapshot('oblique');
  for (const lens of await page.locator('#compiler-lens option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))) {
    await page.locator('#compiler-lens').selectOption(lens); await material(lens); assert.equal(await page.locator('.compiler-stage').getAttribute('data-compiler-pose'), pose); await snapshot(lens);
  }
  await page.getByRole('button', { name: 'Neutral', exact: true }).click(); await material('', 'neutral'); await snapshot('neutral');
  await page.getByRole('checkbox', { name: 'Stars', exact: true }).uncheck(); assert.equal(await page.locator('div[data-compiler-stars]').evaluate(node => getComputedStyle(node).display), 'none');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 90 / .35, rect.y + rect.height / 2, { steps: 12 }); await page.mouse.up();
  await snapshot('neutral-side');
  await page.getByRole('button', { name: 'Textured', exact: true }).click(); await material(await page.locator('#compiler-lens').inputValue()); await snapshot('side');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 - 89 / .35, { steps: 12 }); await page.mouse.up();
  await snapshot('polar');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click(); await page.getByRole('checkbox', { name: 'Original', exact: true }).check(); await snapshot('overlay');
  assert.equal(posts.length, requestCount, 'Display controls started processing.');
  const metadata = (url: URL) => url.pathname.endsWith('/observations/helix/observations.json') || url.pathname.endsWith('/observations/helix/structures/catalogue.json');
  await page.route(metadata, async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue(); });
  const beforeReload = posts.length; await page.reload(); await ready(); assert.equal(posts.length, beforeReload, 'Completed refresh started another compile.');
  await page.unroute(metadata);
  assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), initialId);
  assert.equal(await page.getByRole('checkbox', { name: 'Original', exact: true }).isChecked(), true);
  await page.getByRole('checkbox', { name: 'Original', exact: true }).uncheck(); await page.getByRole('button', { name: 'Textured', exact: true }).click();
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/__nebula/compiler-jobs'));
  await page.locator('#compiler-depth').press('ArrowRight'); const ticket = await accepted; assert.ok(ticket.ok());
  const activeId = await page.locator('.compiler-controls').getAttribute('data-job-id'); assert.ok(activeId);
  const runningCount = posts.length; await page.reload(); await ready(); assert.equal(posts.length, runningCount, 'Refresh duplicated an active compile.');
  assert.notEqual(await page.locator('.compiler-controls').getAttribute('data-result-id'), initialId);
  const compiledId = await page.locator('.compiler-controls').getAttribute('data-result-id');
  await page.setViewportSize({ width: 1100, height: 850 }); await snapshot('compact');
  const cancelTicket = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/__nebula/compiler-jobs'));
  await page.locator('#compiler-depth').press('End'); assert.ok((await cancelTicket).ok());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-job-status') === 'cancelled' &&
    document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false', null, { timeout: 15000 });
  const cancelledPosts = posts.length; await page.reload(); await ready();
  assert.equal(posts.length, cancelledPosts, 'A cancelled compile restarted on refresh.');
  assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), compiledId, 'Cancellation discarded the last completed cloud.');
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', initialId, compiledId, stars: nodeCount, browser: browser.version(),
    viewports: [[1600, 1050], [1100, 850]], dpr: 1, realPipeline: true, threeLenses: true, retainedPose: true, completedRefresh: true, activeRefresh: true,
    delayedMetadataRefresh: true, cancelledRefresh: true, browserErrors: errors }, null, 2));
  console.log('PASS compiler: real processing, three lenses, display controls, rotation, automatic depth refit, delayed/completed/running/cancelled refresh, compact viewport.');
} catch (error) { await snapshot('failure'); throw error; } finally { await browser.close(); }
