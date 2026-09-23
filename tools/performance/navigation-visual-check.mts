import { sha256 } from '../../src/platform/sha256.mts';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { chromium } from 'playwright';
import { previewSite } from '../cli/preview.mts';
import { readJsonSource, requireArray, requireFiniteNumber, requireRecord } from '../sources/source-values.mts';
import { recordOf } from './trace-model.mts';

// The baseline capture report is external JSON; page diagnostics are read through
// Reflect in page functions, failing as property reads on undefined do.
const root = resolve(import.meta.dirname, '../..');
const baseArgument = process.argv[2];
if (!baseArgument) throw Error('Provide the baseline capture directory.');
const base = resolve(baseArgument);
const output = resolve(process.argv[3] ?? resolve(root, 'output/playwright/navigation-consistency/visual-comparison'));
await mkdir(output, { recursive: true });
const baseline = requireRecord(await readJsonSource(base + '/report.json'), 'Baseline capture report');
const baselineViewport = requireRecord(baseline.viewport, 'Baseline viewport');
const viewport = { width: requireFiniteNumber(baselineViewport.width, 'Baseline viewport width'),
  height: requireFiniteNumber(baselineViewport.height, 'Baseline viewport height') };
const deviceScaleFactor = requireFiniteNumber(baseline.dpr, 'Baseline DPR');
const milestoneCamera = (name: string): unknown => {
  const milestone = requireArray(baseline.milestones, 'Baseline milestones').map(value => recordOf(value)).find(m => m?.name === name);
  if (!milestone) throw new TypeError(`Baseline milestone ${name} is missing.`);
  return milestone.camera;
};

const bundles = new Map<string, Buffer>();
for (const [url, identity] of Object.entries(requireRecord(baseline.loadedFiles, 'Baseline loadedFiles'))) {
  if (!/\.(js|css)$/.test(url)) continue;
  const bytes = await readFile(resolve(base, 'served', '.' + url));
  assert.equal(sha256(bytes), requireRecord(identity, `Baseline identity ${url}`).sha256, `Exact baseline bytes missing: ${url}`);
  bundles.set(url, bytes);
}
const oldMain = [...bundles.keys()].find(url => /ObjectLayout.*\.js$/.test(url));
const oldCss = [...bundles.keys()].filter(url => url.endsWith('.css'));
const server = await previewSite({ port: 4241 });
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const report: { baselineHead: unknown; browser: string; errors: string[]; checkpoints: Record<string, unknown>[]; reference: string } = {
  baselineHead: baseline.sourceHead, browser: browser.version(), errors: [], checkpoints: [],
  reference: 'Exact baseline JS/CSS bytes verified against the baseline capture; shared HTML with the new presentation wrapper reversed.' };
