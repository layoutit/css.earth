import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createTestPage } from '../../../../site/test/browser-observations.mts';
import { conformanceBrowserLaunch } from '../../../../site/test/conformance-browser-launch.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:53136';
const output = resolve('output/playwright/pluto-ices');
await mkdir(output, { recursive: true });
const launch = await conformanceBrowserLaunch({ channel: 'chrome', evidenceDirectory: output });
const browser = await chromium.launch(launch.options), reports = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await createTestPage(browser, { viewport, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/pluto/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      assert.equal(await page.locator('input[name="shadows"]').isChecked(), false);
      const initial = await page.locator('.pluto-body s').elementHandles();
      assert.equal(initial.length, 450);
      if (viewport.width < 500) {
        for (let i = 0; i < 3 && await page.locator('body').getAttribute('data-sheet') !== 'full'; i++) {
          await page.getByRole('button', { name: 'Resize information sheet', exact: true }).click();
        }
      }
      for (const id of ['methane-ice', 'nitrogen-ice', 'water-ice', 'surface']) {
        await page.locator(`button[name="dataset"][value="${id}"]`).click();
        await page.waitForFunction(lens => document.querySelector('.planet-stage')?.getAttribute('data-lens') === lens, id);
        const texture = await page.locator('.pluto-body').evaluate((root) => {
          const band = root.querySelector('s:not(.pluto-polar)'), pole = root.querySelector('s.pluto-polar');
          if (!band || !pole) throw new Error('Missing latitude or pole texture');
          return { band: getComputedStyle(band).backgroundImage, pole: getComputedStyle(pole).backgroundImage };
        });
        assert.ok(texture.band.includes(`/pluto-${id}@2x.webp`), `${id}: globe still shows another latitude texture`);
        assert.ok(texture.pole.includes(`/pluto-poles-${id}@2x.webp`), `${id}: globe still shows another polar texture`);
        const retained = await Promise.all(initial.map(node => node.evaluate(element => element.isConnected)));
        assert.ok(retained.every(Boolean));
        assert.equal(await page.locator('.pluto-body s').count(), initial.length);
        if (id !== 'surface') {
          assert.match(await page.locator(`#pluto-${id}-details`).innerText(), /Grid: no usable fit/);
          await page.screenshot({ path: resolve(output, `${id}-${viewport.width}.png`) });
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
        reports.push({ viewport, id, texture, leaves: initial.length, shadows: false, url: page.url() });
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  await writeFile(resolve(output, 'texture-bindings.json'), JSON.stringify({ browser: browser.version(), reports }, null, 2) + '\n');
  console.log('PASS: desktop and mobile dataset selection binds both texture regions, retains 450 leaves and starts with shadows off.');
} finally { await browser.close(); }
