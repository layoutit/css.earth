// The Sun, loaded plainly, then the COR1 lens picked in the page once the world is loaded.
import { chromium } from 'playwright';
const label = process.argv[2], out = new URL(`./runs/${label}-`, import.meta.url).pathname;
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const ready = () => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 60_000 });
await page.goto('http://127.0.0.1:4231/sun/'); await ready(); await page.waitForTimeout(8000);
await page.screenshot({ path: `${out}sun-plain.png` });
await page.locator('[name="dataset"][value="cor1-density"]').first().click({ force: true }).catch(async () => {
  await page.locator('label, button', { hasText: 'COR1' }).first().click(); });
await page.waitForTimeout(8000);
console.log(label, JSON.stringify(await page.evaluate(() => ({ url: location.search.replace(/[?&]v=[^&]*/u, ''), altitude: document.querySelector('[data-view-altitude]')?.textContent,
  notice: [...document.querySelectorAll('[role="status"]')].map(e => e.textContent.trim()).filter(t => /unavailable/.test(t)) }))));
await page.screenshot({ path: `${out}sun-cor1-picked.png` });
await browser.close();
