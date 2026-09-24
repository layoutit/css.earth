// Search sidebar in the app: scripted searches on /earth/, recording every sidebar fact after each step. The find
// endpoint is the dev server's own, delayed on demand to catch a feature search in flight, and failed for "failq".
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./runs/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let findDelay = 0, catalogueDelay = 0;
const facts = page => page.evaluate(() => {
  const q = s => document.querySelector(s), visible = e => !e.closest('[hidden]');
  const details = q('.object-feature-results'), nav = q('.object-browser');
  return {
    value: q('.object-sidebar-search').value, expanded: q('.object-sidebar-view-all').ariaExpanded,
    browserHidden: nav.hidden, aria: nav.getAttribute('aria-label'), searchResults: nav.hasAttribute('data-search-results'),
    navFiltered: nav.hasAttribute('data-navigation-filtered'), treeHidden: q('[data-object-navigation-tree]')?.hidden ?? null,
    resultsHidden: q('#object-category-results').hidden, emptyHidden: q('.object-empty').hidden,
    pressed: [...document.querySelectorAll('.object-search-category[aria-pressed="true"]')].map(b => b.dataset.searchClassification),
    features: { hidden: details.hidden, open: details.open, count: details.querySelector('.object-panel-heading-count')?.textContent ?? null,
      hint: details.querySelector('.object-destination-hint')?.textContent ?? null,
      rows: [...details.querySelectorAll('li:not([hidden]) .object-destination-result-name')].map(e => e.textContent) },
    objects: [...document.querySelectorAll('#object-category-results .object-item')].filter(visible).map(e => e.dataset.objectName).slice(0, 12),
    objectCount: [...document.querySelectorAll('#object-category-results .object-item')].filter(visible).length,
    overviews: [...document.querySelectorAll('[data-search-overview]')].filter(e => !e.hidden).map(e => e.dataset.searchOverview),
  };
});
const ready = page => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/.netlify/functions/find**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    if (findDelay) await new Promise(r => setTimeout(r, findDelay));
    if (q.startsWith('failq')) return route.fulfill({ status: 500, body: 'fail' });
    return route.continue();
  });
  await page.route('**/catalogue/index.json', async route => { if (catalogueDelay) await new Promise(r => setTimeout(r, catalogueDelay)); return route.continue(); });
  await page.goto(`http://127.0.0.1:4231${url}`); await ready(page); await page.waitForTimeout(1500);
  return { page, errors };
}
const type = async (page, text) => { await page.locator('.object-sidebar-search').fill(text); };
const flows = {
  'typed searches': async (page, snap) => {
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(2500); await snap('opened');
    findDelay = 1500;
    await type(page, 'tycho'); await page.waitForTimeout(300); await snap('tycho, features in flight'); await page.waitForTimeout(2000); await snap('tycho, settled');
    await type(page, 'zzqx'); await page.waitForTimeout(300); await snap('no match, features in flight'); await page.waitForTimeout(2000); await snap('no match, settled');
    findDelay = 0;
    await type(page, 'failq'); await page.waitForTimeout(1500); await snap('feature search failed');
    await type(page, 'sat'); await page.waitForTimeout(1500); await snap('objects and features');
    await type(page, 'all objects'); await page.waitForTimeout(1500); await snap('all objects');
    await type(page, 'solar system'); await page.waitForTimeout(1500); await snap('a system name');
    await type(page, 'milky'); await page.waitForTimeout(1500); await snap('an overview row');
    await type(page, '   '); await page.waitForTimeout(1000); await snap('whitespace only');
    await type(page, 'SAT '); await page.waitForTimeout(1500); await snap('same query, other case and spacing');
  },
  'pills and clearing': async (page, snap) => {
    await page.locator('.object-search-category').first().click(); await page.waitForTimeout(2500); await snap('first pill');
    await page.locator('.object-search-category').nth(1).click(); await page.waitForTimeout(1500); await snap('second pill');
    await page.locator('.object-search-category').nth(1).click(); await page.waitForTimeout(1500); await snap('second pill again');
    await page.locator('.object-sidebar-search').click(); await type(page, 'zzqx'); await page.waitForTimeout(1500); await snap('no match');
    await page.locator('.object-sidebar-search-clear').click(); await page.waitForTimeout(1500); await snap('cleared');
  },
  'close and reopen': async (page, snap) => {
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(2500);
    await type(page, 'sat'); await page.waitForTimeout(1500); await snap('sat');
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(1000); await snap('closed');
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(1500); await snap('reopened, same query');
    findDelay = 1500;
    await type(page, 'zzqx'); await page.waitForTimeout(200);
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(2500); await snap('closed while features were in flight');
    findDelay = 0;
    await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(1500); await snap('reopened no match');
  },
  'search before the catalogue loads': async (page, snap) => {
    catalogueDelay = 2500;
    await page.locator('.object-sidebar-view-all').click(); await type(page, 'sat'); await page.waitForTimeout(600); await snap('catalogue loading');
    await page.waitForTimeout(3500); await snap('catalogue loaded');
    catalogueDelay = 0;
  },
  'native submitted search': async (page, snap) => { await snap('loaded'); },
};
const urls = { 'native submitted search': '/earth/?q=tycho' };
const results = {};
for (const [name, flow] of Object.entries(flows)) {
  findDelay = 0; catalogueDelay = 0;
  const { page, errors } = await open(urls[name] ?? '/earth/');
  const steps = [];
  await flow(page, async step => { steps.push({ step, ...(await facts(page)) }); await page.screenshot({ path: `${out}${name.replaceAll(' ', '-')}-${steps.length}.png` }); });
  results[name] = { steps, errors };
  await page.close();
}
await browser.close();
writeFileSync(`${out}facts.json`, JSON.stringify(results, null, 1));
console.log(label, Object.entries(results).map(([n, r]) => `${n}: ${r.steps.length} steps${r.errors.length ? ' ERRORS ' + r.errors.join(' | ') : ''}`).join('; '));
