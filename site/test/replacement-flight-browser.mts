import {array,text} from '../../tools/objects/terrestrial-layers/source-records.mts';
interface ReplacementReport {browser:string;origin:string;results:Record<string,unknown>[];errors:string[];failure?:string;}
declare global {interface Window {__replacementRoot:HTMLElement;__replacementInput:HTMLElement;__replacementOrigin:number;__replacementStyles:Map<HTMLElement,string>;}}

import {required} from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
// Native replacement selection while the outgoing detail is still activating.
// Hold only the replacement's prepared bank to prove camera motion has no asset dependency.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const output = process.env.OUTPUT ?? 'output/playwright/replacement-flight';
const buildDirectory = process.env.BUILD_DIR ?? 'dist';
const pairs = array(value=>{const pair=array(text)(value);assert.equal(pair.length,2);return [pair[0],pair[1]] as const;})(process.env.PAIRS ? JSON.parse(process.env.PAIRS) : [['jupiter', 'europa'], ['pluto', 'charon'], ['saturn', 'daphnis']]);
const dprs = process.env.DPR ? [Number(process.env.DPR)] : [1, 2];
const start = '/sun/?overview=system&v=QMbBjrZTdiHH30GM5sCQv8l4wiAhrbgbkXxBQsczQAAAAD_Kd0sE6289P8zJjb7eDje_4KrSDNFvFQABAAAAAAAAAAA';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const report:ReplacementReport = { browser: browser.version(), origin, results: [], errors: [] };
async function select(page: Page, id:string) {
  await page.locator('.planet-sidebar-search').fill(id);
  await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).first().click();
}
try {
  for (const dpr of dprs) for (const [first, replacement] of pairs) {
    const page = await createTestPage(browser, { viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => report.errors.push(error.message));
    // Match the immutable emitted bank by bytes, independent of Astro's filename hash.
    const expected = await readFile(`src/objects/${replacement}/prepared/object.json`);
    const hash = createHash('sha256').update(expected).digest('hex');
    const filenames = (await readdir(resolve(buildDirectory, '_astro'))).filter(name => name.startsWith('object.') && name.endsWith('.json'));
    let bank;
    for (const name of filenames) {
      const bytes = await readFile(resolve(buildDirectory, '_astro', name));
      if (bytes.length === expected.length && createHash('sha256').update(bytes).digest('hex') === hash) { bank = name; break; }
    }
    assert.ok(bank, `The served ${replacement} bank must match preparation`);
    let release:(()=>void)|undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route(`**/${bank}`, async route => { requested = true; await held; await route.continue(); });
    try {
      await page.goto(origin + start);
      await page.waitForFunction(() => window.__cssEarth?.ready);
      await page.evaluate(() => {
        window.__replacementRoot = window.__cssearthTest.html('.prepared-universe');
        window.__replacementInput = window.__cssearthTest.html('.planet-input-surface');
        window.__replacementOrigin = performance.timeOrigin;
      });
      await select(page, first);
      await page.waitForFunction(id => window.__cssearthTest.scene().activeObjectId === id && !window.__cssearthTest.scene().ready, first);
      await select(page, replacement);
      const before = await page.evaluate(() => {
        const root = window.__replacementRoot;
        window.__replacementStyles = new Map([...root.querySelectorAll('[style]')].map(node => {const html=window.__cssearthTest.htmlElement(node);return [html,html.style.transform] as const;}));
        return { active: window.__cssearthTest.scene().activeObjectId, selected: window.__cssearthTest.scene().selectedObjectId,
          ready: window.__cssearthTest.scene().ready, scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length };
      });
      assert.equal(before.selected, replacement);
      assert.equal(before.scenes, 0, 'The replacement exercises the gap after detail retirement');
      const started = performance.now();
      await page.waitForFunction(id => performance.getEntriesByName('cssEarth:navigation:first-motion')
        .some(entry => entry instanceof PerformanceMark && window.__cssearthTest.record(entry.detail,'navigation mark').to === id), replacement, { timeout: 1200 });
      const moving = await page.evaluate(id => {
        const entries = performance.getEntriesByName('cssEarth:navigation:requested').filter(entry => entry instanceof PerformanceMark && window.__cssearthTest.record(entry.detail,'navigation mark').to === id);
        const requested = window.__cssearthTest.required(entries.at(-1),'requested mark');
        if(!(requested instanceof PerformanceMark))throw new Error('Expected request mark');
        const motion = performance.getEntriesByName('cssEarth:navigation:first-motion').find(entry => entry instanceof PerformanceMark && window.__cssearthTest.record(entry.detail,'motion mark').id === window.__cssearthTest.record(requested.detail,'requested detail').id);
        return { selected: window.__cssearthTest.scene().selectedObjectId, ready: window.__cssearthTest.scene().ready,
          scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length,
          changedTransforms: [...window.__replacementStyles].filter(([node, transform]) => node.style.transform !== transform).length,
          firstMotionMs: window.__cssearthTest.required(motion,"first motion mark").startTime - requested.startTime };
      }, replacement);
      assert.equal(moving.ready, false);
      assert.equal(moving.scenes, 0);
      assert.ok(moving.changedTransforms > 0, 'The retained universe actually changes while detail bytes remain blocked');
      assert.ok(requested, 'The destination bank request was held');
      required(release)();
      await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id, replacement, { timeout: 40000 });
      const after = await page.evaluate(() => ({ error: window.__cssearthTest.scene().error,
        scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length,
        retained: window.__replacementRoot === window.__cssearthTest.html('.prepared-universe') &&
          window.__replacementInput === window.__cssearthTest.html('.planet-input-surface') && window.__replacementOrigin === performance.timeOrigin }));
      assert.equal(after.error, null); assert.equal(after.scenes, 1); assert.equal(after.retained, true);
      report.results.push({ first, replacement, dpr, bankSha256: hash, before, moving, after, elapsedMs: performance.now() - started });
      console.log(`REPLACEMENT PASS ${first} → ${replacement} DPR ${dpr}: ${moving.firstMotionMs.toFixed(1)} ms before bank release`);
    } finally { required(release)(); await page.close(); }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); throw error; }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
