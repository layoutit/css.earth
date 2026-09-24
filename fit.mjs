// Drawn plate diameter (CSS background size × the silhouette-fit scale) against the sphere's drawn width.
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const path of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:4231' + path); await page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 60_000 }); await page.waitForTimeout(6000);
  console.log(path.padEnd(28), JSON.stringify(await page.evaluate(() => {
    const sphere = document.querySelector('.prepared-interior-fill')?.getBoundingClientRect().width ?? null;
    return { sphere: sphere && Math.round(sphere), plates: [...document.querySelectorAll('[class*="-limb-layer"], [class*="-corona-layer"]')].map(p => {
      const s = getComputedStyle(p), css = parseFloat(s.backgroundSize), m = new DOMMatrix(s.transform === 'none' ? undefined : s.transform);
      const scale = Math.hypot(m.a, m.b);
      return `${p.className.split(' ')[0]}: css ${Math.round(css)} × transform scale ${scale.toFixed(3)} = ${Math.round(css * scale)} (${sphere ? (css * scale / sphere).toFixed(3) : '?'} × sphere)`; }) };
  })));
  await page.close();
}
await browser.close();
