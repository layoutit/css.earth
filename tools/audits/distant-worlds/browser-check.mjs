import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {OBJECTS} from '../../../site/objects.mts';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mjs';
const ids=['oumuamua','sedna','gonggong','orcus','salacia','varuna','varda','mani','achlys'],origin='http://127.0.0.1:4278';
const output=resolve('output/playwright/distant-worlds');await mkdir(output,{recursive:true});
const browser=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:output,redirectStdio:true})).options);
const navigationOnly=process.argv.includes('--navigation-only'),defaultsOnly=process.argv.includes('--defaults-only');
const results=[];
try{
 for(const dpr of (navigationOnly||defaultsOnly)?[1]:[1,2]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors=[],loads=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('Browser console:',m.text());}});
  await page.route(/\/scenes\/(oumuamua|sedna|gonggong|orcus|salacia|varuna|varda|mani|achlys)\//,async route=>{
   const [,,id,filename]=new URL(route.request().url()).pathname.split('/');
   const bytes=await readFile(resolve('output/distant-worlds/fresh-runtime',id,filename));
   loads.push({id,filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   await route.fulfill({body:bytes,contentType:filename.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  for(const id of navigationOnly?[]:ids){
   const start=loads.length,faceCount=480;
   await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
   await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
   assert.equal(await page.locator('.planet-stage').count(),1);
   assert.equal(await page.locator('.polycss-camera').count(),1);
   assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
   assert.equal(await page.locator('input[name="orbit"]').isChecked(),false);
   const leaves=page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`);
   assert.equal(await leaves.count(),faceCount);

   const forbidden=await leaves.evaluateAll(nodes=>nodes.filter(n=>{const s=getComputedStyle(n);return s.clipPath!=='none'||s.maskImage!=='none'||s.filter!=='none'||/gradient\(/.test(s.backgroundImage);}).length);
   assert.equal(forbidden,0);
   const defaultPath=`${output}/${id}-dpr${dpr}.png`;await page.screenshot({path:defaultPath});console.log("Captured",defaultPath);
   if(defaultsOnly){results.push({id,dpr,leaves:faceCount,shadowsDefault:false,orbitDefault:false,screenshot:defaultPath,loadedFreshAssets:loads.slice(start)});continue;}
   await page.evaluate(id=>{window.__distantRetained=[...document.querySelectorAll(`.${id}-body > u`)];},id);
   await page.mouse.move(800,450); await page.mouse.down();
   for(let step=1;step<=20;step++) await page.mouse.move(800+step*6,450+step*2);
   await page.mouse.up();
   assert.equal(await page.evaluate(id=>[...document.querySelectorAll(`.${id}-body > u`)].every((node,i)=>node===window.__distantRetained[i]),id),true);
   if(['oumuamua','varuna'].includes(id)) await page.screenshot({path:`${output}/${id}-rotated-dpr${dpr}.png`});
   results.push({id,dpr,leaves:faceCount,shadowsDefault:false,orbitDefault:false,forbiddenLeaves:forbidden,loadedFreshAssets:loads.slice(start)});
  }
  if(dpr===1&&!defaultsOnly){
   await page.goto(`${origin}/sun/?overview=solar-system`,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
   assert.equal(await page.locator('input[name="asteroidOrbits"]').isChecked(),false);
   const search=page.locator('.planet-sidebar-search');await search.fill('Solar System');
   await page.locator('[data-object-tab="trans-neptunian"]').click();
   assert.equal(await page.locator('[data-solar-system-results]').evaluate(node=>node.scrollLeft),0,
    'Category overflow must scroll the tab row, not the whole card.');
   const entries=page.locator('.planet-object-results-scroll .planet-object-link:visible');
   assert.equal(await entries.count(),OBJECTS.filter(o=>o.classification==='trans-neptunian').length);
   const listed=await entries.evaluateAll(nodes=>nodes.map(n=>n.dataset.objectId));for(const id of ids.filter(id=>id!=='oumuamua'))assert.ok(listed.includes(id));
   await page.locator('[data-object-tab="interstellar"]').click();
   assert.deepEqual(await entries.evaluateAll(nodes=>nodes.map(n=>n.dataset.objectId)),['oumuamua']);
   await page.screenshot({path:`${output}/trans-neptunian-category.png`});
   for(const id of ids){
    await search.fill(OBJECTS.find(o=>o.id===id).name);
    await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).click();
    await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
    assert.equal(await page.locator('.planet-stage').count(),1);assert.equal(await page.locator('.polycss-camera').count(),1);
    assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
    assert.equal(await page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`).count(),480);
   }
   results.push({navigation:{transNeptunianCount:listed.length,listed:ids,searchAndHandoff:ids,oneCamera:true,oneScene:true}});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(defaultsOnly?'output/distant-worlds/default-views.json':navigationOnly?'output/distant-worlds/navigation-final.json':'output/distant-worlds/browser-validation.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),headless:true,origin,viewport:{width:1440,height:900},scope:defaultsOnly?'Actual production default views using fresh-installed scene images.':navigationOnly?'Final integrated production category, search and handoff using the fresh scene image installation.':'Production routes; new scene images served from the independently downloaded installation. True default views and retained-node drag; retained native triangles; shared category, search and in-page navigation.',results},null,2)+'\n');
 console.log(defaultsOnly?'DPR1 actual default views captured':navigationOnly?'Integrated shared navigation checks passed':'DPR 1/2 fresh asset, default settings, native triangles and shared navigation checks passed');
}finally{await browser.close();}
