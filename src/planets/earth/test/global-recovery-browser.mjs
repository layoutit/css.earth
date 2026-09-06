import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { serveBuiltFixture } from "../../../../tools/test-built-server.mjs";

const option = (name, fallback) => process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3) ?? fallback;
const built = resolve(option("built-dir","dist"));
const dpr = Number(option("dpr","1")); assert.ok([1,2].includes(dpr));
const output = resolve(`output/playwright/global-recovery-dpr${dpr}-${Date.now()}`); await mkdir(output,{recursive:true});
let fixture = null;
try { fixture = JSON.parse(await readFile(resolve(built,"fixture-receipt.json"))); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (fixture) { assert.equal(fixture.geometryMirror,false); assert.equal(fixture.install.installed,803); assert.equal(fixture.reuse.installed,0); }
const server = await serveBuiltFixture(built), browser = await chromium.launch({channel:"chrome",headless:true,args:server.launchArgs});
const report = {output,built,dpr,browser:browser.version(),fixtureCommit:fixture?.commit ?? null,
  qualification:"Built app with real public geometry/provider endpoints; test failures use separately labeled request interception. A clean asset install is claimed only when a fixture receipt is present. No app deployment or development diagnostics.",
  transitions:[],faults:[],teardowns:[],heapPlateau:[],errors:[],requests:[]};
const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,recordVideo:{dir:output,size:{width:1440,height:1000}}});
await context.addInitScript(()=>{
  const live=new Map(),create=URL.createObjectURL,revoke=URL.revokeObjectURL;
  window.__recoveryBlobs=live;
  URL.createObjectURL=function(blob){const url=create.call(this,blob);live.set(url,blob.size);return url;};
  URL.revokeObjectURL=function(url){live.delete(url);return revoke.call(this,url);};
});
const page=await context.newPage(),cdp=await context.newCDPSession(page),pending=new Set();
context.on("request",r=>{if(!r.url().startsWith("blob:"))pending.add(r);report.requests.push(r.url());});
context.on("requestfinished",r=>pending.delete(r));context.on("requestfailed",r=>pending.delete(r));
page.on("pageerror",error=>report.errors.push(error.message));
const lens=id=>page.locator(`button[name="lens"][value="${id}"]`);
const settle=async()=>{
  await page.waitForFunction(()=>document.documentElement.dataset.ready==="true"&&document.querySelector("[data-entity-card]")?.ariaBusy!=="true");
  let prior="",quiet=Date.now();
  for(const start=Date.now();Date.now()-start<120000;){
    const signature=await page.evaluate(()=>JSON.stringify({scene:document.querySelector(".polycss-scene")?.style.transform,
      pages:[...document.querySelectorAll('[data-city-page]')].map(n=>n.dataset.cityPage).sort(),
      statuses:[...document.querySelectorAll('[data-geographic-status]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent)}));
    const active=[...pending].some(r=>[server.url,"https://earth-assets.lowpoly.cc","https://mapproxy.terrascope.be"].includes(new URL(r.url()).origin));
    if(signature!==prior||active){prior=signature;quiet=Date.now();}
    if(Date.now()-quiet>=800)return;
    await page.waitForTimeout(100);
  }throw new Error("Built recovery did not settle.");
};
const state=()=>page.evaluate(()=>{
  const nodes=[...document.querySelector('.planet-stage').querySelectorAll('*')],before=window.__recoveryNodes??=nodes;
  return {entity:document.querySelector('[data-entity-card]').dataset.entityId,lens:document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,
    stable:before.length===nodes.length&&before.every((n,i)=>n===nodes[i]),sceneElements:nodes.length,
    pages:[...document.querySelectorAll('[data-city-page]')].filter(n=>n.style.visibility==='visible').map(n=>n.dataset.cityPage),
    status:[...document.querySelectorAll('[data-geographic-status]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent).join(' '),
    blobs:window.__recoveryBlobs.size,blobBytes:[...window.__recoveryBlobs.values()].reduce((s,n)=>s+n,0),url:location.href};
});
const checkpoint=async(name,{fault=false,capture=false}={})=>{
  await settle();const record={name,...await state()};assert.ok(record.stable);
  if(!fault)assert.doesNotMatch(record.status,/could not|unavailable|loading/i);
  if(capture)await page.screenshot({path:resolve(output,`${name}.png`)});
  console.log(JSON.stringify({checkpoint:name,entity:record.entity,lens:record.lens,pages:record.pages.length}));
  return record;
};
const select=async(query,id)=>{await page.locator('.planet-sidebar-search').fill(query);await page.locator(`[data-destination-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('[data-entity-card]').dataset.entityId===id,id);await settle();};
const activate=async id=>{await lens(id).click();await settle();assert.equal(await lens(id).getAttribute('aria-pressed'),'true');};
try{
  await page.goto(`${server.url}/earth/#place=3435910&lens=buenos-aires-noise`);
  const initial=await checkpoint('deep-link',{capture:true});assert.equal(initial.entity,'3435910');assert.equal(initial.lens,'buenos-aires-noise');assert.equal(initial.pages.filter(k=>k.startsWith('noise-')).length,16);
  const saved=page.url();await select('Tokyo','1850147');assert.equal(await lens('buenos-aires-noise').isVisible(),false);
  await page.goBack();const back=await checkpoint('back');assert.equal(back.entity,'3435910');assert.equal(back.lens,'buenos-aires-noise');
  assert.equal(new URL(back.url).search,new URL(saved).search,'Back restores the exact saved camera token');
  await page.goForward();assert.equal((await checkpoint('forward')).entity,'1850147');
  await page.goto(saved);const restored=await checkpoint('reload',{capture:true});assert.equal(restored.entity,'3435910');assert.equal(restored.lens,'buenos-aires-noise');assert.equal(new URL(restored.url).search,new URL(saved).search);
  report.history={initial,back,restored,passed:true};

  // Preserve the camera in a normal Earth-card link. The source fault remains
  // at the same detailed view, while the lens belongs to Earth, not the city.
  const earthView = new URL(saved); earthView.hash = "";
  // Failure fixtures disable the HTTP cache; these are recovery checks only.
  const faultCase=async(name,pattern,handler)=>{
    await page.goto(earthView.href);await settle();
    assert.equal((await state()).entity,'earth');
    await activate('normal');const before=await checkpoint(`${name}-base`);assert.ok(before.pages.length);
    let calls=0;const byUrl=new Map();
    const fixtureErrors=[];
    const route=async r=>{calls++;byUrl.set(r.request().url(),(byUrl.get(r.request().url())??0)+1);
      try{await handler(r);}catch(error){fixtureErrors.push(error.message);await r.abort().catch(()=>{});}};
    await page.route(pattern,route);
    await lens('worldcover-land-cover').click();
    await page.locator('[data-lens-legend="worldcover-land-cover"] [data-geographic-status]').filter({hasText:'could not load'}).waitFor({timeout:120000});
    const failed=await checkpoint(`${name}-failed`,{fault:true,capture:true});assert.equal(failed.entity,'earth');assert.ok(calls);
    assert.deepEqual(fixtureErrors,[],"The fixture must fail the intended bytes, not its own transport");
    await page.unroute(pattern,route);await activate('worldcover-land-cover');
    const recovered=await checkpoint(`${name}-recovered`,{capture:name==='provider-outage'});assert.ok(recovered.pages.length);
    report.faults.push({name,calls,byUrl:[...byUrl],failed,recovered,passed:true});
    console.log(JSON.stringify({fault:name,calls,recovered:recovered.pages.length}));
  };
  const corrupt=async route=>{
    const url=new URL(route.request().url());
    if(url.origin===server.url){const body=Buffer.from(await readFile(resolve(built,`.${url.pathname}`)));body[0]^=255;await route.fulfill({status:200,contentType:'application/octet-stream',body});}
    else {const response=await route.fetch(),body=Buffer.from(await response.body());body[0]^=255;await route.fulfill({response,body});}
  };
  await faultCase('corrupt-package','**/geographic-lens-worldcover-land-cover-*.json',corrupt);
  await faultCase('corrupt-root-directory','**/geographic-roots-*.pack',corrupt);
  await faultCase('corrupt-range','https://earth-assets.lowpoly.cc/**/wmts-*/*.pack',corrupt);
  await faultCase('unavailable-range','https://earth-assets.lowpoly.cc/**/wmts-*/*.pack',route=>route.fulfill({status:503,headers:{'access-control-allow-origin':server.url},body:'Fixture geometry unavailable'}));
  await faultCase('corrupt-tile','https://mapproxy.terrascope.be/**/esa-worldcover-map-10m-2021-v2_map/**',corrupt);
  await faultCase('provider-outage','https://mapproxy.terrascope.be/**/esa-worldcover-map-10m-2021-v2_map/**',route=>route.fulfill({status:503,headers:{'access-control-allow-origin':'*','retry-after':'0'},body:'Fixture unavailable'}));
  assert.ok(report.faults.at(-1).byUrl.every(([,count])=>count<=3),'No provider URL retries more than twice');

  // Repeated actual entity/lens/body navigation. Pagehide is observed after
  // the application's registered teardown, before the old document is gone.
  await activate('normal');await settle();
  for(let cycle=0;cycle<5;cycle++){
    const transition=async(name,action)=>{await action();report.transitions.push({cycle,...await checkpoint(name)});};
    await transition('buenos-aires',()=>select('Buenos Aires','3435910'));
    await transition('noise',()=>activate('buenos-aires-noise'));
    await transition('earth-land-cover',async()=>{await page.locator('[data-entity-parent="earth"]').click();await settle();await activate('worldcover-land-cover');});
    await transition('tokyo',()=>select('Tokyo','1850147'));
    await transition('lagos',()=>select('Lagos','2332459'));
    await transition('buenos-aires-return',()=>select('Buenos Aires','3435910'));
    await transition('noise-return',()=>activate('buenos-aires-noise'));
    await transition('earth-root',async()=>{await page.locator('[data-entity-parent="earth"]').click();});
    await page.evaluate(()=>{
      const nodes=[...document.querySelector('.planet-stage').querySelectorAll('*')],live=window.__recoveryBlobs;
      window.addEventListener('pagehide',()=>sessionStorage.setItem('recovery-teardown',JSON.stringify({connected:nodes.some(n=>n.isConnected),blobs:live.size})),{once:true});
    });
    await transition('mars',async()=>{await page.locator('.planet-sidebar-search').fill('Mars');await page.locator('.planet-object-browser a[href="/mars/"]').click();});
    const teardown=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('recovery-teardown')));assert.deepEqual(teardown,{connected:false,blobs:0});report.teardowns.push(teardown);
    await transition('earth-remount',async()=>{await page.locator('.planet-sidebar-search').fill('Earth');await page.locator('.planet-object-browser a[href="/earth/"]').click();});
    await cdp.send('HeapProfiler.collectGarbage');report.heapPlateau.push({cycle,...await cdp.send('Runtime.getHeapUsage')});
    console.log(JSON.stringify({cycle,transitions:report.transitions.length,heap:report.heapPlateau.at(-1).usedSize}));
  }
  assert.equal(report.transitions.length,50);
  const heaps=report.heapPlateau.slice(1).map(p=>p.usedSize);assert.ok(Math.max(...heaps)-Math.min(...heaps)<8*1024**2,'Post-collection Earth remount heap remains within an 8 MiB band');
  assert.ok(!server.requests.some(r=>r.path.includes('/wmts-')));
  const scripts=[...new Map(server.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];
  for(const script of scripts)assert.equal(script.sha256,createHash('sha256').update(await readFile(resolve(built,`.${script.path}`))).digest('hex'));
  report.scripts=scripts;report.memoryQualification='Collected main-page V8 heap, retained DOM and blob teardown. This does not measure physical-device memory or total GPU/process residency; worker residency is qualified separately by the fifty-selection worker probe.';
  assert.deepEqual(report.errors,[]);report.complete=true;
}catch(error){report.error=error.stack;report.failedState=await state().catch(()=>null);await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error;}
finally{await context.close();report.video=await page.video()?.path();await browser.close();await server.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,complete:report.complete??false}));}