try {
  for (const variant of ['baseline', 'candidate']) {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.on('pageerror', e => report.errors.push(`${variant}: ${e.stack}`));
    page.on('response', r => { if (r.status() >= 400) report.errors.push(`${variant}: ${r.status()} ${r.url()}`); });
    if (variant === 'baseline') await page.route('http://127.0.0.1:4241/**', async route => {
      const url = new URL(route.request().url());
      if (bundles.has(url.pathname)) return route.fulfill({ body: bundles.get(url.pathname), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      if (!url.pathname.endsWith('/')) return route.continue();
      const response = await route.fetch();
      let html = await response.text();
      html = html.replace('<div class="object-world-stage">', '').replace(/(<\/main>)\s*<\/div>/, '$1');
      // String#replace converts a missing baseline bundle exactly as String() does.
      html = html.replace(/\/_astro\/ObjectLayout[^"\s]*\.js/g, String(oldMain));
      html = html.replace(/\/_astro\/[^"\s]*\.css/g, url => oldCss.find(old => basename(old).split('.')[0] === basename(url).split('.')[0]) ?? url);
      return route.fulfill({ response, body: html });
    });
    const ready = async (id: string) => {
      await page.waitForFunction(id => {
        const app: unknown = Reflect.get(window, '__cssEarth');
        if (app === null || app === undefined) return undefined;
        return Reflect.get(Object(app), 'ready') && Reflect.get(Object(app), 'activeObjectId') === id;
      }, id, { timeout: 60000 });
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
    };
    const save = async (name: string) => {
      const state = await page.evaluate(() => {
        const get = (target: unknown, key: PropertyKey): unknown => {
          if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
          return Reflect.get(Object(target), key);
        };
        const call = (target: unknown, key: PropertyKey): unknown => {
          const method = get(target, key);
          if (typeof method !== 'function') throw new TypeError(`${String(key)} is not a function`);
          return Reflect.apply(method, target, []);
        };
        const stage = document.querySelector('.object-stage');
        if (!stage) throw new TypeError("Cannot read properties of null (reading 'querySelector')");
        const camera = stage.querySelector('.polycss-camera');
        if (!camera) throw new TypeError("Cannot read properties of null (reading 'getBoundingClientRect')");
        const r = stage.getBoundingClientRect(), c = camera.getBoundingClientRect();
        const app: unknown = Reflect.get(window, '__cssEarth');
        const diag: unknown = Reflect.get(window, `__${get(app, 'activeObjectId')}`);
        const world = document.querySelector('.prepared-universe');
        const sheet: unknown = Reflect.get(window, '__initialSunSheet');
        return { active: get(app, 'activeObjectId'), overview: get(app, 'overview'),
          stage: [r.x,r.y,r.width,r.height], camera: [c.x,c.y,c.width,c.height],
          focal: get(call(get(diag, 'camera'), 'state'), 'focal'), cssFocal: parseFloat(getComputedStyle(camera).perspective),
          worldInsideDetail: stage.contains(world),
          worldNodeCount: (() => {
            if (!world) throw new TypeError("Cannot read properties of null (reading 'querySelectorAll')");
            return world.querySelectorAll('*').length;
          })(),
          detailNodeCount: stage.querySelectorAll('*').length,
          initialSunSheetRetained: (sheet === null || sheet === undefined ? undefined : Reflect.get(Object(sheet), 'isConnected')) ?? null };
      });
      assert.deepEqual(state.camera, state.stage);
      // Subtraction converts the reported focal length exactly as Number() does.
      assert.ok(Math.abs(Number(state.focal) - state.cssFocal) < .01);
      await page.screenshot({ path: `${output}/${variant}-${name}.png` });
      report.checkpoints.push({ variant, name, ...state });
    };
    const setCamera = (view: unknown) => page.evaluate(view => {
      const get = (target: unknown, key: PropertyKey): unknown => {
        if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${target} (reading '${String(key)}')`);
        return Reflect.get(Object(target), key);
      };
      const camera = get(Reflect.get(window, '__sun'), 'camera'), setState = get(camera, 'setState');
      if (typeof setState !== 'function') throw new TypeError('setState is not a function');
      const result: unknown = Reflect.apply(setState, camera, [{ zoom: get(view, 'zoom'), controlPitch: get(view, 'controlPitch'), controlYaw: get(view, 'controlYaw') }]);
      return result;
    }, view);
    const overview = (expected: boolean) => page.waitForFunction(expected => {
      const app: unknown = Reflect.get(window, '__cssEarth');
      if (app === null || app === undefined) throw new TypeError(`Cannot read properties of ${app} (reading 'overview')`);
      const value: unknown = Reflect.get(Object(app), 'overview');
      return expected ? value : !value;
    }, expected);
    await page.goto('http://127.0.0.1:4241/sun/'); await ready('sun');
    await page.evaluate(() => { Reflect.set(window, '__initialSunSheet', document.querySelector('[data-object-style$="sun-surfaces.css"]')); });
    await save('sun');
    await setCamera(milestoneCamera('cold-zoom-for-mars-end'));
    await overview(true); await ready('sun'); await save('overview');
    await page.locator('.object-sidebar-search').fill('earth'); await page.waitForTimeout(400); await save('search');
    await page.locator('.object-item:not([hidden]) .object-link[data-object-id="earth"]').click();
    await ready('earth'); await save('earth');
    await page.setViewportSize({ width: 700, height: 1000 }); await page.waitForTimeout(600); await save('portrait');
    await page.setViewportSize(viewport);
    await page.getByRole('link', { name: 'Solar System', exact: true }).click(); await ready('sun');
    await setCamera(milestoneCamera('cold-start'));
    await overview(false); await ready('sun'); await save('cached-sun');
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} finally { await browser.close(); await server.close(); await writeFile(output + '/report.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
