import { sha256 } from '../../../src/platform/sha256.mts';
import { bodies, ids, reportDirectory, captureDirectory, runtimeDirectory } from './selection.mts';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {SCENE_OBJECTS} from '../../../site/objects.mts';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mts';
declare global { interface Window { __distantRetained?: Element[];  } }
interface AssetLoad { id: string; filename: string; bytes: number; sha256: string; }
interface BrowserResult { [key: string]: unknown; id?: string; dpr?: number; leaves?: number; shadowsDefault?: boolean; orbitDefault?: boolean; loadedFreshAssets?: AssetLoad[]; optInControls?: {shadows: boolean; bodyPixelsChanged: boolean; orbit: boolean}; }
function requiredObject(id: string): (typeof SCENE_OBJECTS)[number] { const object=SCENE_OBJECTS.find(candidate=>candidate.id===id); if(!object) throw new Error(`Unknown object ${id}.`); return object; }
const origin='http://127.0.0.1:4278';
const build=process.env.CSSEARTH_AUDIT_BUILD ?? 'production';
assert.ok(['production','development'].includes(build));
const output=captureDirectory;await mkdir(output,{recursive:true});
const codeRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:output,redirectStdio:true})).options);
const navigationOnly=process.argv.includes('--navigation-only'),defaultsOnly=process.argv.includes('--defaults-only');
const results: BrowserResult[]=[];
try{
 for(const dpr of (navigationOnly||defaultsOnly)?[1]:[1,2]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors: string[]=[],loads: AssetLoad[]=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('Browser console:',m.text());}});
  await page.route(new RegExp('/scenes/('+ids.join('|')+')/'),async route=>{
   const [,,id,filename]=new URL(route.request().url()).pathname.split('/');
   const bytes=await readFile(resolve(runtimeDirectory,id,filename));
   loads.push({id,filename,bytes:bytes.length,sha256:sha256(bytes)});
   await route.fulfill({body:bytes,contentType:filename.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  for(const id of navigationOnly?[]:ids){
   const start=loads.length,faceCount=480;
   await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
   await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.getAttribute('data-object-id')===id,id);
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
   assert.equal(await page.evaluate(id=>{const retained=window.__distantRetained;if(!retained)throw new Error('Missing retained nodes.');return [...document.querySelectorAll(`.${id}-body > u`)].every((node,i)=>node===retained[i]);},id),true);
   if(ids.slice(0,2).includes(id)) await page.screenshot({path:`${output}/${id}-rotated-dpr${dpr}.png`});
   results.push({id,dpr,leaves:faceCount,shadowsDefault:false,orbitDefault:false,forbiddenLeaves:forbidden,loadedFreshAssets:loads.slice(start)});
   if(dpr===1){
    await page.waitForTimeout(300);
    const before=await page.screenshot({clip:{x:400,y:160,width:650,height:600}});
    await page.locator('input[name="shadows"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Shadows control is not an HTML element.');node.click();});
    assert.equal(await page.locator('input[name="shadows"]').isChecked(),true);
    await page.waitForTimeout(300);
    const after=await page.screenshot({clip:{x:400,y:160,width:650,height:600}});
    assert.notEqual(sha256(before),sha256(after));
    await page.screenshot({path:`${output}/${id}-shadows-on.png`});
    await page.locator('input[name="shadows"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Shadows control is not an HTML element.');node.click();});
    await page.locator('input[name="orbit"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Orbit control is not an HTML element.');node.click();});
    assert.equal(await page.locator('input[name="orbit"]').isChecked(),true);
    await page.locator('input[name="orbit"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Orbit control is not an HTML element.');node.click();});
    assert.equal(await leaves.count(),faceCount);
    const result=results.at(-1);if(!result)throw new Error('Missing current browser result.');result.optInControls={shadows:true,bodyPixelsChanged:true,orbit:true};
   }
  }
  if(dpr===1&&!defaultsOnly){
   await page.goto(`${origin}/sun/?overview=system`,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
   assert.equal(await page.locator('input[name="asteroidOrbits"]').count(),0);
   for(const id of ['eros','itokawa','bennu']){
    assert.equal(await page.locator(`[data-context-body="${id}"]`).count(),1,`${id}: asteroid body is retained`);
    assert.equal(await page.locator(`[data-context-orbit="${id}"]`).count()>0,true,`${id}: asteroid orbit is retained`);
   }
   const search=page.locator('.planet-sidebar-search');await search.fill('Solar System');
   await page.locator('[data-object-tab="trans-neptunian"]').click();
   assert.equal(await page.locator('[data-system-results]').evaluate(node=>node.scrollLeft),0,
    'Category overflow must scroll the tab row, not the whole card.');
   const entries=page.locator('.planet-object-results-scroll .planet-object-link:visible');
   assert.equal(await entries.count(),SCENE_OBJECTS.filter(o=>o.classification==='trans-neptunian').length);
   const listed=await entries.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-object-id')));for(const id of bodies.filter(body=>body.classification==='trans-neptunian').map(body=>body.id))assert.ok(listed.includes(id));
   await page.screenshot({path:`${output}/trans-neptunian-category.png`});
   await page.locator('[data-object-tab="interstellar"]').click();
   assert.deepEqual(await entries.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-object-id'))),['oumuamua']);
   for(const id of ids){
    await search.fill(requiredObject(id).name);
    await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).click();
    await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.getAttribute('data-object-id')===id,id);
    assert.equal(await page.locator('.planet-stage').count(),1);assert.equal(await page.locator('.polycss-camera').count(),1);
    assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
    assert.equal(await page.locator(`.${id}-body > u[data-polycss-texture-leaf-sizing="raster"]`).count(),480);
   }
   results.push({navigation:{transNeptunianCount:listed.length,listed:ids,searchAndHandoff:ids,oneCamera:true,oneScene:true}});
   for(const body of bodies.filter(body=>body.aliases.length)){
    for(const alias of body.aliases){
     await search.fill(alias);
     assert.equal(await page.locator(`.planet-object-link[data-object-id="${body.id}"]:visible`).count(),1);
    }
    results.push({id:body.id,searchAliases:body.aliases});
   }
   const mobileId=[...bodies].sort((a,b)=>Math.max(...b.fullAxesKm)/Math.min(...b.fullAxesKm)-Math.max(...a.fullAxesKm)/Math.min(...a.fullAxesKm))[0].id;
   for(const id of [mobileId,'gkunhomdima']){
    await page.setViewportSize({width:390,height:844});
    await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
    await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.getAttribute('data-object-id')===id,id);
    const layout=await page.evaluate(()=>{const viewport=document.querySelector('.planet-viewport'),sidebar=document.querySelector('.planet-sidebar');if(!(viewport instanceof HTMLElement)||!(sidebar instanceof HTMLElement))throw new Error('Missing mobile layout elements.');const r=viewport.getBoundingClientRect();return{position:getComputedStyle(viewport).position,viewport:r.toJSON(),cardTop:sidebar.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth,diagnostics:window.__cssEarth!==undefined};});
    assert.equal(layout.position,'relative');assert.ok(layout.cardTop>=layout.viewport.bottom);assert.equal(layout.overflow,false);assert.equal(layout.diagnostics,build==='development');
    await page.screenshot({path:`${output}/${id}-mobile.png`});
    results.push({mobile:{id,...layout}});
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(defaultsOnly?`${reportDirectory}/default-views.json`:navigationOnly?`${reportDirectory}/navigation-final.json`:`${reportDirectory}/browser-validation.json`,JSON.stringify({capturedAt:new Date().toISOString(),codeRevision,browser:browser.version(),headless:true,build,origin,viewport:{width:1440,height:900},scope:`${build} server; ${defaultsOnly?'default views':navigationOnly?'category, search and handoff':'DPR 1/2 defaults, retained-node drag, native triangles, controls, category, search and navigation'} using verified scene assets.`,results},null,2)+'\n');
 console.log(defaultsOnly?'DPR1 actual default views captured':navigationOnly?'Integrated shared navigation checks passed':'DPR 1/2 fresh asset, default settings, native triangles and shared navigation checks passed');
}finally{await browser.close();}
