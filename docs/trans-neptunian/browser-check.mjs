import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {OBJECTS} from '../../site/objects.mts';
import {conformanceBrowserLaunch} from '../../site/test/conformance-browser-launch.mjs';
const ids=['arrokoth','quaoar','gkunhomdima'],origin='http://127.0.0.1:4278';
const output=resolve('output/playwright/trans-neptunian');await mkdir(output,{recursive:true});
const browser=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:output,redirectStdio:true})).options);
const navigationOnly=process.argv.includes('--navigation-only'),defaultsOnly=process.argv.includes('--defaults-only');
const results=[];
try{
 for(const dpr of (navigationOnly||defaultsOnly)?[1]:[1,2]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors=[],loads=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('Browser console:',m.text());}});
  await page.route(/\/scenes\/(arrokoth|quaoar|gkunhomdima)\//,async route=>{
   const [,,id,filename]=new URL(route.request().url()).pathname.split('/');
   const bytes=await readFile(resolve('output/trans-neptunian/fresh-runtime',id,filename));
   loads.push({id,filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   await route.fulfill({body:bytes,contentType:filename.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  for(const id of navigationOnly?[]:ids){
   const start=loads.length,faceCount=id==='arrokoth'?1000:480;
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
   const ringCount=await page.locator('.prepared-annular-ring').count();
   assert.equal(ringCount,id==='quaoar'?20:0);
   if(id==='quaoar') {
    assert.ok(loads.slice(start).some(load=>load.filename==='quaoar-rings.webp'),'Ring uses the freshly installed source-pinned asset');
    const rings=await page.locator('.prepared-annular-ring').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {width:parseFloat(s.width),height:parseFloat(s.height),transform:s.transform,background:s.backgroundImage,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
    assert.ok(rings.every(r=>r.width>0&&r.height>0&&r.transform!=='none'&&r.background.includes('quaoar-rings.webp')));
    assert.ok(rings.some(r=>r.rect.width>10&&r.rect.height>10),'Rings have a projected area in the default view');
   }
   const defaultPath=`${output}/${id}-dpr${dpr}.png`;await page.screenshot({path:defaultPath});console.log("Captured",defaultPath);
   if(defaultsOnly){results.push({id,dpr,leaves:faceCount,ringTiles:ringCount,shadowsDefault:false,orbitDefault:false,screenshot:defaultPath,loadedFreshAssets:loads.slice(start)});continue;}
   if(id==='arrokoth'){
    await page.evaluate(()=>{window.__tnoRetained=[...document.querySelectorAll('.arrokoth-body > u')];});
    await page.locator('button[name="lens"][value="albedo"]').click();
    await page.waitForFunction(()=>document.querySelector('button[name="lens"][value="albedo"]')?.getAttribute('aria-pressed')==='true');
    await page.waitForLoadState('networkidle');
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.arrokoth-body > u')].every((node,i)=>node===window.__tnoRetained[i])),true);
    await page.screenshot({path:`${output}/${id}-albedo-dpr${dpr}.png`});
   }
   results.push({id,dpr,leaves:faceCount,shadowsDefault:false,orbitDefault:false,ringTiles:ringCount,ringPicking:"No separate ring surface-picking contract; body hit triangles only.",forbiddenLeaves:forbidden,loadedFreshAssets:loads.slice(start)});
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
   const listed=await entries.evaluateAll(nodes=>nodes.map(n=>n.dataset.objectId));for(const id of ids)assert.ok(listed.includes(id));
   await page.screenshot({path:`${output}/trans-neptunian-category.png`});
   for(const id of ids){
    await search.fill(OBJECTS.find(o=>o.id===id).name);
    await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).click();
    await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
    assert.equal(await page.locator('.planet-stage').count(),1);assert.equal(await page.locator('.polycss-camera').count(),1);
    assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
    assert.equal(await page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`).count(),id==='arrokoth'?1000:480);
   }
   results.push({navigation:{transNeptunianCount:listed.length,listed:ids,searchAndHandoff:ids,oneCamera:true,oneScene:true}});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(defaultsOnly?'docs/trans-neptunian/default-views.json':navigationOnly?'docs/trans-neptunian/navigation-final.json':'docs/trans-neptunian/browser-validation.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),headless:true,origin,viewport:{width:1440,height:900},scope:defaultsOnly?'Actual production default views using fresh-installed scene images.':navigationOnly?'Final integrated production category, search and handoff using the fresh scene image installation.':'Production routes; new scene images served from the independently downloaded installation. True default views and Arrokoth albedo selection; retained native triangles; shared category, search and in-page navigation.',results},null,2)+'\n');
 console.log(defaultsOnly?'DPR1 actual default views captured':navigationOnly?'Integrated shared navigation checks passed':'DPR 1/2 fresh asset, default settings, native triangles and shared navigation checks passed');
}finally{await browser.close();}
