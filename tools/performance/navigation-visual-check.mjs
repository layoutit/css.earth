import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { chromium } from 'playwright';
import { previewSite } from '../preview.mjs';

const root = resolve(import.meta.dirname, '../..');
if (!process.argv[2]) throw Error('Provide the baseline capture directory.');
const base = resolve(process.argv[2]);
const output = resolve(process.argv[3] ?? resolve(root, 'output/playwright/navigation-consistency/visual-comparison'));
await mkdir(output, { recursive: true });
const baseline = JSON.parse(await readFile(base + '/report.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bundles = new Map();
for (const [url, identity] of Object.entries(baseline.loadedFiles)) {
  if (!/\.(js|css)$/.test(url)) continue;
  const bytes = await readFile(resolve(base, 'served', '.' + url));
  assert.equal(hash(bytes), identity.sha256, `Exact baseline bytes missing: ${url}`);
  bundles.set(url, bytes);
}
const oldMain = [...bundles.keys()].find(url => /PlanetLayout.*\.js$/.test(url));
const oldCss = [...bundles.keys()].filter(url => url.endsWith('.css'));
const server = await previewSite({ port: 4241 });
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const report = { baselineHead: baseline.sourceHead, browser: browser.version(), errors: [], checkpoints: [],
  reference: 'Exact baseline JS/CSS bytes verified against the baseline capture; shared HTML with the new presentation wrapper reversed.' };
try {
  for (const variant of ['baseline', 'candidate']) {
    const page = await browser.newPage({ viewport: baseline.viewport, deviceScaleFactor: baseline.dpr });
    page.on('pageerror', e => report.errors.push(variant + ': ' + e.stack));
    page.on('response', r => { if (r.status() >= 400) report.errors.push(variant + ': ' + r.status() + ' ' + r.url()); });
    if (variant === 'baseline') await page.route('http://127.0.0.1:4241/**', async route => {
      const url = new URL(route.request().url());
      if (bundles.has(url.pathname)) return route.fulfill({ body: bundles.get(url.pathname), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      if (!url.pathname.endsWith('/')) return route.continue();
      const response = await route.fetch();
      let html = await response.text();
      html = html.replace('<div class="planet-world-stage">', '').replace(/(<\/main>)\s*<\/div>/, '$1');
      html = html.replace(/\/_astro\/PlanetLayout[^"\s]*\.js/g, oldMain);
      html = html.replace(/\/_astro\/[^"\s]*\.css/g, url => oldCss.find(old => basename(old).split('.')[0] === basename(url).split('.')[0]) ?? url);
      return route.fulfill({ response, body: html });
    });
    const ready = async id => {
      await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id, id, { timeout: 60000 });
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
    };
    const save = async name => {
      const state = await page.evaluate(() => {
        const stage = document.querySelector('.planet-stage'), camera = stage.querySelector('.polycss-camera');
        const r = stage.getBoundingClientRect(), c = camera.getBoundingClientRect();
        const diag = window[`__${window.__cssEarth.activeObjectId}`];
        return { active: window.__cssEarth.activeObjectId, overview: window.__cssEarth.overview,
          stage: [r.x,r.y,r.width,r.height], camera: [c.x,c.y,c.width,c.height],
          focal: diag.camera.state().focal, cssFocal: parseFloat(getComputedStyle(camera).perspective),
          worldInsideDetail: stage.contains(document.querySelector('.prepared-universe')),
          worldNodeCount: document.querySelector('.prepared-universe').querySelectorAll('*').length,
          detailNodeCount: stage.querySelectorAll('*').length,
          initialSunSheetRetained: window.__initialSunSheet?.isConnected ?? null };
      });
      assert.deepEqual(state.camera, state.stage);
      assert.ok(Math.abs(state.focal - state.cssFocal) < .01);
      await page.screenshot({ path: `${output}/${variant}-${name}.png` });
      report.checkpoints.push({ variant, name, ...state });
    };
    await page.goto('http://127.0.0.1:4241/sun/'); await ready('sun');
    await page.evaluate(() => { window.__initialSunSheet = document.querySelector('[data-object-style$="sun-surfaces.css"]'); });
    await save('sun');
    const view = baseline.milestones.find(m => m.name === 'cold-zoom-for-mars-end').camera;
    await page.evaluate(view => window.__sun.camera.setState({ zoom: view.zoom, controlPitch: view.controlPitch, controlYaw: view.controlYaw }), view);
    await page.waitForFunction(() => window.__cssEarth.overview); await ready('sun'); await save('overview');
    await page.locator('.planet-sidebar-search').fill('earth'); await page.waitForTimeout(400); await save('search');
    await page.locator('.planet-object-item:not([hidden]) .planet-object-link[data-object-id="earth"]').click();
    await ready('earth'); await save('earth');
    await page.setViewportSize({ width: 700, height: 1000 }); await page.waitForTimeout(600); await save('portrait');
    await page.setViewportSize(baseline.viewport);
    await page.getByRole('link', { name: 'Solar System', exact: true }).click(); await ready('sun');
    const initial = baseline.milestones.find(m => m.name === 'cold-start').camera;
    await page.evaluate(view => window.__sun.camera.setState({ zoom: view.zoom, controlPitch: view.controlPitch, controlYaw: view.controlYaw }), initial);
    await page.waitForFunction(() => !window.__cssEarth.overview); await ready('sun'); await save('cached-sun');
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} finally { await browser.close(); await server.close(); await writeFile(output + '/report.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
