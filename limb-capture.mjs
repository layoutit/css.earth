import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./limb-runs/${label}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const path of ['/sun/', '/kelt-9b/', '/ab-pic-b/', '/sgr-a-star/', '/aldebaran/']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4231' + path);
  const ok = await page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 60_000 }).then(() => true, () => false);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}${path.replace(/[^a-z0-9]+/giu, '_')}.png` });
  console.log(label, path, ok ? 'ready' : 'NEVER READY');
  await page.close();
}
await browser.close();
