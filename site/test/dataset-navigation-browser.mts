// Exercises the public shell and production dataset capability, without diagnostics.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/dataset-navigation');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
const cases: Record<string, unknown>[] = [], errors: string[] = [], failedResponses: string[] = [];
const requests = new Set<string>();
const servedResponses: {path:string;bytes:number;sha256:string}[] = [];
const responsePaths = new Set<string>();
const report = { testedRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), origin,
  browser: browser.version(), deviceScaleFactor:1, servedResponseMethod:'Separate HTTP fetch of successful HTML/CSS/JS URLs observed during the browser run, against the same static server.', servedResponses, cases, errors, failedResponses };
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
page.on('request', request => requests.add(new URL(request.url()).pathname));
page.on('response', response => {
  const path = new URL(response.url()).pathname;
  if (response.status() === 200 && (/^\/(?:[a-z0-9-]+\/)?$/.test(path) || path.startsWith('/_astro/'))) {
    responsePaths.add(path);
  }
});

async function ready(body: string, lens?: string) {
  await page.waitForFunction(({ body, lens }) => document.documentElement.dataset.ready === 'true'
    && document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId === body
    && (!lens || document.querySelector<HTMLButtonElement>('button[name="dataset"][aria-pressed="true"]')?.value === lens), { body, lens });
  assert.equal(await page.locator('.planet-stage').count(), 1, 'One retained object stage');
}
async function visit(path: string, body: string, lens?: string) {
  console.error(`[dataset-browser] ${path}`);
  assert.equal((await page.goto(new URL(path, origin).href))?.status(), 200);
  await ready(body, lens);
}
async function state() {
  return page.evaluate(() => ({ hash: location.hash, dataset: new URL(location.href).searchParams.get("dataset"), pathname: location.pathname,
    camera: new URL(location.href).searchParams.get('v'),
    transform: [...document.querySelectorAll('.planet-stage .polycss-camera > .polycss-scene')].map(node => getComputedStyle(node).transform),
    lens: document.querySelector<HTMLButtonElement>('button[name="dataset"][aria-pressed="true"]')?.value,
    tab: document.querySelector<HTMLInputElement>('[aria-label="Object information"] input:checked')?.labels?.[0]?.textContent?.trim() }));
}
async function noOverflow(target: Page) {
  assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

try {
  const rail = page.locator('.planet-information-panel > .planet-dataset-context-rail');
  const active = () => rail.locator('[data-dataset-context]:not([hidden])');
  const sources = page.locator('[data-source-link]');
  await visit('/mars/?dataset=elevation', 'mars', 'elevation');
  assert.equal(await page.getByRole('tab', { name: 'Missions', exact: true }).count(), 0);
  assert.equal(await page.getByRole('tab', { name: 'Sources', exact: true }).count(), 0);
  assert.equal(await active().locator('[data-mission="mars-global-surveyor"]').isVisible(), true);
  assert.equal(await sources.isVisible(), true);
  assert.match(await sources.getAttribute('href') ?? '', /\/src\/objects\/mars\/README\.md$/u);
  const marsSource = await sources.getAttribute('href');
  assert.equal(await page.locator('template[data-object-card]').count(), 0, 'Routes ship no resident card bank');
  const stage = await page.locator('.planet-stage .polycss-camera').elementHandle();
  const before = await state();
  const thermal = page.locator('button[name="dataset"][value="thermal"]');
  await thermal.focus();
  await page.keyboard.press('Enter');
  await ready('mars', 'thermal');
  assert.equal(await sources.getAttribute('href'), marsSource, 'the source document covers every dataset');
  assert.equal(await active().locator('[data-mission="odyssey"]').isVisible(), true);
  assert.equal(await active().locator('[data-mission="mars-global-surveyor"]').count(), 0);
  const selected = await state();
  assert.equal(selected.dataset, 'thermal');
  assert.deepEqual(selected.transform, before.transform, 'Dataset selection retains the camera');
  assert.equal(await stage?.evaluate(node => node.isConnected), true);
  await page.getByRole('radio', { name: 'Factsheet', exact: true }).press('Space');
  assert.equal(await rail.isVisible(), false);
  await page.getByRole('radio', { name: 'Datasets', exact: true }).press('Space');
  assert.equal(await rail.isVisible(), true);
  await page.screenshot({ path: resolve(output, 'mars-dataset-context.png') });
  await page.reload(); await ready('mars', 'thermal');
  assert.equal(await active().locator('[data-mission="odyssey"]').isVisible(), true);
  cases.push({ name: 'dataset context, keyboard selection, retained camera, tabs and reload', before, selected });

  await page.getByRole('radiogroup', { name: 'Object information', exact: true }).getByRole('radio', { name: 'Moons', exact: true }).press('Space');
  assert.equal(await rail.isVisible(), false);
  const moons = page.locator('#mars-moons-content');
  assert.deepEqual(await moons.locator('[data-object-id]').evaluateAll(links => links.map(link => link.getAttribute('data-object-id'))), ['phobos', 'deimos']);
  await moons.locator('[data-object-id="phobos"]').click();
  await ready('phobos');
  await page.goBack(); await ready('mars', 'thermal');
  await page.getByRole('radio', { name: 'Datasets', exact: true }).press('Space');
  assert.equal(await active().locator('[data-mission="odyssey"]').isVisible(), true);
  cases.push({ name: 'Moons navigation selects the body and Back restores dataset context' });

  await visit('/mars/?dataset=elevation#vault', 'mars', 'elevation');
  await page.locator('button[name="dataset"][value="normal"]').click();
  await page.waitForFunction(() => location.hash === '#vault');
  assert.equal(await active().locator('[data-mission]').count(), 0);
  assert.match(await active().innerText(), /Viking/);
  cases.push({ name: 'unresolved capture stays unresolved and unrelated fragments survive' });

  await visit('/mars/?dataset=missing', 'mars', 'normal');
  assert.equal(await page.locator('[data-dataset-notice]').isVisible(), true);
  await page.locator('button[name="dataset"][value="normal"]').click();
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('dataset'));
  assert.equal(await page.locator('[data-dataset-notice]').isVisible(), false);
  cases.push({ name: 'invalid dataset fallback and manual repair' });

  await visit('/bennu/', 'bennu', 'normal');
  assert.equal(await active().locator('[data-mission="osiris-rex"]').count(), 1);
  assert.equal(await active().locator('[data-mission="osiris-apex"]').count(), 0);
  cases.push({ name: 'mission succession does not create false dataset contributions' });

  await visit('/mars/?dataset=elevation', 'mars', 'elevation');
  await page.getByRole('searchbox').fill('Mercury');
  await page.locator('.planet-object-link[data-object-id="mercury"]').first().click();
  await ready('mercury');
  assert.equal(await rail.locator('[data-mission="messenger"]').count() > 0, true);
  assert.equal(await rail.locator('[data-mission="mars-global-surveyor"]').count(), 0);
  await page.goBack(); await ready('mars', 'elevation');
  assert.equal(await active().locator('[data-mission="mars-global-surveyor"]').isVisible(), true);
  cases.push({ name: 'cross-body navigation carries the destination dataset context and Back restores the dataset' });

  await visit('/mercury/?dataset=enhanced', 'mercury', 'enhanced');
  assert.equal(await active().locator('[data-mission="messenger"]').count(), 1);
  assert.deepEqual(await active().locator('[data-dataset-source]').evaluateAll(links => links.map(link => ({
    id: link.getAttribute('data-dataset-source'), title: link.textContent?.trim(), href: link.getAttribute('href'),
  }))), [
    { id: 'source-mercury-usgs-messenger-enhanced-global-z3', title: 'MESSENGER MDIS enhanced-color mosaic', href: 'https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m' },
    { id: 'source-mercury-usgs-messenger-bdr-global-z3', title: 'MESSENGER MDIS monochrome mosaic', href: 'https://astrogeology.usgs.gov/search/map/mercury-messenger-global-products' },
    { id: 'source-mercury-usgs-messenger-topography-z3', title: 'MESSENGER global shaded relief', href: 'https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_dem_global_color_shaded_relief_2km' },
  ]);
  assert.match(await sources.getAttribute('href') ?? '', /\/src\/objects\/mercury\/README\.md$/u);
  await sources.focus();
  assert.equal(await sources.evaluate(node => getComputedStyle(node).textDecorationLine), 'underline');
  await page.locator('button[name="dataset"][value="interior"]').click();
  await ready('mercury', 'interior');
  assert.equal(await active().locator('[data-mission]').count(), 0);
  assert.deepEqual(await active().locator('[data-dataset-source]').evaluateAll(links => links.map(link => link.getAttribute('data-dataset-source'))), [
    'nasa-mercury-facts', 'source-mercury-usgs-messenger-bdr-global-z3',
  ]);
  assert.equal(await sources.isVisible(), true);
  assert.match(await sources.getAttribute('href') ?? '', /\/src\/objects\/mercury\/README\.md$/u);
  cases.push({ name: 'canonical dataset sources update with the selected lens and unlinked missions stay hidden' });

  await visit('/mars/?dataset=elevation', 'mars', 'elevation');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.planet-information-panel > .planet-dataset-context-rail')!).position === 'static');
  await rail.scrollIntoViewIfNeeded();
  await noOverflow(page);
  assert.equal(await rail.isVisible(), true);
  await page.screenshot({ path: resolve(output, 'dataset-context-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.planet-information-panel > .planet-dataset-context-rail')!).position === 'fixed');
  assert.equal(await rail.isVisible(), true);
  cases.push({ name: 'responsive panels remain accessible and return to the right dock' });

  assert.equal([...requests].some(path => /prepared-(?:facilities|sources)\.json|src\/sources|source\/facilities\/catalog\.json|prepared\/provenance\.json|prepare-(?:facilities|sources)/.test(path)), false,
    'The production browser must not fetch the catalogue, compiler or provenance graph');
  assert.deepEqual(errors, [], 'No browser application errors');
  assert.deepEqual(failedResponses, [], 'All requested production assets are installed');
  for (const path of [...responsePaths].sort()) {
    const response=await fetch(new URL(path,origin));assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer());
    servedResponses.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  errors.push(error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
