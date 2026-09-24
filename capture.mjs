// View readout in the app: Earth loaded, a flight to Mars sampled mid-flight, arrival, then a focus link.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./runs/${label}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const ready = () => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
const facts = () => page.evaluate(() => { const q = s => document.querySelector(s);
  return { dateHidden: q('.object-view-date')?.hidden, coordinatesHidden: q('.object-view-coordinates')?.hidden, altitude: q('[data-view-altitude]')?.textContent,
    label: q('[data-view-distance-label]')?.textContent, scaleHidden: q('.object-view-scale')?.hidden, scale: q('[data-view-scale-label]')?.textContent }; });
const steps = [], snap = async step => { steps.push({ step, ...(await facts()) }); await page.screenshot({ path: `${out}${steps.length}-${step}.png`, clip: { x: 0, y: 760, width: 1280, height: 40 } }); };
await page.goto('http://127.0.0.1:4231/earth/'); await ready(); await page.waitForTimeout(2500); await snap('earth');
await page.evaluate(() => { const a = document.createElement('a'); a.href = '/mars/'; document.body.append(a); a.click(); a.remove(); });
await page.waitForTimeout(400); await snap('mid-flight');
await ready(); await page.waitForTimeout(4000); await snap('arrived at mars');
await page.goto('http://127.0.0.1:4231/earth/?focus=m42'); await ready(); await page.waitForTimeout(3000); await snap('m42 focus');
await browser.close();
writeFileSync(`${out}steps.json`, JSON.stringify(steps, null, 1));
console.log(label, steps.map(s => `${s.step}: date ${s.dateHidden ? 'hid' : 'on'} coords ${s.coordinatesHidden ? 'hid' : 'on'} ${s.label} ${s.altitude} scale ${s.scaleHidden ? 'hid' : s.scale}`).join(' | '));
