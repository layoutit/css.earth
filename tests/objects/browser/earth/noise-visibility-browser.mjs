import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PNG} from 'pngjs';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';

// Saved from the ordinary UI visit after three zoom gestures and a river drag.
// This is a visual regression, separate from uninterrupted interaction footage.
const view = '/earth/?v=MEJAuOxzZUo0hD-Vl1tBkQyav9Kr2uiBB2g_rvfPaM6iRQACAAAAAAAAAAAAAAAAAAAAAA#place=3435910&lens=buenos-aires-noise';
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const output=resolve(option('output',`output/playwright/noise-visibility-${Date.now()}`));
await mkdir(output,{recursive:true});
const fixture=await serveBuiltFixture(option('built','dist'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});
const report={scope:'Actual prepared noise versus its composite at the same saved camera; no geometry or image edits.',browser:browser.version(),runs:[]};

// Blue/violet road interiors are unmistakable over this visible-color map.
// Use interior samples from the actual isolated overlay, not assumed DOM state.
// A hue test tolerates the published overlay alpha and scene illumination.
function visibleRoads(composite,isolated,dpr){
  const a=PNG.sync.read(composite),b=PNG.sync.read(isolated);
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let samples=0,visible=0;
  for(let y=60*dpr;y<b.height-40*dpr;y++)for(let x=370*dpr;x<b.width-1;x++){
    const i=(y*b.width+x)*4,[r,g,blue]=b.data.subarray(i,i+3);
    if(blue<80||blue<g*2||blue<r*1.05)continue;
    if(![-4,4,-4*b.width,4*b.width].every(offset=>[0,1,2].every(k=>Math.abs(b.data[i+k]-b.data[i+k+offset])<=3)))continue;
    samples++;
    const [cr,cg,cb]=a.data.subarray(i,i+3);
    if(cb>cg*1.4&&cb>cr*.95&&cb>50)visible++;
  }
  assert.ok(samples>=100,`The isolated overlay must supply enough interior samples, got ${samples}`);
  return {samples,visible,fraction:visible/samples};
}

try{
  for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr});
    const page=await context.newPage(),pending=new Set(),run={dpr,errors:[]};report.runs.push(run);
    page.on('request',r=>pending.add(r));page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>pending.delete(r));
    page.on('pageerror',e=>run.errors.push(e.message));
    try{
      await page.goto(new URL(option('view',view),fixture.url).href,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&
        document.querySelector('button[name="lens"][value="buenos-aires-noise"]')?.ariaPressed==='true');
      await page.waitForTimeout(12000);
      let quiet=0;for(let i=0;i<50&&quiet<4;i++){await page.waitForTimeout(500);quiet=pending.size===0?quiet+1:0}
      assert.equal(pending.size,0,'The visual comparison requires settled source bytes');
      const read=()=>page.evaluate(()=>({url:location.href,transform:document.querySelector('.polycss-scene').style.transform,
        scenes:document.querySelectorAll('.polycss-scene').length,pages:[...document.querySelectorAll('[data-city-page]')].map(e=>({
          key:e.dataset.cityPage,css:e.style.cssText,child:e.firstElementChild?.style.cssText,box:e.getBoundingClientRect().toJSON()}))}));
      run.before=await read();assert.equal(run.before.scenes,1);
      assert.equal(run.before.pages.filter(p=>p.key.startsWith('noise-')&&p.css.includes('visibility: visible')).length,16);
      const composite=await page.screenshot({path:resolve(output,`dpr${dpr}-composite.png`)});
      // Explicitly visible raster descendants do not inherit a hidden parent.
      // Preserve each visibility property independently; never round-trip transforms.
      await page.evaluate(()=>{
        window.__noiseVisibilityRestore=[...document.querySelectorAll('[data-city-page],[data-city-page] *,.earth-surface-leaf,.earth-polar-surface')]
          .map(e=>({e,visibility:e.style.visibility}));
        for(const {e} of window.__noiseVisibilityRestore)if(!e.closest('[data-city-page]')?.dataset.cityPage.startsWith('noise-'))e.style.visibility='hidden';
      });
      let isolated;
      try{await page.waitForTimeout(300);isolated=await page.screenshot({path:resolve(output,`dpr${dpr}-noise-only.png`)})}
      finally{await page.evaluate(()=>{for(const {e,visibility} of window.__noiseVisibilityRestore)e.style.visibility=visibility;delete window.__noiseVisibilityRestore})}
      await page.waitForTimeout(300);run.restored=await read();
      assert.deepEqual(run.restored,run.before,'Same exact pages, texture styles, bounds and camera after isolation');
      run.coverage=visibleRoads(composite,isolated,dpr);
      assert.ok(run.coverage.fraction>=.95,`Noise is obscured: ${run.coverage.visible}/${run.coverage.samples} road samples remain visible`);
      assert.deepEqual(run.errors,[]);run.passed=true;console.log(JSON.stringify({dpr,...run.coverage}));
    }finally{await context.close()}
  }
  report.passed=true;
}catch(error){report.error=String(error);report.passed=false;process.exitCode=1}
finally{await browser.close();await fixture.close();report.scripts=fixture.requests.filter(r=>r.sha256);report.closed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2))}
