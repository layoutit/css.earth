// Opening cameras: plain pages and lens links, fresh loads, plus one in-app tree click. Altitude text and a screenshot each.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./runs/${label}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ready = page => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 45_000 });
const facts = page => page.evaluate(() => ({ url: location.pathname + location.search.replace(/[?&]v=[^&]*/u, ''), altitude: document.querySelector('[data-view-altitude]')?.textContent,
  distanceLabel: document.querySelector('[data-view-distance-label]')?.textContent, lens: [...document.querySelectorAll('[name="dataset"]')].find(e => e.checked)?.value ?? null }));
const pages = ['/beta-pictoris/', '/beta-pictoris/?dataset=debris-disc-visible', '/hd-181327/?dataset=debris-ring', '/pds-70/?dataset=dust-ring', '/sun/?dataset=cor1-density',
  '/betelgeuse/', '/hd-181327/', '/earth/'];
const results = {};
for (const path of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:4231${path}`);
  const isReady = await ready(page).then(() => true, () => false); await page.waitForTimeout(3000);
  const notice = await page.evaluate(() => [...document.querySelectorAll('[role="status"]')].map(e => e.textContent.trim()).filter(text => /unavailable|default dataset/.test(text)));
  results[path] = { ...(await facts(page)), ready: isReady, notice, errors };
  await page.screenshot({ path: `${out}${path.replace(/[^a-z0-9]+/giu, '_')}.png` });
  await page.close();
}
// In-app: from Earth, open the tree entry for the Beta Pictoris disc.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4231/earth/'); await ready(page); await page.waitForTimeout(1500);
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/beta-pictoris/?dataset=debris-disc'; document.body.append(a); a.click(); a.remove(); });
  await page.waitForTimeout(1500); await ready(page); await page.waitForTimeout(6000);
  results['in-app /earth/ -> /beta-pictoris/?dataset=debris-disc'] = { ...(await facts(page)), errors };
  await page.screenshot({ path: `${out}in-app-beta-pictoris-disc.png` });
  await page.close();
}
await browser.close();
writeFileSync(`${out}facts.json`, JSON.stringify(results, null, 1));
for (const [path, r] of Object.entries(results)) console.log(label, path.padEnd(52), r.ready === false ? 'NEVER READY' : '', r.distanceLabel, r.altitude, r.notice?.length ? 'NOTICE ' + r.notice.join(' | ') : '', r.errors.length ? 'ERRORS ' + r.errors.join(' | ') : '');
