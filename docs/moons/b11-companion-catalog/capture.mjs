// Narrow evidence runner using the existing browser profiles and shared runtime.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {OBJECTS} from '../../../site/objects.mjs';
import {loadPlanetBrowserProfile,assertRenderedObjectControls} from '../../../site/test/load-browser-profile.mjs';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mjs';
const ids=['asteroid-2001-sn263','sn263-beta','sn263-gamma'],origin=process.argv[2]??'http://127.0.0.1:4292';
const out=resolve('output/playwright/b11-companions'),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const resume=process.argv.includes('--resume');
const report=resume?JSON.parse(await readFile(resolve(out,'report.json'))):{schema:'cssearth-sn263-browser-evidence@1',origin,started:new Date().toISOString(),status:'RUNNING',inputs:[],cases:[],navigation:[],errors:[]};
if(resume){
 assert.equal(report.origin,origin);assert.equal(report.cases.length,6);assert.deepEqual(report.errors,[]);
 for(const p of report.inputs)assert.equal(sha(await readFile(p.path)),p.sha256,'Cannot resume changed inputs');
 report.previousFailure=report.failure;delete report.failure;report.status='RUNNING';report.inputs=[];report.navigation=[];
}
for(const id of ids)for(const suffix of ['object.json','source/manifest.json','prepared/object.json','prepared/runtime-assets.json']){const path=`src/planets/${id}/${suffix}`,b=await readFile(path);report.inputs.push({path,bytes:b.length,sha256:sha(b)})}
for(const path of ['site/objects.mjs','src/platform/solar-geometry.mjs','site/prepared-navigation-markers.mjs',...ids.map(id=>`src/renderers/css/styles/${id}-surfaces.css`)]){const b=await readFile(path);report.inputs.push({path,bytes:b.length,sha256:sha(b)})}
const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:out});
const browser=await chromium.launch(launch.options);report.browser=browser.version();report.launch=launch.diagnostics;
const save=()=>writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
try{
 for(const dpr of [1,2])for(const id of ids){
  if(resume){assert.ok(report.cases.find(r=>r.id===id&&r.dpr===dpr)?.final);continue;}
  const profile=await loadPlanetBrowserProfile(OBJECTS.find(x=>x.id===id));
  const viewport={width:1440,height:1000},context=await browser.newContext({viewport,deviceScaleFactor:dpr}),page=await context.newPage();
  const row={id,dpr,viewport,responses:[],screenshots:[]};report.cases.push(row);let queue=Promise.resolve();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);if(r.status()===200&&(r.url().includes(`/objects/${id}/`)||r.url().includes(`/scenes/${id}/`))){queue=queue.then(async()=>{const b=await r.body();row.responses.push({url:r.url(),status:r.status(),bytes:b.length,sha256:sha(b)})}).catch(e=>report.errors.push(e.message))}});
  await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});await profile.waitForRuntime(page);await assertRenderedObjectControls(page,profile);
  await profile.pause(page);assert.equal(await profile.selectedDensity(page),2);await page.locator(`#${id}-dataset-tab`).click();
  row.labels=await page.locator('button[name="lens"]').evaluateAll(nodes=>nodes.map(n=>{const e=n.querySelector('.planet-lens-detail');return{label:n.querySelector('.planet-lens-label').textContent,detail:e.textContent,width:e.clientWidth,scroll:e.scrollWidth}}));
  assert.equal(row.labels[0].detail,'Radar');assert.ok(row.labels.every(x=>x.scroll<=x.width+1));
  const shot=async(name)=>{const file=`${id}-dpr${dpr}-${name}.png`;await page.screenshot({path:resolve(out,file)});row.screenshots.push(file)};
  row.initial=await inspect(page,id);await shot('shape');
  for(const shadows of [false,true]){
   // Main hides the public settings button; this tests the retained binding only.
   await page.locator('input[name="shadows"]').evaluate((input,value)=>{if(input.checked!==value)input.click()},shadows);
   await page.waitForFunction(({id,shadows})=>{const s=window[`__${id}`].runtime.selection();return s.ready&&!s.pending&&s.committed.shadows===shadows},{id,shadows});
   await shot(`shadows-${shadows}`);
  }
  const box=await page.locator('.polycss-camera').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.evaluate(id=>{const root=document.querySelector('.planet-stage'),nodes=[...root.querySelectorAll('*')],frames=[];let h;const tick=t=>{frames.push(t);h=requestAnimationFrame(tick)};h=requestAnimationFrame(tick);window.__sn263Drag=()=>{cancelAnimationFrame(h);return{nodes:nodes.length,after:root.querySelectorAll('*').length,retained:nodes.every(n=>n.isConnected),frames}}},id);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+85,y+35,{steps:16});await page.mouse.up();
  await page.waitForFunction(id=>!window[`__${id}`].camera.stats().dragInertia.active,id);
  row.drag=await page.evaluate(()=>window.__sn263Drag());assert.ok(row.drag.retained);assert.equal(row.drag.nodes,row.drag.after);assert.equal(await profile.stable(page),true);await shot('drag');
  await page.mouse.wheel(0,-350);await page.waitForFunction(id=>!window[`__${id}`].camera.stats().dragInertia.wheelZoom.active,id);await shot('close');
  row.final=await inspect(page,id);assert.notDeepEqual(row.initial.camera,row.final.camera);
  await queue;const pin=report.inputs.find(p=>p.path===`src/planets/${id}/prepared/object.json`);assert.ok(row.responses.some(r=>r.sha256===pin.sha256),'Actual scene response must match pin');
  const assets=JSON.parse(await readFile(`src/planets/${id}/runtime-assets.json`));for(const r of row.responses.filter(r=>r.url.includes(`/scenes/${id}/`))){const a=assets.assets.find(a=>r.url.endsWith('/'+a.filename));assert.ok(a&&a.bytes===r.bytes&&a.sha256===r.sha256,'Actual scene asset must match pin')}
  await context.close();await save();
 }
 // Search navigation exercises one retained shell and one mounted scene.
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.goto(`${origin}/${ids[0]}/`);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.evaluate(()=>{window.__sn263Shell=document.querySelector('.planet-stage')});
 for(const id of [...ids.slice(1),ids[0]]){await page.locator('.planet-sidebar-search').fill('SN263');await page.getByRole('tab',{name:/^All(?:\s|$)/}).click();await page.locator(`a.planet-object-link[data-object-id="${id}"]:visible`).first().click();await page.waitForFunction(id=>window.__cssEarth.activeObjectId===id&&document.documentElement.dataset.ready==='true',id,{timeout:45000});const r=await page.evaluate(()=>({sceneCount:document.querySelectorAll('.polycss-scene').length,shellRetained:window.__sn263Shell===document.querySelector('.planet-stage'),id:window.__cssEarth.activeObjectId}));assert.equal(r.sceneCount,1);assert.ok(r.shellRetained);report.navigation.push(r)}await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),mp=await mobile.newPage();await mp.goto(`${origin}/sn263-beta/`,{waitUntil:'networkidle'});await mp.waitForFunction(()=>document.documentElement.dataset.ready==='true');await mp.locator('#sn263-beta-dataset-tab').click();await mp.screenshot({path:resolve(out,'sn263-beta-mobile.png')});await mp.locator('button[name="lens"]').scrollIntoViewIfNeeded();await mp.screenshot({path:resolve(out,'sn263-beta-mobile-selector.png')});report.mobile=await mp.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,detail:document.querySelector('button[name="lens"] .planet-lens-detail').textContent}));assert.equal(report.mobile.detail,'Radar');assert.ok(report.mobile.documentWidth<=report.mobile.width);await mobile.close();
 for(const p of report.inputs){const b=await readFile(p.path);assert.equal(sha(b),p.sha256,'Inputs changed during browser capture')}
 assert.deepEqual(report.errors,[]);report.status='CAPTURED_UNREVIEWED';
} catch(e){report.status='INVALID';report.failure={message:e.message,stack:e.stack};throw e}
finally{await browser.close();report.browserClosed=true;report.finished=new Date().toISOString();await save();console.log(resolve(out,'report.json'))}
async function inspect(page,id){return page.evaluate(id=>{const r=window[`__${id}`],leaves=[...document.querySelectorAll(`.${id}-body > u`)];return{camera:r.camera.state(),nodes:r.stableNodes.length,leaves:leaves.length,sceneCount:document.querySelectorAll('.polycss-scene').length,stable:r.assertStableDomIdentity(),rasterSizes:[...new Set(leaves.map(n=>{const s=getComputedStyle(n);return`${s.width}×${s.height}`}))]};},id)}
