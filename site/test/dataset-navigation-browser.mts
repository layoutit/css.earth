// Exercises the public shell and production dataset capability, without diagnostics.
import assert from 'node:assert/strict';
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
const report = { origin, browser: browser.version(), cases, errors, failedResponses };
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
page.on('request', request => requests.add(new URL(request.url()).pathname));

async function ready(body: string, lens?: string) {
  await page.waitForFunction(({ body, lens }) => document.documentElement.dataset.ready === 'true'
    && document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId === body
    && (!lens || document.querySelector<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')?.value === lens), { body, lens });
  assert.equal(await page.locator('.planet-stage').count(), 1, 'One retained object stage');
}
async function visit(path: string, body: string, lens?: string) {
  console.error(`[dataset-browser] ${path}`);
  assert.equal((await page.goto(new URL(path, origin).href))?.status(), 200);
  await ready(body, lens);
}
async function state() {
  return page.evaluate(() => ({ hash: location.hash, pathname: location.pathname,
    camera: new URL(location.href).searchParams.get('v'),
    transform: [...document.querySelectorAll('.planet-stage .polycss-camera > .polycss-scene')].map(node => getComputedStyle(node).transform),
    lens: document.querySelector<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')?.value,
    tab: document.querySelector('[aria-label="Object information"] [aria-selected="true"]')?.textContent?.trim() }));
}
async function missions() { await page.getByRole('tab', { name: 'Missions', exact: true }).click(); }
async function noOverflow(target: Page) {
  assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

try {
  await visit('/moon/', 'moon', 'surface');
  assert.equal(await page.locator('template[data-object-card]').evaluateAll(templates => templates.every(template =>
    template instanceof HTMLTemplateElement && !template.content.querySelector('[data-mission], [data-spacecraft]'))), true,
    'Inert sidebar previews must not embed the catalogue for every body');
  await missions();
  assert.equal(await page.getByRole('button', { name: 'NASA 2 missions', exact: true }).count(), 1);
  const grail = page.locator('[data-mission="grail"]');
  for (const id of ['grail-a', 'grail-b']) {
    const details = grail.locator(`[data-spacecraft="${id}"]`);
    await details.locator('summary').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await details.getAttribute('open'), '');
    assert.match(await details.innerText(), /No prepared dataset attributes observations to this vehicle/);
    assert.equal(await details.locator('[data-dataset-link]').count(), 0);
    await page.keyboard.press('Enter');
  }
  await page.screenshot({ path: resolve(output, 'moon-missions-desktop.png') });
  const stage = await page.locator('.planet-stage .polycss-camera').elementHandle();
  const before = await state();
  await grail.getByRole('link', { name: 'Crust', exact: true }).click();
  await ready('moon', 'crust');
  const crust = await state();
  assert.equal(crust.hash, '#dataset=crust');
  assert.ok(before.transform.length, 'The shared camera is mounted');
  assert.ok(before.transform.every(transform => transform.startsWith('matrix')), 'The camera pose is measurable');
  assert.deepEqual(crust.transform, before.transform, 'Same-body dataset link preserves the rendered camera');
  if (before.camera !== null) assert.equal(crust.camera, before.camera, 'An existing camera URL is preserved');
  assert.equal(await stage?.evaluate(node => node.isConnected), true, 'Dataset links retain the scene');
  assert.equal(await page.getByRole('tab', { name: 'Datasets', exact: true }).getAttribute('aria-selected'), 'true');
  await page.reload();
  await ready('moon', 'crust');
  assert.deepEqual((await state()).transform, crust.transform, 'Reload restores the shared view and selected dataset together');
  await page.goBack();
  await ready('moon', 'surface');
  assert.equal((await state()).hash, '');
  await page.goForward();
  await ready('moon', 'crust');
  await page.locator('button[name="lens"][value="surface"]').click();
  await ready('moon', 'surface');
  await page.waitForFunction(() => !location.hash.includes('dataset='));
  cases.push({ name: 'same-body, keyboard details, camera, retained scene, Back/Forward, manual selection', before, crust, manual: await state() });

  await visit('/moon/#vault&dataset=crust', 'moon', 'crust');
  assert.equal((await state()).hash, '#vault&dataset=crust');
  await page.locator('button[name="lens"][value="surface"]').click();
  await page.waitForFunction(() => location.hash === '#vault');
  cases.push({ name: 'direct link and unrelated fragment preservation', state: await state() });

  await visit('/moon/#dataset=missing', 'moon', 'surface');
  assert.equal(await page.locator('[data-dataset-notice]').isVisible(), true);
  assert.equal((await state()).hash, '#dataset=missing');
  await page.locator('button[name="lens"][value="surface"]').click();
  await page.waitForFunction(() => !location.hash.includes('dataset='));
  assert.equal(await page.locator('[data-dataset-notice]').isVisible(), false);
  cases.push({ name: 'invalid direct link retains default and manual default repairs URL', state: await state() });

  await visit('/bennu/', 'bennu', 'normal');
  await missions();
  assert.equal(await page.locator('[data-mission="osiris-rex"]').count(), 1);
  assert.equal(await page.locator('[data-mission="osiris-apex"]').count(), 0);
  const rex = page.locator('[data-spacecraft="osiris-rex"]');
  await rex.locator('summary').first().click();
  assert.match(await rex.innerText(), /OSIRIS-APEX/);
  assert.equal(await rex.locator('[data-dataset-link]').count(), 4);
  await page.screenshot({ path: resolve(output, 'bennu-spacecraft-desktop.png') });
  cases.push({ name: 'successor mission participation creates no false dataset contribution' });

  await visit('/saturn/', 'saturn', 'normal');
  await missions();
  for (const agency of await page.locator('[data-mission-agency]').all()) {
    await agency.focus();
    await page.keyboard.press('Enter');
    assert.equal(await agency.getAttribute('aria-pressed'), 'true');
  }
  const cassini = page.locator('[data-spacecraft="cassini"]');
  await cassini.locator('summary').first().click();
  const target = cassini.locator('a[data-dataset-object="titan"][data-dataset-id="normal"]');
  assert.equal(await target.count(), 1);
  await target.click();
  await ready('titan', 'normal');
  assert.equal((await state()).pathname, '/titan/');
  assert.equal(await page.getByRole('tab', { name: 'Datasets', exact: true }).getAttribute('aria-selected'), 'true');
  await missions();
  assert.equal(await page.locator('[data-mission="cassini"]').count(), 1, 'Destination content fills its deferred mission panel');
  assert.equal(await page.locator('[data-spacecraft="huygens"]').count(), 1);
  assert.equal(await page.locator('.planet-information-panel [data-deferred-detail]').count(), 0);
  await page.goBack();
  await ready('saturn', 'normal');
  cases.push({ name: 'cross-body reverse link and Back restore one scene', state: await state() });

  for (const body of ['mercury', 'mars', 'jupiter']) {
    await visit(`/${body}/`, body);
    await missions();
    assert.ok(await page.locator('[data-mission]').count() > 0);
    if (body === 'mars') assert.match(await page.getByRole('tabpanel', { name: 'Missions' }).innerText(), /Viking orbiters/);
    if (body === 'jupiter') assert.equal(await page.locator('[data-mission="juno"]').count(), 1);
    await page.screenshot({ path: resolve(output, `${body}-missions-desktop.png`) });
    cases.push({ name: `${body} individual mission cards and attribution`, state: await state() });
  }
  await visit('/juno/', 'juno');
  assert.equal(await page.locator('[data-mission="juno"]').count(), 0, 'The asteroid is not the Juno mission');
  await missions();
  assert.equal(await page.locator('[data-mission]').count(), 0, 'No invented missions for an unlinked body');
  assert.match(await page.getByRole('tabpanel', { name: 'Missions' }).innerText(), /No mission data available/);
  cases.push({ name: 'asteroid Juno namespace and empty state', state: await state() });

  await page.setViewportSize({ width: 390, height: 844 });
  await visit('/moon/', 'moon', 'surface');
  await missions();
  await noOverflow(page);
  await page.locator('[data-spacecraft="grail-a"] summary').first().scrollIntoViewIfNeeded();
  await page.locator('[data-mission="grail"] img').evaluateAll(images => Promise.all(images.map(image => {
    if (!(image instanceof HTMLImageElement)) throw new Error('Mission artwork must be an image');
    return image.decode();
  })));
  await page.screenshot({ path: resolve(output, 'moon-missions-mobile.png') });
  await page.locator('[data-mission="grail"]').getByRole('link', { name: 'Crust', exact: true }).click();
  await ready('moon', 'crust');
  await noOverflow(page);
  cases.push({ name: 'mobile mission and dataset flow', viewport: { width: 390, height: 844 }, state: await state() });

  assert.equal([...requests].some(path => /prepared-spacecraft\.json|source\/spacecraft\/catalog\.json|prepared\/provenance\.json|prepare-spacecraft/.test(path)), false,
    'The production browser must not fetch the catalogue, compiler or provenance graph');
  assert.deepEqual(errors, [], 'No browser application errors');
  assert.deepEqual(failedResponses, [], 'All requested production assets are installed');
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  errors.push(error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
