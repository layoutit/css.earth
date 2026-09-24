import { chromium } from 'playwright';
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ready = () => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
const log = async label => { const l = await page.evaluate(() => globalThis.__clockLog ?? []); console.log(label, 'events', l.length, 'owners now', [...l].reverse().find(e => e[0] !== 'destroyed')?.[1], 'destroyed', l.filter(e => e[0] === 'destroyed').length); return l; };
await page.goto('http://127.0.0.1:4231/earth/'); await ready(); await page.waitForTimeout(2000); await log('earth loaded');
for (const route of ['/mars/', '/saturn/', '/earth/']) {
  await page.evaluate(r => { const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove(); }, route);
  await page.waitForTimeout(8000); await ready(); await page.waitForTimeout(1500); await log('after ' + route);
}
const l = await page.evaluate(() => globalThis.__clockLog);
const counts = {}; for (const e of l) if (e[0] === '+') counts[e[2]] = (counts[e[2]] ?? 0) + 1;
console.log(counts);
await browser.close();
