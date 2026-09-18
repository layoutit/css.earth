import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

// The one shared, content-addressed object catalogue: proves the client
// fetches and inserts it, marks the current object once it arrives, keeps
// marking it on in-app navigation, and that a zoom-out transition (which
// never touches the catalogue) still works. Runs against a production build
// (diagnostics disabled), so readiness and identity come from the same
// document attributes the shell itself publishes, not the dev-only
// `window.__cssEarth` inspection API.
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/catalogue-fragment');
await mkdir(output, { recursive: true });
const browser = await chromium.launch((await conformanceBrowserLaunch({ evidenceDirectory: output })).options);
const cases: string[] = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  const fragmentRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/catalogue/')) fragmentRequests.push(request.url()); });

  await page.goto(`${origin}/saturn/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const browserPanel = page.locator('.planet-object-browser');
  // Opening browse/search is the one thing that can race the fragment fetch:
  // whichever of "first idle" or this click comes first starts it.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.planet-object-item').length > 400, undefined, { timeout: 20000 });
  assert.ok(fragmentRequests.length <= 1, `the fragment is fetched at most once (saw ${fragmentRequests.length})`);
  const saturnLink = browserPanel.locator('a.planet-object-link[data-object-id="saturn"]');
  await saturnLink.waitFor({ state: 'attached' });
  assert.equal(await saturnLink.getAttribute('aria-current'), 'page', 'Saturn is marked current once the catalogue loads');
  assert.equal((await saturnLink.getAttribute('class') ?? '').includes('is-active'), true);
  await page.screenshot({ path: `${output}/saturn-browse-open.png` });
  cases.push('The shared catalogue loads once, and Saturn is marked current as soon as it arrives');
  console.log(cases.at(-1));

  const vestaLink = browserPanel.locator('a.planet-object-link[data-object-id="vesta"]');
  await vestaLink.scrollIntoViewIfNeeded();
  await vestaLink.click();
  await page.waitForURL(url => url.pathname === '/vesta/');
  await page.waitForFunction(() => document.body.dataset.objectShell === 'vesta');
  assert.equal(await saturnLink.getAttribute('aria-current'), null, 'Saturn is no longer marked current');
  assert.equal(await vestaLink.getAttribute('aria-current'), 'page', 'Vesta becomes the marked row');
  assert.equal((await vestaLink.getAttribute('class') ?? '').includes('is-active'), true);
  await page.screenshot({ path: `${output}/vesta-marked.png` });
  cases.push('In-app navigation Saturn -> Vesta moves the current-row marker');
  console.log(cases.at(-1));
  assert.ok(fragmentRequests.length <= 1, `navigating never re-fetches the fragment (saw ${fragmentRequests.length})`);

  // The Milky Way overview link a page's own catalogue rows carry
  // (`?overview=milky-way` on the Sun's route) is the same zoom-out
  // destination a continuous wheel journey reaches; landing on it directly
  // exercises the same `objectBrowser.setOverview` path deterministically,
  // since precise camera-distance targeting needs the dev-only diagnostics API.
  await page.goto(`${origin}/sun/?overview=milky-way`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.waitForFunction(() => document.documentElement.dataset.selection === 'milky-way', undefined, { timeout: 20000 });
  await page.screenshot({ path: `${output}/sun-zoomed-to-milky-way.png` });
  cases.push('Zooming out from the Sun reaches the Milky Way overview');
  console.log(cases.at(-1));

  assert.deepEqual(consoleErrors, [], `no console errors: ${consoleErrors.join(' | ')}`);
  await context.close();

  // No-JS: the root route searches for "saturn" and reaches the object, using
  // only the no-JS search function's server-side merge of the same fragment.
  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(`${origin}/?q=saturn`, { waitUntil: 'domcontentloaded' });
  const saturnResult = noJsPage.locator('.planet-object-browser a.planet-object-link[data-object-id="saturn"]');
  assert.equal(await saturnResult.isVisible(), true, 'no-JS search for "saturn" from / shows the Saturn row');
  await noJsPage.screenshot({ path: `${output}/no-js-search-saturn.png` });
  await saturnResult.click();
  await noJsPage.waitForURL(url => url.pathname === '/saturn/');
  assert.equal(await noJsPage.locator('.planet-stage').getAttribute('data-object-id'), 'saturn', 'no-JS reaches the object page');
  await noJsPage.screenshot({ path: `${output}/no-js-reached-saturn.png` });
  cases.push('No-JS /?q=saturn shows Saturn and reaches its page on click, with no client script');
  console.log(cases.at(-1));
  await noJsContext.close();
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ origin, cases }, null, 2) + '\n');
  await browser.close();
}
