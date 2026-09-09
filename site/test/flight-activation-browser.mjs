import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../objects.mjs';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const targetId = process.argv[3] ?? 'makemake';
assert.ok(OBJECTS.some(object => object.id === targetId), 'Flight target must come from OBJECTS');
const replacementId = targetId === 'mars' ? 'mercury' : 'mars';
const output = `output/playwright/flight-activation-${targetId}-dpr-${process.env.DPR ?? 1}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {channel:'chrome'})});
const start = `${origin}/sun/?overview=solar-system&v=QMbBjrZTdiHH30GM5sCQv8l4wiAhrbgbkXxBQsczQAAAAD_Kd0sE6289P8zJjb7eDje_4KrSDNFvFQABAAAAAAAAAAA`;
const results=[], errors=[];
const sample = () => ({active:window.__cssEarth.activeObjectId, ready:window.__cssEarth.ready, error:window.__cssEarth.error,
  scenes:document.querySelectorAll('.planet-stage > .polycss-camera').length,
  groups:[...document.querySelectorAll(window.__activationSelector)].map(n=>n.style.display),
  overlaysSuppressed:[...document.querySelectorAll("[data-context-label], [data-context-indicator], .context-orbit")].every(node=>node.style.opacity==="0"),
  marker:document.querySelector(`[data-context-body="${window.__activationTarget}"]`)?.style.transform});
const select = (page,id) => page.evaluate(id=>document.querySelector(`.planet-object-link[data-object-id="${id}"]`).click(),id);
try {
  for(const scenario of (process.env.SCENARIO ? [process.env.SCENARIO] : process.env.ARRIVAL_ONLY ? ['arrival'] : ['arrival','escape','supersede','reduced-motion'])) {
    const page=await browser.newPage({viewport:{width:1995,height:1236},deviceScaleFactor:Number(process.env.DPR ?? 1),reducedMotion:scenario==='reduced-motion'?'reduce':'no-preference'});
    page.on('pageerror',e=>errors.push({scenario,error:e.message}));
    await page.goto(start); await page.waitForFunction(()=>window.__cssEarth?.ready);
    await page.evaluate(({targetId})=>{ window.__activationTarget=targetId; window.__activationSelector=`.planet-stage[data-object-id="${targetId}"] > .polycss-camera :not(:has(*))`; window.__activationSamples=[]; const sample=()=>{
      const groups=[...document.querySelectorAll(window.__activationSelector)];
      if(groups.length) window.__activationSamples.push({count:groups.filter(n=>n.style.display!=='none').length,ready:window.__cssEarth.ready});
      window.__activationFrame=requestAnimationFrame(sample);
    };window.__activationFrame=requestAnimationFrame(sample);},{targetId});
    await select(page,targetId);
    let before;
    if(scenario!=='reduced-motion') {
      await page.waitForFunction(()=>{const ns=[...document.querySelectorAll(window.__activationSelector)];const n=ns.filter(x=>x.style.display!=='none').length;return n>2&&n<ns.length;});
      before=await page.evaluate(sample);
      assert.equal(before.overlaysSuppressed,true,"Navigation overlays fade away during flight");
      if(scenario==='escape') { await page.locator('.planet-input-surface').focus(); await page.keyboard.press('Escape'); }
      else if(scenario==='supersede') await select(page,replacementId);
    }
    await page.waitForFunction(()=>window.__cssEarth.error || window.__cssEarth.ready,{}, {timeout:30000});
    // Cancellation in a coarse view can trigger the existing overview handoff.
    await page.waitForTimeout(400);
    await page.waitForFunction(()=>window.__cssEarth.error || window.__cssEarth.ready,{}, {timeout:30000});
    const after=await page.evaluate(sample);
    if (!after.ready || after.error) results.push({scenario,before,after});
    assert.equal(after.error,null,`${scenario}: input must not dispose a bank in use`);
    assert.equal(after.scenes,1); assert.equal(after.ready,true);
    assert.equal(after.overlaysSuppressed,false,"Navigation overlays restore after arrival or interruption");
    const samples=await page.evaluate(()=>{cancelAnimationFrame(window.__activationFrame);return window.__activationSamples;});
    if(scenario==='supersede') assert.equal(after.active,replacementId);
    if(scenario==='reduced-motion') { assert.equal(after.active,targetId);assert.ok(samples.every(s=>s.count===samples.at(-1).count),'Direct arrivals must never show a partial surface'); }
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
