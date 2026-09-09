import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {OBJECTS} from '../../../../site/objects.mjs';

const origin=process.argv[2]??'http://127.0.0.1:53136',output=resolve('output/playwright/comet-shadows-default');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
try{
 for(const {id} of OBJECTS.filter(o=>o.classification==='comet')){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   const payload=await readFile(`src/planets/${id}/prepared/object.json`),definition=JSON.parse(payload).data;
   await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
   await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
   const shadows=page.locator('input[name="shadows"]');assert.equal(await shadows.isChecked(),false,`${id}: Shadows must start off`);
   await page.locator(`.${id}-body`).evaluateAll(bodies=>window.__cometDefaultNodes=bodies.flatMap(body=>[body,...body.children]));
   const lensIds=definition.controls.lenses.controls.map(l=>l.id),views=[];
   const atlas=async (lens,lit)=>{
    const suffix=`${id}-${lens}-${lit?'shadow':'surface'}@2x.webp`;
    await page.waitForFunction(({id,suffix})=>[...document.querySelectorAll(`.${id}-body > u`)].filter(n=>getComputedStyle(n).display!=='none').every(n=>getComputedStyle(n).backgroundImage.includes(suffix)),{id,suffix});
    return page.locator(`.${id}-body > u`).evaluateAll(nodes=>[...new Set(nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>getComputedStyle(n).backgroundImage))]);
   };
   for(const lens of lensIds){
    await page.locator(`button[name="lens"][value="${lens}"]`).click();
    await page.waitForFunction(lens=>document.querySelector('.planet-stage').dataset.lens===lens,lens);
    assert.equal(await shadows.isChecked(),false,`${id}/${lens}: switching dataset preserves Shadows off`);
    views.push({lens,atlases:await atlas(lens,false)});
   }
   await page.getByRole('button',{name:'Settings',exact:true}).click();
   await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');
   assert.equal(await shadows.isChecked(),true);await atlas(lensIds.at(-1),true);
   await page.getByRole('button',{name:'Settings',exact:true}).click();
   await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');
   assert.equal(await shadows.isChecked(),false);await atlas(lensIds.at(-1),false);
   const retained=await page.locator(`.${id}-body`).evaluateAll(bodies=>{const nodes=bodies.flatMap(body=>[body,...body.children]);return nodes.length===window.__cometDefaultNodes.length&&nodes.every((n,i)=>window.__cometDefaultNodes[i]===n)});assert.ok(retained);assert.deepEqual(errors,[]);
   const screenshot=resolve(output,`${id}.png`);await page.screenshot({path:screenshot});
   reports.push({id,defaultShadows:false,lenses:views,optInWorks:true,retained,preparedSha256:createHash('sha256').update(payload).digest('hex'),screenshot,errors});
  }finally{await context.close();}
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify({capturedAt:new Date().toISOString(),origin,browser:browser.version(),reports},null,2)+'\n');
 console.log(JSON.stringify({comets:reports.length,datasets:reports.reduce((s,r)=>s+r.lenses.length,0),defaultShadows:false,optInWorks:true}));
}finally{await browser.close();}
