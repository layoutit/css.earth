interface ClickCard {selected:string|null;active:string|null;title:string|null|undefined;introduction:string|null|undefined;facts:number;datasets:number;minimap:boolean;hidden:boolean;}
declare global {interface Window {__originalCard:ChildNode[];__selectedCard:ChildNode[];__cardSwaps:number;__cardObserver:MutationObserver;__clickCard:ClickCard;}}

import { required } from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../objects.mts';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/navigation-selection';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors:string[] = [];
async function requireHeldRequest(observed:Promise<void>) {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    await Promise.race([observed, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('The hash-addressed scene request was not intercepted.')), 10000);
    })]);
  } finally { clearTimeout(timer); }
}
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
    const page = await createTestPage(context);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/sun/`);
    await page.waitForFunction(() => window.__cssEarth?.ready);
    assert.equal(await page.locator('template[data-object-card]').count(), OBJECTS.length);
    let ceresHits=0;
    let sawCeres:(()=>void)|undefined,release:(()=>void)|undefined;
    const ceresRequested=new Promise<void>(resolve=>{sawCeres=resolve;});
    const hold=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/objects/ceres/*.json', async route => { ceresHits++; required(sawCeres)(); await hold; await route.continue(); });
    await page.locator('.planet-sidebar-search').fill('Ceres');
    await page.evaluate(() => {
      const panel = window.__cssearthTest.html('.planet-information-panel');
      window.__originalCard = [...panel.childNodes];
      window.__cardSwaps = 0;
      window.__cardObserver = new MutationObserver(records => { window.__cardSwaps += records.filter(record => record.target === panel).length; });
      window.__cardObserver.observe(panel, { childList: true });
      document.addEventListener('click', () => {
        window.__clickCard = {
          selected: window.__cssearthTest.scene().selectedObjectId, active: window.__cssearthTest.scene().activeObjectId,
          title: panel.querySelector('.planet-title')?.getAttribute('aria-label'),
          introduction: panel.querySelector('.planet-introduction')?.textContent,
          facts: panel.querySelectorAll('.planet-fact-value').length,
          datasets: panel.querySelectorAll('button[name="lens"]').length,
          minimap: Boolean(panel.querySelector('.planet-surface-minimap')),
          hidden: window.__cssearthTest.htmlElement(panel).hidden,
        };
        window.__selectedCard = [...panel.childNodes];
      }, { once: true });
    });
    await page.locator('.planet-object-link[data-object-id="ceres"]').click();
    const immediate = await page.evaluate(() => window.__clickCard);
    assert.equal(immediate.selected, 'ceres'); assert.equal(immediate.active, 'sun');
    assert.equal(immediate.title, 'Ceres'); assert.ok(required(immediate.introduction).length > 20);
    assert.ok(immediate.facts > 0); assert.ok(immediate.datasets > 0); assert.equal(immediate.minimap, true); assert.equal(immediate.hidden, false);
    assert.equal(await page.evaluate(() => window.__cardSwaps), 1, 'One complete card swap in the click event');
    await page.screenshot({ path: `${output}/immediate-dpr-${dpr}.png` });
    await page.waitForFunction(() => window.__cssEarth?.selectedObjectId === 'ceres');
    await requireHeldRequest(ceresRequested);
    assert.equal(ceresHits, 1, 'The hash-addressed scene request is actually held');
    assert.equal(await page.evaluate(() => window.__cssearthTest.scene().activeObjectId), 'sun');
    required(release)();
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === 'ceres');
    assert.equal(await page.evaluate(() => window.__cardSwaps), 1, 'Mount does not replace or flash the selected card');
    assert.equal(await page.evaluate(() => [...window.__cssearthTest.html('.planet-information-panel').childNodes].every((node, i) => node === window.__selectedCard[i])), true);
    assert.equal(await page.locator('.planet-information-panel').evaluate(node => window.__cssearthTest.htmlElement(node).inert), false);
    assert.equal(await page.locator('.planet-stage').count(), 1);
    assert.equal(await page.evaluate(() => window.__cssearthTest.scene().mountedObjectCount), 1);
    // Interrupted navigation restores the retained source card, not a stale destination.
    let venusHits=0;
    let sawVenus:(()=>void)|undefined,releaseVenus:(()=>void)|undefined;
    const venusRequested=new Promise<void>(resolve=>{sawVenus=resolve;});
    const holdVenus=new Promise<void>(resolve=>{releaseVenus=resolve;});
    await page.route('**/objects/venus/*.json', async route => { venusHits++; required(sawVenus)(); await holdVenus; await route.continue(); });
    await page.locator('.planet-sidebar-search').fill('Venus');
    await page.locator('.planet-object-link[data-object-id="venus"]').click();
    assert.equal(await page.locator('.planet-information-panel .planet-title').first().getAttribute('aria-label'), 'Venus');
    await requireHeldRequest(venusRequested);
    assert.equal(venusHits, 1, 'Interrupted navigation also holds the actual scene request');
    await page.mouse.move(900, 450); await page.mouse.wheel(0, 40);
    await page.waitForFunction(() => window.__cssearthTest.scene().ready && window.__cssearthTest.scene().selectedObjectId === 'ceres');
    assert.equal(await page.locator('.planet-information-panel .planet-title').first().getAttribute('aria-label'), 'Ceres');
    assert.equal(await page.evaluate(() => [...window.__cssearthTest.html('.planet-information-panel').childNodes].every((node, i) => node === window.__selectedCard[i])), true);
    required(releaseVenus)();
    results.push({ dpr, immediate, cardSwaps: 1 });
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ results, errors }));
