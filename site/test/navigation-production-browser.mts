import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { selectObject } from './navigate-object.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inventoriedAssets, inventoriedObjectIds } from '../../tools/runtime-assets.mts';
import { contentType } from '../../tools/publish-runtime-assets.mts';
import { sha256 } from '../../src/platform/sha256.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4212';
const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'chrome';
if (!['chrome', 'chromium', 'msedge'].includes(channel)) throw new TypeError(`Unsupported browser channel: ${channel}`);
const browser = await chromium.launch({ headless: true,
  ...(channel === 'chromium' ? {} : { channel: channel as 'chrome' | 'msedge' }) });
type ProductionSample = {count:number;transform:string|undefined;opacity:number;universes:number};
declare global { interface Window { __productionDocument:Document; __productionShell:Element|null;
  __productionSamples:ProductionSample[]; __productionFrame:number; } }
const errors:string[] = [], networkErrors:string[] = [];
const sameOriginSceneRequests:string[] = [], assetRequests:string[] = [];
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => networkErrors.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/scenes/')) sameOriginSceneRequests.push(url.href);
  });
  const assetOrigin = process.env.CSSEARTH_ASSET_ORIGIN;
  if (assetOrigin) {
    const root = resolve(import.meta.dirname, '../..');
    const assets = new Map((await inventoriedAssets(root, inventoriedObjectIds([], root))).map(asset => [`/${asset.key}`, asset]));
    await page.route(`${assetOrigin}/runtime-assets/**`, async route => {
      const url = new URL(route.request().url()), asset = assets.get(url.pathname);
      if (!asset) return route.fulfill({ status: 404, body: `Uninventoried asset: ${url.pathname}` });
      assetRequests.push(url.href);
      let body = await readFile(asset.file).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
      });
      // A deploy intentionally keeps large context datasets on R2. The fake ASSET_ORIGIN route still verifies
      // their real content-addressed bytes instead of requiring the CI checkout to download every inventory.
      if (!body) {
        const response = await fetch(asset.url, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`Published asset unavailable: ${asset.url} (HTTP ${response.status}).`);
        body = Buffer.from(await response.arrayBuffer());
      }
      if (body.length !== asset.bytes || sha256(body) !== asset.sha256) throw new Error(`Published asset identity changed: ${asset.key}.`);
      return route.fulfill({ body, contentType: contentType(asset.key),
        headers: { 'access-control-allow-origin': '*' } });
    });
  }
  await page.goto(`${origin}/mercury/`, { waitUntil: 'networkidle' });
  await ready(page, 'mercury', errors, networkErrors);
  await page.evaluate(() => {
    window.__productionDocument = document;
    window.__productionShell = document.querySelector('.planet-sidebar');
  });
  for (const id of ['venus', 'mercury']) {
    await page.evaluate(() => {
      window.__productionSamples = [];
      const sample = () => {
        const stage = window.__cssearthTest.element('.planet-stage');
        // The shared world presents beside the detail stage and owns the loading opacity.
        const world = window.__cssearthTest.element('.planet-world-stage');
        const scene = document.querySelector<HTMLElement>('.planet-stage [class$="-scene"]');
        window.__productionSamples.push({ count: document.querySelectorAll('.polycss-camera').length,
          transform: scene?.style.transform,
          opacity: Number(getComputedStyle(window.__cssearthTest.required(stage, 'computed style element')).opacity)
            * Number(getComputedStyle(window.__cssearthTest.required(world, 'computed style element')).opacity),
          universes: world?.querySelectorAll('.prepared-universe').length ?? 0 });
        window.__productionFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    await selectObject(page, id);
    await ready(page, id, errors, networkErrors);
    const result = await page.evaluate(id => {
      cancelAnimationFrame(window.__productionFrame);
      return { document: window.__productionDocument === document,
        shell: window.__productionShell === document.querySelector('.planet-sidebar'),
        current: window.__cssearthTest.html('.planet-stage').dataset.objectId,
        roots: document.querySelectorAll('.polycss-camera').length,
        assets: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(node => node.href),
        diagnostics: window.__cssEarth !== undefined,
        samples: window.__productionSamples,
      };
    }, id);
    assert.equal(result.document, true); assert.equal(result.shell, true);
    assert.equal(result.current, id); assert.equal(result.roots, 1);
    assert.equal(result.diagnostics, false);
    assert.ok(result.samples.every(sample => sample.count <= 1));
    assert.ok(result.samples.every(sample => sample.opacity === 1 && sample.universes === 1),
      'Production handoffs keep the world fully visible at every painted frame.');
    assert.ok(new Set(result.samples.map(sample => sample.transform).filter(Boolean)).size > 10);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), '',
      'The navigation helper leaves the retained search UI closed after selecting an object.');
    console.log(`PRODUCTION NAVIGATION PASS ${id}: ${result.samples.length} frames, one scene, retained shell, no diagnostics`);
  }
  assert.deepEqual(errors, []);
  if (assetOrigin) {
    assert.ok(assetRequests.length > 0, 'The client must request content-addressed assets from ASSET_ORIGIN.');
    assert.deepEqual(sameOriginSceneRequests, [], 'An ASSET_ORIGIN build must not request same-origin /scenes/ assets.');
    console.log(`ASSET ORIGIN PASS: ${assetRequests.length} content-addressed requests, zero same-origin /scenes/ requests`);
  }
} finally { await browser.close(); }

async function ready(page: Page, id:string, errors: readonly string[], networkErrors: readonly string[]) {
  try {
    await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
      window.__cssearthTest.html('.planet-stage').dataset.objectId === id && location.pathname === `/${id}/`, id, { timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({ ready: document.documentElement.dataset.ready,
      body: document.body.className, objectId: document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId }));
    throw new Error(`Production scene ${id} did not become ready: ${JSON.stringify({ state, errors, networkErrors })}`, { cause: error });
  }
}
