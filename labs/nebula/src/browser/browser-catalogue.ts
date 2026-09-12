/** Read-only catalogue inspection, with explicit missing/error snapshot checks. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readMessierCatalogue, readMessierInventory, type MessierInventory } from '../catalogue/types';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const allowMissing = process.argv.includes('--allow-missing');
const directory = '.local/nebula-lab/catalogue-browser'; await mkdir(directory, { recursive: true });
const catalogue = readMessierCatalogue(JSON.parse(await readFile('labs/nebula/models/messier/catalogue.json', 'utf8')));
let inventory: MessierInventory | null = null;
try { inventory = readMessierInventory(JSON.parse(await readFile('.local/nebula-lab/catalogue/messier/index.json', 'utf8'))); }
catch (error) { if (!allowMissing) throw error; }
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
await context.addInitScript(() => localStorage.setItem('catalogue-browser-preserve', 'unchanged'));
const page = await context.newPage(), errors: string[] = [], processing: string[] = [], science: string[] = [];
const recordRequests: string[] = [], visited = new Set(['m42']);
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() === 'POST') processing.push(request.url());
  if (/\.fits?(?:\.fz)?(?:[?&#]|$)/i.test(decodeURIComponent(request.url()))) science.push(request.url());
  const records = new URL(request.url()).pathname.match(/\/queries\/(m\d+)-(?:mast|irsa|eso)\.json$/);
  if (records) recordRequests.push(records[1]!);
});
const snapshot = (url: URL) => url.pathname.endsWith('/.local/nebula-lab/catalogue/messier/index.json');
async function ready() { await page.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('.catalogue-status button'); return Boolean(button && !button.disabled); }); }
async function recordsReady() { await page.waitForFunction(() => !document.querySelector('.catalogue-archive[aria-busy="true"]')); }
async function screen(name: string) {
  if (name !== 'failure') await page.waitForFunction(() => {
    const portrait = document.querySelector<HTMLImageElement>('.catalogue-object-portrait img');
    const list = document.querySelector('.catalogue-object-list')?.getBoundingClientRect();
    const visible = [...document.querySelectorAll<HTMLImageElement>('.catalogue-object-list img')].filter(image => {
      const rect = image.getBoundingClientRect(); return list && rect.bottom > list.top && rect.top < list.bottom;
    });
    return portrait && portrait.complete && portrait.naturalWidth > 1 && visible.every(image => image.complete && image.naturalWidth > 1);
  });
  await page.screenshot({ path: `${directory}/${name}.png` });
}
try {
  await page.goto(`${base}/catalogue?object=m42`); await ready(); await recordsReady();
  assert.equal(await page.getByRole('button', {name:'Survey images',exact:true}).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.catalogue-product-table').count(), 0);
  await page.getByRole('button', {name:'Archive records',exact:true}).click(); await recordsReady();
  assert.equal(await page.getByRole('combobox', {name:'Order records'}).inputValue(), 'best');
  assert.equal(await page.locator('.catalogue-archive').count(), 1);
  const objects = page.getByRole('listbox', { name: 'Select Messier object' });
  assert.equal(await objects.getByRole('option').count(), 110);
  assert.equal(await objects.getByRole('option', { selected: true }).getAttribute('data-object-id'), 'm42');
  await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.catalogue-object-portrait img')?.naturalWidth);
  assert.equal(await page.getByRole('combobox', { name: 'Order by' }).inputValue(), 'size');
  assert.equal(await objects.getByRole('option').first().getAttribute('data-object-id'), 'm31');
  assert.match(await objects.getByRole('option').first().innerText(), /11,971.8″/);
  assert.ok(await objects.locator('img').count() === 110);
  await screen('largest-first');
  await page.getByRole('combobox', { name: 'Object type' }).selectOption('diffuse-nebula');
  for (const id of ['m8', 'm17', 'm20']) assert.equal(await objects.locator(`[data-object-id="${id}"]`).count(), 1);
  assert.equal(await objects.locator('[data-object-id="m45"]').count(), 0);
  await page.getByRole('combobox', { name: 'Object type' }).selectOption('all');
  await page.getByRole('combobox', { name: 'Order by' }).selectOption('number');
  await page.getByRole('searchbox', { name: 'Find object' }).fill('M 42');
  assert.equal(await objects.getByRole('option').count(), 1);
  await page.getByRole('searchbox', { name: 'Find object' }).fill('');
  visited.add('m31'); await objects.locator('[data-object-id="m31"]').click(); assert.equal(new URL(page.url()).searchParams.get('object'), 'm31');
  await page.reload(); await ready(); await page.getByRole('button', {name:'Archive records',exact:true}).click(); await recordsReady(); assert.equal(await objects.getByRole('option', { selected: true }).getAttribute('data-object-id'), 'm31');
  await page.getByRole('combobox', { name: 'Order by' }).selectOption('number');
  visited.add('m32'); await objects.getByRole('option', { selected: true }).focus(); await objects.getByRole('option', { selected: true }).press('ArrowDown');
  assert.equal(await objects.getByRole('option', { selected: true }).getAttribute('data-object-id'), 'm32');
  assert.equal(new URL(page.url()).searchParams.get('object'), 'm32');
  const populated = inventory?.targets.find(target => target.objectId === 'm42' && target.queries.some(query => query.imageCount ?? query.images.length)) ??
    inventory?.targets.find(target => target.queries.some(query => query.imageCount ?? query.images.length));
  if (inventory && !allowMissing) assert.ok(populated, 'The actual archive cache has no candidates to inspect.');
  if (populated) {
    visited.add(populated.objectId); await objects.locator(`[data-object-id="${populated.objectId}"]`).click();
    const available = populated.queries.find(query => query.imageCount ?? query.images.length)!;
    await page.getByRole('group', { name: 'Filter archive' }).getByRole('button', { name: available.provider.toUpperCase(), exact: true }).click();
    await recordsReady();
    assert.equal(await page.locator('.catalogue-archive').count(), 1);
    assert.ok(await page.locator('.catalogue-product-table tbody tr').count() > 0);
    const sourceLinks = page.locator('.catalogue-product-links a').filter({ hasText: /Source record|View FITS|File listing/ });
    assert.ok(await sourceLinks.count() > 0);
    for (const href of await sourceLinks.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))) assert.ok(/^https?:\/\//.test(href));
    await page.getByRole('searchbox', { name: 'Find image' }).fill('no-candidate-with-this-sentinel');
    assert.equal(await page.locator('.catalogue-product-table').count(), 0);
    assert.equal(await page.getByText('No images match these filters.', { exact: true }).count(), 1);
    await page.getByRole('searchbox', { name: 'Find image' }).fill('');
    await screen('archive-candidates');
    await page.setViewportSize({ width: 700, height: 900 }); await screen('compact');
    await page.setViewportSize({ width: 1500, height: 1050 });
    if (available.imagesPath) {
      const archivePage = (url: URL) => url.pathname.endsWith(`/${available.imagesPath}`);
      await page.route(archivePage, route => route.fulfill({ contentType: 'application/json', body: '{}' }));
      await page.reload(); await ready(); await page.getByRole('button', {name:'Archive records',exact:true}).click(); await recordsReady();
      await page.getByRole('group', {name:'Filter archive'}).getByRole('button', {name:available.provider.toUpperCase(),exact:true}).click();
      const archive = page.getByRole('region', { name: `${available.provider.toUpperCase()} candidates` });
      assert.match(await archive.locator('[role="alert"]').innerText(), /changed since this snapshot/);
      assert.equal(await archive.locator('.catalogue-product-table').count(), 0, 'Unverified records must never render.');
      await page.unroute(archivePage);
      await page.getByRole('button', { name: 'Reload snapshot' }).click(); await ready(); await recordsReady();
      assert.ok(await archive.locator('.catalogue-product-table tbody tr').count() > 0);
    }
  }
  await page.route(snapshot, route => route.fulfill({ status: 404, body: 'Not prepared' }));
  await page.reload(); await ready(); await page.getByRole('button', {name:'Archive records',exact:true}).click(); await recordsReady(); assert.equal(await objects.getByRole('option').count(), catalogue.objects.length);
  assert.equal(await page.getByText('No archive snapshot yet.', { exact: true }).count(), 1); await screen('missing');
  await page.unroute(snapshot);
  await page.route(snapshot, route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload(); await ready(); assert.match(await page.locator('.catalogue-status [role="alert"]').innerText(), /503/);
  assert.equal(await objects.getByRole('option').count(), 110);
  await page.unroute(snapshot);
  await page.route(snapshot, route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Reload snapshot' }).click(); await ready();
  assert.match(await page.locator('.catalogue-status [role="alert"]').innerText(), /Invalid Messier inventory/);
  await page.unroute(snapshot);
  assert.deepEqual(await page.evaluate(() => Object.entries(localStorage)), [['catalogue-browser-preserve', 'unchanged']]);
  assert.deepEqual(errors, []); assert.deepEqual(processing, []); assert.deepEqual(science, []);
  assert.ok(recordRequests.every(id => visited.has(id)), `Unselected object records were fetched: ${recordRequests.join(', ')}`);
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', actualCache: Boolean(populated), objects: 110,
    inspectedObject: populated?.objectId, missingSnapshot: true, failedSnapshot: true, invalidSnapshot: true, sourceLinks: Boolean(populated),
    bestImagesAcrossArchives: true, thumbnailsLoaded: true, largestFirst: true, angularUnits: 'arcseconds', urlSelection: true, keyboardSelection: true, storagePreserved: true, selectedRecordsOnly: true,
    hashGuard: Boolean(populated?.queries.some(query => query.imagesPath)), browser: browser.version(), errors, processing, science }, null, 2));
  console.log(`PASS Messier browser: 110 thumbnail cards, largest-first angular sorting, loaded survey preview, URL/keyboard selection, ${populated ? 'actual archive candidates, filters and links, ' : ''}missing/error/invalid snapshots, no processing or science downloads.`);
} catch (error) { await screen('failure'); throw error; } finally { await browser.close(); }
