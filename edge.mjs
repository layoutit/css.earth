// The drawn photosphere edge: walk right from the sphere's centre until the pixel stops matching the centre's colour.
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const path of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:4231' + path); await page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 60_000 }); await page.waitForTimeout(6000);
  const fill = await page.evaluate(() => { const r = document.querySelector('.prepared-interior-fill').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width }; });
  for (const s of ['[class*="-limb-layer"]', '[class*="-corona-layer"]']) await page.evaluate(s => { document.querySelector(s).style.visibility = 'hidden'; }, s);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ clip: { x: Math.round(fill.cx), y: Math.round(fill.cy), width: Math.round(fill.w), height: 1 } });
  const { PNG } = await import('pngjs'); const img = PNG.sync.read(png);
  const px = x => [img.data[x * 4], img.data[x * 4 + 1], img.data[x * 4 + 2]], base = px(2);
  let edge = 0; for (let x = 0; x < img.width; x++) { const p = px(x); if (Math.max(...p) > 25 && Math.abs(p[0] - base[0]) + Math.abs(p[1] - base[1]) + Math.abs(p[2] - base[2]) < 200) edge = x; }
  console.log(path.padEnd(28), 'fill width', Math.round(fill.w), '| drawn photosphere radius', edge, 'px | fitted 496 plate radius', (496 * 0.929 / 2).toFixed(1), '| 620 plate radius', (620 * 0.929 / 2).toFixed(1));
  await page.close();
}
await browser.close();
