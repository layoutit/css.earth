import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createTestPage } from '../../../../site/test/browser-observations.mts';
import { conformanceBrowserLaunch } from '../../../../site/test/conformance-browser-launch.mts';
import { runtimeAssets } from '../../../../tools/runtime-assets.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:53136';
const output = resolve('output/playwright/charon-leisa');
await mkdir(output, { recursive: true });
const launch = await conformanceBrowserLaunch({ channel: 'chrome', evidenceDirectory: output });
const browser = await chromium.launch(launch.options), reports = [];
const expectedAssets = await runtimeAssets(process.cwd(), ['charon']);
const loaded: { filename: string; sha256: string; bytes: number; url: string }[] = [];
const interactions = [];
try {
  for (const [viewport, density] of [[{ width: 1440, height: 1000 }, 1], [{ width: 1440, height: 1000 }, 2], [{ width: 390, height: 844 }, 1]] as const) {
    const page = await createTestPage(browser, { viewport, deviceScaleFactor: density });
    const errors: string[] = [], failedRequests: string[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', response => { if (response.status() >= 400) failedRequests.push(response.url() + ': ' + response.status()); });
    page.on('response', response => {
      const filename = new URL(response.url()).pathname.split('/').at(-1);
      const expected = expectedAssets.find(asset => asset.filename === filename);
      if (!expected || !/water-ice|ammonia|charon-features/.test(expected.filename) || response.status() === 304) return;
      pending.push((async () => {
        const bytes = await response.body(), sha256 = createHash('sha256').update(bytes).digest('hex');
        assert.equal(sha256, expected.sha256, expected.filename);
        loaded.push({ filename: expected.filename, sha256, bytes: bytes.length, url: response.url() });
      })().catch(error => { errors.push(String(error)); }));
    });
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/charon/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      assert.equal(await page.locator('input[name="shadows"]').isChecked(), false);
      const machines = page.getByRole('button', { name: 'Machines', exact: true });
      if (await machines.getAttribute('aria-pressed') === 'true') await machines.click();
      const initial = await page.locator('.charon-body s').elementHandles();
      assert.equal(initial.length, 450);
      if (viewport.width < 500) {
        for (let i = 0; i < 3 && await page.locator('body').getAttribute('data-sheet') !== 'full'; i++) {
          await page.getByRole('button', { name: 'Resize information sheet', exact: true }).click();
        }
      }
      for (const id of ['water-ice', 'ammonia', 'normal']) {
        await page.locator(`button[name="lens"][value="${id}"]`).click();
        await page.waitForFunction(lens => document.querySelector('.planet-stage')?.getAttribute('data-lens') === lens, id);
        const texture = await page.locator('.charon-body').evaluate((root) => {
          const band = root.querySelector('s:not(.charon-polar)'), pole = root.querySelector('s.charon-polar');
          if (!band || !pole) throw new Error('Missing latitude or pole texture');
          return { band: getComputedStyle(band).backgroundImage, pole: getComputedStyle(pole).backgroundImage };
        });
        assert.ok(texture.band.includes(`/charon-${id}@2x.webp`), `${id}: globe still shows another latitude texture`);
        assert.ok(texture.pole.includes(`/charon-poles-${id}@2x.webp`), `${id}: globe still shows another polar texture`);
        const retained = await Promise.all(initial.map(node => node.evaluate(element => element.isConnected)));
        assert.ok(retained.every(Boolean));
        assert.equal(await page.locator('.charon-body s').count(), initial.length);
        if (id !== 'normal') {
          assert.match(await page.locator(`#charon-${id}-details`).innerText(), /Grid: no usable spectrum/);
          await page.screenshot({ path: resolve(output, `${id}-${viewport.width}-dpr${density}.png`) });
          if (viewport.width < 500) {
            for (let i = 0; i < 3 && await page.locator('body').getAttribute('data-sheet') !== 'peek'; i++) {
              await page.getByRole('button', { name: 'Resize information sheet', exact: true }).click();
            }
            await page.waitForFunction(() => {
              const sheet = document.querySelector('.planet-sidebar');
              return sheet !== null && Math.abs(sheet.getBoundingClientRect().top -
                (innerHeight - parseFloat(getComputedStyle(sheet).getPropertyValue('--sheet-peek')))) < 2;
            });
            await page.screenshot({ path: resolve(output, `${id}-mobile-globe.png`) });
            for (let i = 0; i < 3 && await page.locator('body').getAttribute('data-sheet') !== 'full'; i++) {
              await page.getByRole('button', { name: 'Resize information sheet', exact: true }).click();
            }
          }
        }
        reports.push({ viewport, density, id, texture, leaves: initial.length, shadows: false, url: page.url() });
      }
      if (viewport.width > 500) {
        const before = await page.locator('.charon-body s').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return [r.x, r.y]; }));
        await page.mouse.move(830, 500); await page.mouse.down(); await page.mouse.move(1000, 590, { steps: 20 }); await page.mouse.up(); await page.waitForTimeout(500);
        const after = await page.locator('.charon-body s').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return [r.x, r.y]; }));
        assert.ok(Math.max(...after.map((p, i) => Math.hypot(p[0]!-before[i]![0]!, p[1]!-before[i]![1]!))) > 1, 'drag must move the visible body');
        assert.ok((await Promise.all(initial.map(node => node.evaluate(element => element.isConnected)))).every(Boolean));
      }
      if (viewport.width === 1440 && density === 1) {
        await page.locator('button[name="lens"][value="ammonia"]').click();
        await page.waitForFunction(() => document.querySelector('.planet-stage')?.getAttribute('data-lens') === 'ammonia');
        await page.locator('.planet-sidebar-search').fill('Organa');
        await page.getByRole('button', { name: 'Organa, Informal crater name, size unpublished', exact: true }).click();
        await page.waitForFunction(() => {
          const state = window.__cssearthTest.object('charon').runtime.surfaceFeatures();
          return state?.pinned === '89100000' && !state.flying;
        });
        await page.evaluate(() => window.__cssearthTest.object('charon').camera.setState({ zoom: 1.8 }));
        if (await machines.getAttribute('aria-pressed') === 'true') await machines.click();
        const map = page.locator('#charon-ammonia-details .planet-surface-minimap');
        await page.waitForFunction(() => {
          const map = document.querySelector<HTMLElement>('#charon-ammonia-details .planet-surface-minimap');
          return Math.abs(Number(map?.dataset.centerU) - 310.9 / 360) < 1e-5 &&
            Math.abs(Number(map?.dataset.centerV) - (.5 - 54.3 / 180)) < 1e-5;
        });
        // The URL, minimap and retained CSS leaves settle on different frames.
        await page.waitForTimeout(500);
        await page.screenshot({ path: resolve(output, 'organa-ammonia.png') });
        const settings = page.getByRole('button', { name: 'Settings', exact: true });
        await settings.click();
        await page.locator('label:has(input[name="shadows"])').click();
        assert.equal(await page.locator('input[name="shadows"]').isChecked(), true);
        await settings.click();
        await page.screenshot({ path: resolve(output, 'organa-shadows.png') });
        await settings.click(); await page.locator('label:has(input[name="shadows"])').click(); await settings.click();
        assert.equal(await page.locator('input[name="shadows"]').isChecked(), false);
        assert.ok((await Promise.all(initial.map(node => node.evaluate(element => element.isConnected)))).every(Boolean));
        interactions.push({ organa: '89100000', mapU: await map.getAttribute('data-center-u'), mapV: await map.getAttribute('data-center-v'),
          camera: await page.evaluate(() => window.__cssearthTest.object('charon').camera.state()), shadowsToggled: [true, false], retainedLeaves: initial.length });
      }
      await Promise.all(pending);
      assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
    } finally { await page.close(); }
  }
  for (const filename of ['charon-water-ice@2x.webp', 'charon-poles-water-ice@2x.webp', 'charon-ammonia@2x.webp', 'charon-poles-ammonia@2x.webp'])
    assert.ok(loaded.some(asset => asset.filename === filename), `${filename}: the browser must load verified prepared bytes`);
  await writeFile(resolve(output, 'texture-bindings.json'), JSON.stringify({ browser: browser.version(), reports, loaded, interactions }, null, 2) + '\n');
  console.log('PASS: desktop/mobile textures and delivered bytes, 450 retained leaves, drag, Shadows off/on/off and Organa/minimap coordinates.');
} finally { await browser.close(); }
