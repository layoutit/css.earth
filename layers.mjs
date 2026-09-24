// COR1 lens on /sun/: the band just outside the limb, with each plate hidden in turn. Radii in solar radii.
import { chromium } from 'playwright';
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:4231/sun/'); await page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 60_000 }); await page.waitForTimeout(8000);
await page.locator('[name="dataset"][value="cor1-density"]').first().click({ force: true }); await page.waitForTimeout(8000);
const vars = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.sun-corona-layer')); return { corona: s.backgroundImage.slice(0, 120), limb: getComputedStyle(document.querySelector('.sun-limb-layer')).backgroundImage.slice(0, 120) }; });
console.log(JSON.stringify(vars));
const out = new URL('./', import.meta.url).pathname;
for (const [label, hide] of [['both shown', []], ['corona plate hidden', ['.sun-corona-layer']], ['limb plate hidden', ['.sun-limb-layer']], ['both hidden', ['.sun-corona-layer', '.sun-limb-layer']]]) {
  await page.evaluate(hide => { for (const s of ['.sun-corona-layer', '.sun-limb-layer']) document.querySelector(s).style.visibility = hide.includes(s) ? 'hidden' : ''; }, hide);
  await page.waitForTimeout(500);
  const shot = await page.screenshot({ path: `${out}layers-${label.replaceAll(' ', '-')}.png` });
  console.log(label.padEnd(20), await page.evaluate(() => 'ok'));
}
await browser.close();
