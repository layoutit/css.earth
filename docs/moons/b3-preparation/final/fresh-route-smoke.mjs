import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=process.cwd(), destination=process.argv[2];
assert.ok(destination?.startsWith('/'), 'Supply the absolute fresh installation directory.');
const sha=b=>createHash('sha256').update(b).digest('hex');
const installation=JSON.parse(await readFile(resolve(destination,'receipt.json')));
assert.equal(installation.status,'PASS');
const require=createRequire(resolve(root,'package.json'));
const {chromium}=require('playwright');
const {conformanceBrowserLaunch}=await import(pathToFileURL(resolve(root,'site/test/conformance-browser-launch.mjs')));
const {OBJECTS}=await import(pathToFileURL(resolve(root,'site/objects.mts')));
const {loadPlanetBrowserProfile,assertRenderedObjectControls}=await import(pathToFileURL(resolve(root,'site/test/load-browser-profile.mjs')));
const plan={callisto:['enhanced'],hyperion:['normal','elevation'],phoebe:['normal','elevation','maplet-resolution','image-count'],proteus:['filter-color'],titania:['geology'],miranda:['geology']};
const assets=new Map(installation.assets.map(a=>[`/scenes/${a.id}/${a.filename}`,a]));
const report={status:'RUNNING',startedAt:new Date().toISOString(),destination,scope:'Fresh downloaded scene images fulfilled into actual Chrome routes using the current development server for application code, JSON and shared shell. No existing scene image reads or source preparation. Not a fresh checkout build or production transfer measurement.',scriptSha256:sha(await readFile(process.argv[1])),cases:[],errors:[]};
const save=()=>writeFile(resolve(destination,'route-receipt.json'),JSON.stringify(report,null,2)+'\n');
const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:destination});
const browser=await chromium.launch(launch.options); report.browserVersion=browser.version();
try {
 for(const [id,lenses] of Object.entries(plan)) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  const row={id,lenses:[],fulfilled:[],responses:[],status:'RUNNING'};report.cases.push(row);await save();
  let responseQueue=Promise.resolve();
  await context.route('**/scenes/**',async route=>{
   const url=new URL(route.request().url()),a=assets.get(url.pathname);
   if(!url.pathname.startsWith(`/scenes/${id}/`)) return route.continue();
   try {
    assert.ok(a,`Undeclared scene request ${url.pathname}`);
    const bytes=await readFile(resolve(destination,a.id,a.filename));
    assert.equal(bytes.length,a.bytes);assert.equal(sha(bytes),a.sha256);
    row.fulfilled.push({path:url.pathname,bytes:bytes.length,sha256:sha(bytes)});
    await route.fulfill({status:200,body:bytes,contentType:a.filename.endsWith('.png')?'image/png':a.filename.endsWith('.jpg')?'image/jpeg':'image/webp'});
   }catch(e){report.errors.push(e.message);await route.abort();}
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(`${id}: ${e.message}`));
  page.on('response',r=>{
   const path=new URL(r.url()).pathname,a=assets.get(path);
   if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);
   if(a)responseQueue=Promise.all([responseQueue,(async()=>{try{const bytes=await r.body();assert.equal(sha(bytes),a.sha256);row.responses.push({path,bytes:bytes.length,sha256:sha(bytes)});}catch(e){report.errors.push(e.message);}})()]);
  });
  const object=OBJECTS.find(o=>o.id===id), profile=await loadPlanetBrowserProfile(object);
  assert.equal((await page.goto(`http://127.0.0.1:4291${object.route}`,{waitUntil:'networkidle'})).status(),200);
  await profile.waitForRuntime(page);await assertRenderedObjectControls(page,profile);
  for(const lensId of lenses){
   await page.locator(`button[name="lens"][value="${lensId}"]`).click();
   await page.waitForFunction(({id,lensId})=>{const r=window[`__${id}`],s=r.runtime.selection();return r.ready&&s.ready&&!s.pending&&s.committed?.lensId===lensId&&!r.camera.stats().dragInertia.destinationFlyTo?.active;},{id,lensId});
   assert.equal(await profile.visibleLens(page),lensId);assert.equal(await profile.stable(page),true);
   assert.equal(await profile.selectedDensity(page),2);
   row.lenses.push({lensId,ready:true,retained:true});
  }
  await responseQueue;assert.ok(row.fulfilled.length>0);assert.equal(row.responses.length,row.fulfilled.length);assert.deepEqual(report.errors,[]);
  row.status='PASS';await context.close();await save();console.log(`${id}: PASS (${row.fulfilled.length} fresh image responses)`);
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();report.browserClosed=true;report.finishedAt=new Date().toISOString();await save();console.log(resolve(destination,'route-receipt.json'));}
