// Catalogue focus in the app: a direct focus link, choosing a focus from search, then clearing it.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./captures/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(), results = {};
const ready = page => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
const facts = page => page.evaluate(() => ({ url: location.pathname + location.search.replace(/[?&]v=[^&]*/u, ''), focus: document.querySelector('[data-prepared-focus-card]')?.getAttribute('data-prepared-focus-id') ?? null,
  focusVisible: !document.querySelector('[data-prepared-focus-card]')?.closest('[hidden]'), name: document.querySelector('[data-focus-name]')?.textContent ?? null, selection: document.documentElement.dataset.selection ?? null }));
const pick = async (page, term) => { const search = page.locator('.object-sidebar-search'); await search.click(); await search.fill(''); await search.pressSequentially(term);
  await page.waitForTimeout(800); await page.locator('.object-browser a[data-prepared-focus-id]:visible').first().click(); await page.waitForTimeout(6000); await ready(page); };
const flows = [
  ['direct-m42', '/earth/?focus=m42', []],
  ['search-switch-clear', '/earth/', [
    ['picked', page => pick(page, 'andromeda')],
    ['switched', page => pick(page, 'm42')],
    ['cleared', async page => { await page.locator('a[href="/sun/?overview=local-group"]:visible').first().click(); await page.waitForTimeout(5000); await ready(page); }],
  ]],
];
for (const [name, url, steps] of flows) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:4231${url}`); await ready(page); await page.waitForTimeout(2500);
  const record = [{ step: 'loaded', ...(await facts(page)) }];
  await page.screenshot({ path: `${out}${name}-loaded.png` });
  for (const [step, run] of steps) { await run(page); await page.waitForTimeout(1500); record.push({ step, ...(await facts(page)) }); await page.screenshot({ path: `${out}${name}-${step}.png` }); }
  results[name] = { record, errors };
  await page.close();
}
await browser.close();
writeFileSync(`${out}results.json`, JSON.stringify(results, null, 1));
for (const [name, r] of Object.entries(results)) console.log(name, r.record.map(s => `${s.step}: ${s.url} focus=${s.focus}/${s.focusVisible} ${s.name ?? ''} [${s.selection}]`).join(' | '), r.errors.length ? 'ERRORS ' + r.errors.join(' | ') : '');
