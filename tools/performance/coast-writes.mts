// `node tools/performance/coast-writes.mts [--url <page>]… [--json <file>]`: fling the camera in headless Chrome and list
// every DOM write the whole page makes while it coasts on inertia, the motion the runtime contract gates
// (docs/performance/motion-freezes-membership.md). Only `transform` and `opacity` may change then, plus the documented
// paint exceptions; anything else is printed and the command exits 1.
//
// The page is served separately (the production build: `node tools/cli/preview.mts`, or the dev server). The fling is a
// real mouse drag through the page's own input code; writes come from the same MutationObserver as `ios-capture
// --style-writes`, so a take on the iPad and this check count the same things.
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { STYLE_WRITES_LOGGER } from './ios-capture.mts';

/** Writes the contract allows while coasting, besides transform and opacity (the exceptions table of the doc). */
const ALLOWED = [
  / \{ (transform|opacity) \}$/u,
  / \[points\]$/u, / \{ stroke-opacity \}$/u, / <\+polyline>$/u, // orbit strokes
  / \{ box-shadow \}$/u, // batched star points
  /object-minimap-viewport .*\{ (left|top|width|height|background-size|background-position) \}$/u, // live minimap boxes
  /^div\.object-input-surface \{ cursor \}$/u, // the release itself sets the grab cursor, once
];

interface Entry { key: string; count: number; moving: number; coasting: number; value: string }
export function offPath(entries: readonly Entry[]) {
  return entries.filter(entry => entry.coasting > 0 && !ALLOWED.some(pattern => pattern.test(entry.key))).sort((a, b) => b.coasting - a.coasting);
}

const { values } = parseArgs({ options: { url: { type: 'string', multiple: true }, json: { type: 'string' },
  width: { type: 'string', default: '820' }, height: { type: 'string', default: '1094' } } });
const urls = values.url ?? ['http://127.0.0.1:4211/'];
const browser = await chromium.launch({ headless: true });
let failures = 0;
const report: Record<string, unknown> = {};
try {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: Number(values.width), height: Number(values.height) }, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('ready') || Boolean((window as unknown as { __cssEarth?: { ready?: boolean } }).__cssEarth?.ready),
      undefined, { timeout: 120_000 });
    // Let startup's own fades and loads finish before measuring motion.
    await page.waitForTimeout(3000);
    await page.evaluate(STYLE_WRITES_LOGGER);
    const surface = await page.locator('.object-input-surface').boundingBox();
    if (!surface) throw new Error(`${url}: no .object-input-surface to fling.`);
    const coastEnded = page.evaluate(() => new Promise<boolean>(done => {
      let coasted = false;
      document.addEventListener('objectmotionchange', event => {
        const detail = (event as CustomEvent<{ active: boolean; coasting: boolean }>).detail;
        if (detail.coasting) coasted = true;
        if (!detail.active) done(coasted);
      }, { capture: true });
      setTimeout(() => done(coasted), 20_000);
    }));
    // A sideways flick: accelerating steps released while moving (constant steps do not throw, by design).
    const x = surface.x + surface.width / 2, y = surface.y + surface.height / 2;
    let at = x - 120;
    await page.mouse.move(at, y);
    await page.mouse.down();
    for (const step of [4, 8, 14, 22, 32, 44, 58]) { at += step; await page.mouse.move(at, y); await page.waitForTimeout(16); }
    await page.mouse.up();
    const coasted = await coastEnded;
    const writes = await page.evaluate(() => (window as unknown as { __captureStyles: { stop(): { entries: Entry[] } } }).__captureStyles.stop());
    const off = offPath(writes.entries);
    const coastWrites = writes.entries.reduce((sum, entry) => sum + entry.coasting, 0);
    console.log(`${url}: ${coasted ? 'coasted' : 'NO COAST (the flick did not throw)'}; ${coastWrites} writes while coasting, ${off.length} kinds off the fast path`);
    for (const entry of off.slice(0, 30)) console.log(`  ${String(entry.coasting).padStart(5)}x ${entry.key.slice(-110)}  = ${entry.value.slice(0, 40)}`);
    if (!coasted || off.length) failures++;
    report[url] = { coasted, coastWrites, offPath: off };
    await page.close();
  }
} finally { await browser.close(); }
if (values.json) await writeFile(values.json, JSON.stringify(report, null, 2) + '\n');
process.exit(failures ? 1 : 0);
