import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {OBJECTS} from '../../site/objects.mts';
import {conformanceBrowserLaunch} from '../../site/test/conformance-browser-launch.mjs';
const ids=['aethra','lyyli','hela','kemi','taurinensis'],origin='http://127.0.0.1:4278';
const output=resolve('output/playwright/mars-crossing-population');await mkdir(output,{recursive:true});
const browser=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:output,redirectStdio:true})).options);
const navigationOnly=process.argv.includes('--navigation-only');
const expectedFaces=Object.fromEntries(await Promise.all(ids.map(async id=>[id,JSON.parse(await readFile(`src/planets/${id}/prepared/terrain.json`)).faces.length])));
for(const count of Object.values(expectedFaces))assert.ok(count>0&&count<=800);
const results=[];
try{
 for(const dpr of navigationOnly?[1]:[1,2]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors=[],loads=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/\/scenes\/(aethra|lyyli|hela|kemi|taurinensis)\//,async route=>{
   const [,,id,filename]=new URL(route.request().url()).pathname.split('/');
   const bytes=await readFile(resolve('output/mars-crossing-population/fresh-runtime',id,filename));
   loads.push({id,filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   await route.fulfill({body:bytes,contentType:filename.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  for(const id of navigationOnly?[]:ids){
   const start=loads.length;
   await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
   await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
   assert.equal(await page.locator('.planet-stage').count(),1);
   assert.equal(await page.locator('.polycss-camera').count(),1);
   assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
   assert.equal(await page.locator('input[name="orbit"]').isChecked(),false);
   const leaves=page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`);
   assert.equal(await leaves.count(),expectedFaces[id]);
   const visibleText=await page.locator('body').innerText();assert.match(visibleText,/Grid marks unavailable imagery/);
   const forbidden=await leaves.evaluateAll(nodes=>nodes.filter(n=>{const s=getComputedStyle(n);return s.clipPath!=='none'||s.maskImage!=='none'||s.filter!=='none'||/gradient\(/.test(s.backgroundImage);}).length);
   assert.equal(forbidden,0);
   await leaves.evaluateAll(nodes=>{globalThis.__marsLeaves=[...nodes]});
   const defaultPath=`${output}/${id}-dpr${dpr}.png`;await page.screenshot({path:defaultPath});
   // Main currently hides the settings action. Exercise its existing bound
   // control event for optional-lighting evidence without changing the shell.
   const setShadows=checked=>page.locator('input[name="shadows"]').evaluate((node,checked)=>{node.checked=checked;node.dispatchEvent(new Event('change',{bubbles:true}));},checked);
   await setShadows(true);await page.waitForTimeout(300);
   await page.screenshot({path:`${output}/${id}-shadows-dpr${dpr}.png`});
   await setShadows(false);
   await page.locator('button[name="lens"][value="elevation"]').click();
   await page.waitForTimeout(350);
   await page.screenshot({path:`${output}/${id}-elevation-dpr${dpr}.png`});
   assert.equal(await leaves.evaluateAll(nodes=>nodes.every((n,i)=>n===globalThis.__marsLeaves[i])),true);
   await page.locator('button[name="lens"][value="shape"]').click();
   if(id==='aethra'&&dpr===2){
    const before=await page.evaluate(()=>{const root=document.querySelector('.planet-stage');globalThis.__marsDragNodes=[root,...root.querySelectorAll('*')];return getComputedStyle(document.querySelector('.polycss-scene')).transform;});
    const requestStart=loads.length;
    await page.mouse.move(864,436);await page.mouse.down();await page.mouse.move(864,340,{steps:24});await page.mouse.up();
    await page.waitForTimeout(200);
    const after=await page.evaluate(()=>{const root=document.querySelector('.planet-stage'),nodes=[root,...root.querySelectorAll('*')];return {transform:getComputedStyle(document.querySelector('.polycss-scene')).transform,nodes:nodes.length,retained:nodes.length===globalThis.__marsDragNodes.length&&nodes.every((n,i)=>n===globalThis.__marsDragNodes[i])};});
    assert.notEqual(after.transform,before);assert.equal(after.retained,true);assert.equal(loads.length,requestStart);
    results.push({drag:{id,dpr,steps:24,retainedNodes:after.nodes,retainedIdentity:after.retained,newSceneImageRequests:loads.length-requestStart,scope:'One ordinary pointer drag in the existing browser pass; no timing or dropped-frame claim.'}});
   }
   // The supported close view uses the established wheel contract.
   await page.mouse.move(800,450);await page.mouse.wheel(0,-400);await page.waitForTimeout(500);
   await page.screenshot({path:`${output}/${id}-close-dpr${dpr}.png`});
   results.push({id,dpr,leaves:expectedFaces[id],shadowsDefault:false,orbitDefault:false,sourceLimitationVisible:true,forbiddenLeaves:forbidden,loadedFreshAssets:loads.slice(start)});
  }
  if(dpr===1){
   await page.goto(`${origin}/sun/?overview=solar-system`,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
   assert.equal(await page.locator('input[name="asteroidOrbits"]').isChecked(),false);
   const search=page.locator('.planet-sidebar-search');await search.fill('Solar System');
   await page.locator('[data-object-tab="asteroid"]').click();
   const entries=page.locator('.planet-object-results-scroll .planet-object-link:visible');
   assert.equal(await entries.count(),OBJECTS.filter(o=>o.classification==='asteroid').length);
   const listed=await entries.evaluateAll(nodes=>nodes.map(n=>n.dataset.objectId));for(const id of ids)assert.ok(listed.includes(id));
   await page.screenshot({path:`${output}/asteroid-category.png`});
   for(const id of ids){
    await search.fill(OBJECTS.find(o=>o.id===id).name);
    await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).click();
    await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.dataset.objectId===id,id);
    assert.equal(await page.locator('.planet-stage').count(),1);assert.equal(await page.locator('.polycss-camera').count(),1);
    assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
    assert.equal(await page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`).count(),expectedFaces[id]);
   }
   results.push({navigation:{asteroidCount:listed.length,listed:ids,searchAndHandoff:ids,oneCamera:true,oneScene:true}});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(navigationOnly?'docs/mars-crossing-population/navigation-final.json':'docs/mars-crossing-population/browser-validation.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),headless:true,origin,viewport:{width:1440,height:900},scope:navigationOnly?'Final integrated production category, search and handoff using the fresh scene image installation.':'Production routes; new scene images served from the independently downloaded installation. Default and close views; optional shadows through the bound control change event because main hides the settings action; shared category, search and in-page navigation.',results},null,2)+'\n');
 console.log(navigationOnly?'Integrated shared navigation checks passed':'DPR 1/2 fresh asset, default settings, native triangles and shared navigation checks passed');
}finally{await browser.close();}
