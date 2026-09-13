// Focused DART delivery check. One headless browser, one scene at a time.
// Run against the existing server: node tests/objects/browser/dart-mosaic-browser.mts <base-url>
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createTestPage } from '../../../site/test/browser-observations.mts';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';

const base = process.argv[2] ?? 'http://127.0.0.1:4278';
const output = resolve('output/playwright/dart-close-ups/qualified');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await mkdir(output, { recursive: true });
const launch = await conformanceBrowserLaunch({ channel: 'chrome', evidenceDirectory: output });
const browser = await chromium.launch(launch.options);
const reports: {id:string;mode:string;photographs:string[];state:{density:number};[key:string]:unknown}[] = [];
try {
  for (const id of ['didymos', 'dimorphos']) for (const mode of ['desktop', 'dpr2', 'mobile']) {
    const viewport = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const dpr = mode === 'dpr2' ? 2 : 1;
    const page = await createTestPage(browser, { viewport, deviceScaleFactor: dpr });
    const errors: string[] = [], photographs = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith(`/scenes/${id}/`) && path.includes('-draco-')) {
        photographs.add(path); if (!response.ok()) errors.push(`${path}: ${response.status()}`);
      }
    });
    // Optionally exercise the separately downloaded, hash-verified installation.
    if (process.env.CSSEARTH_DART_INSTALLED) await page.route(`**/scenes/${id}/*`, async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
      await route.fulfill({ body: await readFile(resolve(process.env.CSSEARTH_DART_INSTALLED!, id, name)),
        contentType: name.endsWith('.webp') ? 'image/webp' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    });
    assert.equal((await page.goto(`${base}/${id}/`, { waitUntil: 'networkidle' }))?.status(), 200);
    await page.waitForFunction(id => window.__cssearthTest.object(id).ready, id);
    await page.evaluate(() => { const input = document.querySelector<HTMLInputElement>('input[name="motion"]'); if (input?.checked) input.click(); });
    assert.equal(await page.evaluate(id => window.__cssearthTest.object(id).runtime.selection().committed?.shadows, id), false);
    const lenses = await page.locator('button[name="lens"]').evaluateAll(nodes => nodes.map(node => (node as HTMLButtonElement).value));
    for (const lens of mode === 'desktop' ? lenses : ['draco']) {
      if (mode === 'mobile') await page.evaluate(({ id, lens }) => window.__cssearthTest.object(id).selectLens(lens), { id, lens });
      else await page.locator(`button[name="lens"][value="${lens}"]`).click();
      await page.waitForFunction(({ id, lens }) => window.__cssearthTest.object(id).runtime.selection().committed?.lensId === lens, { id, lens });
      assert.equal(await page.evaluate(id => window.__cssearthTest.object(id).assertStableDomIdentity(), id), true);
    }
    await page.evaluate(id => window.__cssearthTest.object(id).selectLens('draco'), id);
    await page.waitForFunction(id => window.__cssearthTest.object(id).runtime.selection().committed?.lensId === 'draco', id);
    const facing = { controlPitch: 100, controlYaw: id === 'didymos' ? 45 : 325, zoom: mode === 'mobile' ? 0.65 : 1.35 };
    await page.evaluate(({ id, facing }) => window.__cssearthTest.object(id).camera.setState(facing), { id, facing });
    await page.waitForTimeout(500);
    const overview = resolve(output, `${id}-${mode}.png`);
    await page.screenshot({ path: overview });
    const before = await page.evaluate(id => window.__cssearthTest.object(id).camera.state().pose.scene, id);
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.down(); await page.mouse.move(viewport.width / 2 + 65, viewport.height / 2 + 30, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(300);
    assert.notEqual(await page.evaluate(id => window.__cssearthTest.object(id).camera.state().pose.scene, id), before);
    assert.equal(await page.evaluate(id => window.__cssearthTest.object(id).assertStableDomIdentity(), id), true);
    await page.evaluate(({ id, facing }) => window.__cssearthTest.object(id).camera.setState(facing), { id, facing });
    let clickedFeature: string | null = null;
    if (mode === 'desktop') {
      // These angles also expose a named feature away from the side panels.
      await page.evaluate(({ id, yaw }) => window.__cssearthTest.object(id).camera.setState({ controlPitch: 90, controlYaw: yaw, zoom: 1.3 }), { id, yaw: id === 'didymos' ? 0 : 270 });
      await page.waitForTimeout(400);
      const label = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-feature-label]')].map(e => {
        const r=e.getBoundingClientRect(), style=getComputedStyle(e); return { id:e.dataset.featureLabel, x:r.x+r.width/2, y:r.y+r.height/2, visible:style.visibility==='visible' && Number(style.opacity)>.5 };
      }).find(r=>r.visible && r.x>380 && r.x<1070 && r.y>90 && r.y<850));
      assert.ok(label?.id, `${id}: an existing feature is visible on the photographic lens`);
      await page.mouse.move(label.x, label.y);
      await page.waitForFunction(feature => window.__cssearthTest.object().runtime.surfaceFeatures()?.hovered === feature, label.id);
      await page.mouse.click(label.x, label.y);
      await page.waitForFunction(feature => { const f=window.__cssearthTest.object().runtime.surfaceFeatures(); return f?.pinned===feature && !f.flying; }, label.id);
      clickedFeature=label.id;
      await page.mouse.click(1050,850);
    }
    await page.evaluate(({ id, facing }) => window.__cssearthTest.object(id).camera.setState({ ...facing, zoom: facing.zoom * 1.65 }), { id, facing });
    const lighting = [];
    for (const shadows of [false, true]) {
      await page.evaluate(shadows => { const input=window.__cssearthTest.input('input[name="shadows"]'); if (input.checked!==shadows) input.click(); }, shadows);
      await page.waitForFunction(({ id, shadows }) => window.__cssearthTest.object(id).runtime.selection().committed?.shadows===shadows, { id, shadows });
      await page.waitForTimeout(300);
      const bytes=await page.screenshot({path:resolve(output,`${id}-${mode}-close-shadows-${shadows}.png`)});
      lighting.push(createHash('sha256').update(bytes).digest('hex'));
    }
    assert.notEqual(lighting[0],lighting[1],`${id}: directional Shadows changes the mounted photographic view`);
    const state = await page.evaluate(id => ({ camera:window.__cssearthTest.object(id).camera.state(), features:window.__cssearthTest.object(id).runtime.surfaceFeatures(), retained:window.__cssearthTest.object(id).assertStableDomIdentity(), density:window.__cssearthTest.object(id).renderStats.selectedPreparedDensity }), id);
    assert.equal(state.features?.enabled,true);
    assert.deepEqual(errors,[]);
    reports.push({ id,mode,viewport,dpr,lenses,clickedFeature,photographs:[...photographs].sort(),state,errors,lighting });
    console.log(`PASS ${id}/${mode}: lens selection, retained drag, close-up and lighting${clickedFeature ? ', feature click' : ''}`);
    await page.close();
  }
} finally { await browser.close(); }
for (const id of ['didymos','dimorphos']) {
  const one=reports.find(r=>r.id===id&&r.mode==='desktop')!,two=reports.find(r=>r.id===id&&r.mode==='dpr2')!;
  assert.deepEqual(two.photographs,one.photographs,`${id}: DPR does not select different photograph assets`);
  assert.equal(one.state.density,two.state.density);
}
await writeFile(resolve(output,'report.json'),JSON.stringify({revision,browser:browser.version(),base,reports},null,2));
