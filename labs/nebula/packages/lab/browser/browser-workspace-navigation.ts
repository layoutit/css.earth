/** Shared navigation and retained workbench layout; isolated storage, no processing writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import { blockProcessingWrites } from './browser-regression.ts';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const headerOnly = process.argv.includes('--header-only');
const output = 'output/nebula-refactor/workspace-navigation'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
const guard = await blockProcessingWrites(context), page = await context.newPage();
const metadataPosts: { path: string; payload: unknown }[] = [];
await context.route('**/__nebula/*', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() !== 'POST') return route.fallback();
  let value: unknown; try { value = request.postDataJSON(); } catch { return route.fallback(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return route.fallback();
  const body = value as Record<string, unknown>, tone = body.tone;
  const neutral = tone && typeof tone === 'object' && !Array.isArray(tone) &&
    Object.entries(tone).length === 4 && ['brightness', 'gamma'].every(key => Reflect.get(tone, key) === 1) &&
    Reflect.get(tone, 'black') === 0 && Reflect.get(tone, 'white') === 1 && (body.removalStrength === undefined || body.removalStrength === 100);
  if (path === '/__nebula/star-removal' && body.action === 'overview' && typeof body.imageId === 'string' ||
      path === '/__nebula/prepare-tone' && neutral) { metadataPosts.push({ path, payload: value }); return route.continue(); }
  return route.fallback();
});
async function receiptHashes() {
  const hashes: Record<string, string> = {};
  for (const directory of (await readdir('.local/nebula-lab')).filter(name => name.endsWith('-jobs')).sort()) {
    for (const name of (await readdir(`.local/nebula-lab/${directory}`, { recursive: true })).filter(name => name.endsWith('.json')).sort()) {
      const path = `.local/nebula-lab/${directory}/${name}`; hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
  }
  return hashes;
}
const receiptsBefore = await receiptHashes();
const errors: string[] = [], failed: { url: string; status: number }[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
page.setDefaultTimeout(30000);
const receipts: unknown[] = [];
async function navigation(subject: string, active: string) {
  await page.waitForFunction(expected => { const input = document.querySelector<HTMLInputElement>('#subject'); return input?.getAttribute('data-object-id') === expected && !input.disabled; }, subject);
  assert.equal(await page.locator('#subject').getAttribute('data-object-id'), subject);
  assert.deepEqual(await page.locator('.lab-navigation > *').allTextContents(), ['Catalogue', 'Alignment', 'Reconstruction']);
  assert.equal(await page.locator('.lab-navigation [aria-current="page"]').textContent(), active);
  const picker = await page.locator('.object-picker').boundingBox();
  assert.ok(picker && Math.abs(picker.x + picker.width / 2 - 750) <= 1, 'Object picker is centered in the desktop header');
}
async function catalogue(query: string, subject: string) {
  await page.goto(`${base}/catalogue?${query}`); await navigation(subject, 'Catalogue');
  await page.waitForFunction(() => Boolean(document.querySelector('.catalogue-object-list button')));
}
async function clickView(label: string, subject: string) {
  await page.getByRole('navigation', { name: 'Lab navigation' }).getByRole('link', { name: label, exact: true }).click();
  await page.waitForURL(url => url.pathname === `/${label.toLowerCase()}` && url.searchParams.get('subject') === subject);
  assert.equal(new URL(page.url()).searchParams.has('object'), false);
  await navigation(subject, label);
}
async function reconstructed(subject: string, allowUncompiled = false) {
  if (allowUncompiled) await page.waitForFunction(() => document.querySelector('.compiler-controls')?.getAttribute('data-busy') === 'false');
  else await page.waitForFunction(() => document.querySelector('.compiler-stage')?.getAttribute('data-compiler-ready') === 'true' ||
    document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true', null, { timeout: 60000 });
  assert.equal(await page.locator('#subject').getAttribute('data-object-id'), subject);
}
async function dockGeometry(page: Page) {
  return page.evaluate(() => {
    const visible = (node: Element) => { const r = node.getBoundingClientRect(); const style = getComputedStyle(node); return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'; };
    const boxes = (selector: string) => {
      const nodes = [...document.querySelectorAll(selector)].filter(visible);
      return nodes.filter(node => !nodes.some(parent => parent !== node && parent.contains(node))).map(node => {
        const r = node.getBoundingClientRect(); return { selector: node.id || node.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      });
    };
    return { headerBottom: document.querySelector('.lab-header')!.getBoundingClientRect().bottom,
      left: boxes('#inspection-panel, .observation-camera, .workspace-model-panel'),
      right: boxes('#image-overlay-panel, .observation-images, .cloud-adjustment-panel'),
      center: boxes('.compiler-workspace, .joint-fit-workspace, .shape-cloud-stage, #render-panel'), width: innerWidth, height: innerHeight };
  });
}
try {
  for (const query of ['object=m42', 'subject=m42']) {
    await catalogue(query, 'm42');
    await clickView('Alignment', 'm42'); await page.locator('.observation-frame img').first().waitFor();
    await clickView('Reconstruction', 'm42'); await reconstructed('m42');
    await clickView('Catalogue', 'm42');
    receipts.push({ query, roundtrip: true });
  }
  await catalogue('subject=m31', 'm31');
  await page.locator('#subject').fill('ori');
  await page.getByRole('listbox', { name: 'Objects' }).locator('[data-object-id="m42"]').waitFor();
  await page.locator('#subject').press('Enter'); await navigation('m42', 'Catalogue');
  const selectedLabel = await page.locator('#subject').inputValue();
  await page.locator('#subject').fill('unmatched-query'); await page.locator('#subject').press('Escape');
  assert.equal(await page.locator('#subject').getAttribute('data-object-id'), 'm42');
  assert.equal(await page.locator('#subject').inputValue(), selectedLabel);
  assert.equal(await page.getByRole('listbox', { name: 'Objects' }).count(), 0);
  receipts.push({ objectSearch: 'ori', keyboardSelect: 'm42', escapePreservesSelection: true, centered: true });
  await catalogue('subject=m31', 'm31');
  for (const label of ['Alignment', 'Reconstruction']) assert.equal(await page.locator('.lab-navigation').getByText(label, { exact: true }).getAttribute('aria-disabled'), 'true');
  await catalogue('subject=lmc-clouds', 'lmc-clouds');
  await page.getByText('This object is outside the Messier catalogue.', { exact: false }).waitFor();
  await clickView('Alignment', 'lmc-clouds'); await clickView('Reconstruction', 'lmc-clouds'); await reconstructed('lmc-clouds');
  receipts.push({ catalogueOnlyDisabled: 'm31', outsideCataloguePreserved: 'lmc-clouds' });
  if (!headerOnly) for (const [subject, velocityEnabled] of [['lmc-clouds', false], ['m42', false], ['helix-model-prior', true], ['smc-particles', false], ['m2-9-inferred', false]] as const) {
    await page.goto(`${base}/reconstruction?subject=${subject}${subject === 'm42' || subject === 'helix-model-prior' ? '&inspection=compiler' : subject === 'm2-9-inferred' ? '&inspection=volume' : ''}`);
    await navigation(subject, 'Reconstruction'); await reconstructed(subject, subject === 'helix-model-prior');
    if (subject === 'lmc-clouds') await page.waitForFunction(() => {
      const select = document.querySelector<HTMLSelectElement>('#reconstruction-image');
      return Boolean(select && !select.disabled && select.options.length > 0);
    });
    const sections = page.locator('.workspace-sections:visible [data-workspace-section]');
    assert.deepEqual(await sections.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-workspace-section'))), ['compiler', 'sources', 'structure', 'combined', 'kinematics', 'joint', 'volume']);
    const velocity = page.locator('.workspace-sections:visible [data-workspace-section="kinematics"]');
    assert.equal(await velocity.isEnabled(), velocityEnabled);
    if (!velocityEnabled) assert.match(await velocity.getAttribute('title') ?? '', /not configured|unavailable|not supported/i);
    const geometry = await dockGeometry(page);
    assert.equal(geometry.left.length, 1, `${subject}: one visible left dock`);
    assert.equal(geometry.right.length, 1, `${subject}: one visible right dock`);
    const left = geometry.left[0]!, right = geometry.right[0]!;
    assert.ok(Math.abs(left.x) <= 1 && Math.abs(right.right - geometry.width) <= 1, `${subject}: panels dock at workspace edges`);
    for (const panel of [left, right]) {
      assert.ok(Math.abs(panel.y - geometry.headerBottom) <= 1, `${subject}: panel begins below common header`);
      assert.ok(Math.abs(panel.bottom - geometry.height) <= 1, `${subject}: panel fills workspace height`);
    }
    assert.ok(left.right < right.x && left.width === 280 && right.width === 340, `${subject}: fixed common panel widths leave the center open`);
    const scene = geometry.center.find(box => box.selector.includes('compiler-workspace')) ?? geometry.center.find(box => box.selector === 'render-panel');
    assert.ok(scene && scene.x >= left.right - 1 && scene.right <= right.x + 1, `${subject}: scene remains between docks`);
    await page.screenshot({ path: `${output}/${subject}.png` }); receipts.push({ subject, velocityEnabled, geometry });
  }
  if (!headerOnly) {
    await page.goto(`${base}/alignment?subject=smc-particles`); await navigation('smc-particles', 'Alignment'); await reconstructed('smc-particles');
    const image = page.locator('#image-overlay-panel'); await image.waitFor();
    assert.notEqual(await image.locator('#overlay-controls').getAttribute('disabled'), null);
    assert.equal(await image.locator('#overlay-choice').isDisabled(), true);
    assert.match(await image.innerText(), /No image overlays are configured/);
    const geometry = await dockGeometry(page); assert.equal(geometry.left.length, 1); assert.equal(geometry.right.length, 1);
    assert.equal(geometry.right[0]!.right, geometry.width); assert.equal(geometry.right[0]!.y, geometry.headerBottom);
    await page.screenshot({ path: `${output}/smc-alignment.png` }); receipts.push({ subject: 'smc-particles', alignmentImageUnavailable: true, geometry });
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(guard.blocked, []);
  const receiptsAfter = await receiptHashes(); assert.deepEqual(receiptsAfter, receiptsBefore, 'Display actions preserve every durable scientific job receipt');
  await writeFile(`${output}/receipt-hashes.json`, JSON.stringify({ before: receiptsBefore, after: receiptsAfter }, null, 2));
  await writeFile(`${output}/${headerOnly ? 'header' : 'result'}.json`, JSON.stringify({ status: 'passed', base, headerOnly, browser: browser.version(), receipts, errors, failed, metadataPosts, blockedWrites: guard.blocked }, null, 2));
  console.log(`WORKSPACE_NAVIGATION_PASS ${headerOnly ? 'header' : 'header-and-docks'} ${receipts.length} checks; no errors or expensive processing`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  await writeFile(`${output}/failure.json`, JSON.stringify({ status: 'failed', error: String(error), receipts, errors, failed, metadataPosts, blockedWrites: guard.blocked }, null, 2));
  throw error;
} finally { await browser.close(); }
