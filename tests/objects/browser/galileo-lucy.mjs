import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4259';
const output = resolve('output/playwright/galileo-lucy/review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  for (const id of ['dactyl', 'dinkinesh', 'selam']) {
    await page.goto(`${origin}/${id}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(id => window[`__${id}`]?.ready === true, id);
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    assert.equal(await page.locator('.planet-stage[data-object-id]').count(), 1);
    const detail = await page.locator('button[name="lens"]').innerText();
    for (const shadows of [false, true]) {
      await page.locator('input[name="shadows"]').evaluate((input, checked) => { if (input.checked !== checked) input.click(); }, shadows);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: resolve(output, `${id}-shadows-${shadows}.png`) });
    }
    reports.push({ id, selector: detail, retained: await page.evaluate(id => window[`__${id}`].assertStableDomIdentity(), id) });
    if (id === 'dinkinesh') continue;
    await page.evaluate(({ id, zoom }) => window[`__${id}`].camera.setState({ zoom }), { id, zoom: id === 'dactyl' ? .006 : .04 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const cue = await page.locator(`[data-context-group="${id}"]`).evaluate(group => {
      const indicator = group.querySelector('[data-context-indicator]');
      const segments = [...group.querySelectorAll('.context-orbit s')];
      return { placement: group.dataset.contextPlacement, selected: group.dataset.contextSelected,
        label: group.querySelector('[data-context-label]').textContent,
        indicatorRadius: getComputedStyle(indicator).borderRadius,
        visibleSegments: segments.filter(segment => getComputedStyle(segment).visibility !== 'hidden' && getComputedStyle(segment).display !== 'none').length,
        gapColors: [...new Set([...group.querySelectorAll('.context-orbit s:nth-child(even)')].map(segment => getComputedStyle(segment).backgroundColor))],
        dashColors: [...new Set([...group.querySelectorAll('.context-orbit s:nth-child(odd)')].map(segment => getComputedStyle(segment).backgroundColor))] };
    });
    assert.equal(cue.placement, 'approximate');
    assert.match(cue.label, /\(approx\)/);
    assert.deepEqual(cue.gapColors, ['rgba(0, 0, 0, 0)']);
    assert(cue.dashColors.every(color => color !== 'rgba(0, 0, 0, 0)'));
    assert.equal(cue.indicatorRadius, '50%');
    assert(cue.visibleSegments > 0);
    reports.push({ id, orbitCue: cue, url: page.url() });
    await page.screenshot({ path: resolve(output, `${id}-approximate-orbit.png`) });
    const parent = id === 'dactyl' ? 'ida' : 'dinkinesh';
    await page.locator(`.planet-breadcrumbs a[href="/${parent}/"]:visible`).first().click();
    await page.waitForFunction(parent => window[`__${parent}`]?.ready === true, parent);
    assert.equal(await page.locator('.planet-stage[data-object-id]').getAttribute('data-object-id'), parent);
    assert.equal(await page.locator('.planet-stage').count(), 1);
    reports.push({ navigation: `${id} → ${parent}`, sceneCount: 1 });
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ browser: browser.version(), origin, reports, errors }, null, 2) + '\n');
} finally { await browser.close(); }
