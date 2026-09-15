import { createTestPage } from './browser-observations.mts';
import { required } from '../../tools/test-values.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { SCENE_OBJECTS } from '../objects.mts';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const targetId = process.argv[3] ?? 'makemake';
assert.ok(SCENE_OBJECTS.some(object => object.id === targetId), 'Flight target must come from SCENE_OBJECTS');
const replacementId = targetId === 'mars' ? 'mercury' : 'mars';
const output = `output/playwright/flight-activation-${targetId}-dpr-${process.env.DPR ?? 1}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {channel:'chrome'})});
const start = `${origin}/sun/?overview=solar-system&v=QMbBjrZTdiHH30GM5sCQv8l4wiAhrbgbkXxBQsczQAAAAD_Kd0sE6289P8zJjb7eDje_4KrSDNFvFQABAAAAAAAAAAA`;
type ActivationSample = {count:number;ready:boolean};
declare global { interface Window {
  __activationTarget:string; __activationSelector:string; __activationSamples:ActivationSample[]; __activationFrame:number;
} }
const results=[], errors:{scenario:string;error:string}[]=[];
const sample = () => ({active:window.__cssearthTest.scene().activeObjectId, ready:window.__cssearthTest.scene().ready, error:window.__cssearthTest.scene().error,
  scenes:document.querySelectorAll('.planet-stage > .polycss-camera').length,
  groups:[...document.querySelectorAll(window.__activationSelector)].map(n=>window.__cssearthTest.htmlElement(n).style.display),
  flightCaption:(()=>{const node=document.querySelector<HTMLElement>('[data-context-flight-label]');return node ? {
    id:node.dataset.contextFlightLabel,visible:getComputedStyle(node).visibility!=='hidden'&&Number(getComputedStyle(node).opacity)>0 } : null;})(),
  marker:document.querySelector<HTMLElement>(`[data-context-body="${window.__activationTarget}"]`)?.style.transform});
const select = (page: Page,id:string) => page.evaluate(id=>window.__cssearthTest.htmlElement(document.querySelector(`.planet-object-link[data-object-id="${id}"]`)).click(),id);
try {
  for(const scenario of (process.env.SCENARIO ? [process.env.SCENARIO] : process.env.ARRIVAL_ONLY ? ['arrival'] : ['arrival','escape','supersede','reduced-motion'])) {
    const page=await createTestPage(browser, {viewport:{width:1995,height:1236},deviceScaleFactor:Number(process.env.DPR ?? 1),reducedMotion:scenario==='reduced-motion'?'reduce':'no-preference'});
    page.on('pageerror',e=>errors.push({scenario,error:e.message}));
    await page.goto(start); await page.waitForFunction(()=>window.__cssEarth?.ready);
    await page.evaluate(({targetId})=>{ window.__activationTarget=targetId; window.__activationSelector=`.planet-stage[data-object-id="${targetId}"] > .polycss-camera :not(:has(*))`; window.__activationSamples=[]; const sample=()=>{
      const groups=[...document.querySelectorAll(window.__activationSelector)];
      if(groups.length) window.__activationSamples.push({count:groups.filter(n=>window.__cssearthTest.htmlElement(n).style.display!=='none').length,ready:window.__cssearthTest.scene().ready});
      window.__activationFrame=requestAnimationFrame(sample);
    };window.__activationFrame=requestAnimationFrame(sample);},{targetId});
    await select(page,targetId);
    let before;
    if(scenario!=='reduced-motion') {
      await page.waitForFunction(()=>{const ns=[...document.querySelectorAll(window.__activationSelector)];const n=ns.filter(x=>window.__cssearthTest.htmlElement(x).style.display!=='none').length;return n>2&&n<ns.length;});
      before=await page.evaluate(sample);
      assert.equal(before.flightCaption?.id,targetId,'Flight caption follows the destination');
      assert.equal(before.flightCaption.visible,true,'Destination stays named while its detail activates');
      if(scenario==='escape') { await page.locator('.planet-input-surface').focus(); await page.keyboard.press('Escape'); }
      else if(scenario==='supersede') await select(page,replacementId);
    }
    await page.waitForFunction(()=>window.__cssearthTest.scene().error || window.__cssearthTest.scene().ready,{}, {timeout:30000});
    // Cancellation in a coarse view can trigger the existing overview handoff.
    await page.waitForTimeout(400);
    await page.waitForFunction(()=>window.__cssearthTest.scene().error || window.__cssearthTest.scene().ready,{}, {timeout:30000});
    const after=await page.evaluate(sample);
    if (!after.ready || after.error) results.push({scenario,before,after});
    assert.equal(after.error,null,`${scenario}: input must not dispose a bank in use`);
    assert.equal(after.scenes,1); assert.equal(after.ready,true);
    assert.equal(after.flightCaption?.visible,false,'Flight caption retires on arrival or interruption');
    const samples=await page.evaluate(()=>{cancelAnimationFrame(window.__activationFrame);return window.__activationSamples;});
    if(scenario==='supersede') assert.equal(after.active,replacementId);
    if(scenario==='reduced-motion') { assert.equal(after.active,targetId);assert.ok(samples.every(s=>s.count===required(samples.at(-1)).count),'Direct arrivals must never show a partial surface'); }
    if(scenario==='escape') {
      await page.waitForTimeout(500);const stopped=await page.evaluate(sample);
      assert.equal(stopped.marker,after.marker,'Interrupted flight must remain at the drawn pose');
    }
    await page.screenshot({path:`${output}/${scenario}.png`});
    results.push({scenario,before,after,samples});await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({results,errors},null,2));}
console.log(`FLIGHT ACTIVATION PASS: ${results.length} cases`);
