// Frame clock in the app: load Earth, drag, wheel-zoom, fly to Mars, Saturn and back. After each step settles, count
// the browser frames requested during two idle seconds (an idle page must request none) and take a screenshot.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2], out = new URL(`./runs/${label}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__rafCalls = 0;
  window.requestAnimationFrame = callback => { window.__rafCalls++; return raf(callback); }; });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const ready = () => page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 90_000 });
const steps = [];
const settle = async (step, ms = 4000) => {
  await page.waitForTimeout(ms);
  const before = await page.evaluate(() => window.__rafCalls); await page.waitForTimeout(2000);
  const idleFrames = await page.evaluate(() => window.__rafCalls) - before;
  steps.push({ step, url: await page.evaluate(() => location.pathname), idleFrames, framesSoFar: await page.evaluate(() => window.__rafCalls) > 0 });
  await page.screenshot({ path: `${out}${steps.length}-${step}.png` });
};
const fly = async route => { await page.evaluate(r => { const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove(); }, route); await page.waitForTimeout(1000); await ready(); };
await page.goto('http://127.0.0.1:4231/earth/'); await ready(); await settle('earth loaded');
await page.mouse.move(640, 400); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(640 + i * 12, 400 + i * 3); await page.mouse.up(); await settle('dragged');
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(120); } await settle('wheel zoomed');
await page.mouse.move(700, 420); await settle('hovered', 1500);
for (const route of ['/mars/', '/saturn/', '/earth/']) { await fly(route); await settle(`flew to ${route.replaceAll('/', '')}`, 6000); }
await browser.close();
writeFileSync(`${out}steps.json`, JSON.stringify({ steps, errors }, null, 1));
console.log(label, steps.map(s => `${s.step}: ${s.url} idle frames ${s.idleFrames}`).join(' | '), errors.length ? 'ERRORS ' + errors.join(' | ') : '');
