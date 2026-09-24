import { chromium } from 'playwright';
const out = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const ready = () => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
await page.goto('http://127.0.0.1:4231/beta-pictoris/'); await ready(); await page.waitForTimeout(1500);
await page.locator('.object-sidebar-view-all').click(); await page.waitForTimeout(1500);
const tree = await page.evaluate(() => {
  const links = [...document.querySelectorAll('[data-object-navigation-tree] a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
  const labels = [...document.querySelectorAll('[data-object-navigation-tree] summary, [data-object-navigation-tree] .atlas-tree-group, [data-object-navigation-tree] .atlas-tree-root')].map(e => e.textContent.trim());
  return { disc: links.filter(l => /debris disc|dust ring|debris ring|corona|circumstellar/i.test(l.text)), kepler: links.filter(l => /Kepler-16/.test(l.text)),
    other: labels.filter(l => /^Other\b/.test(l)), sagittarius: links.filter(l => /Sagittarius A/.test(l.text)), omega: links.filter(l => /Omega Centauri/.test(l.text)) };
});
console.log(JSON.stringify(tree, null, 1));
const disc = page.locator('[data-object-navigation-tree] a', { hasText: 'Beta Pictoris debris disc' }).first();
await disc.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}tree.png` });
await disc.click(); await page.waitForTimeout(3000); await ready(); await page.waitForTimeout(2500);
console.log('after click:', await page.evaluate(() => ({ url: location.pathname + location.search, lens: document.querySelector('[aria-pressed="true"][data-lens-id], input[name="dataset"]:checked, [data-dataset][aria-current]')?.outerHTML?.slice(0, 160) ?? null,
  activeLens: [...document.querySelectorAll('[name="dataset"]')].find(e => e.checked || e.getAttribute('aria-pressed') === 'true')?.value ?? null })));
await page.screenshot({ path: `${out}disc-opened.png` });
console.log('errors', errors);
await browser.close();
