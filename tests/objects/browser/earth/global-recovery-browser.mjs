import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const built=resolve(option('built-dir','dist')),output=resolve(option('output',`output/playwright/global-recovery-${Date.now()}`));
const dprs=option('dpr','1,2').split(',').map(Number),cases=option('cases','rgb-image,rgb-metadata,noise-image,noise-package').split(',');
const record=option('record','true')==='true';await mkdir(output,{recursive:true});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),built,output,
 qualification:'Built app, native browser lens clicks, controlled 503 responses. Real prepared assets and provider requests resume after explicit same-view retry. Synthetic fault fixture, not a performance or deployment test.',
 harnessSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[],errors:[]};
const server=await serveBuiltFixture(built);let browser;
const boundedClose=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' cleanup timed out')),15000);})]);}finally{clearTimeout(timer);}};
const state=page=>page.evaluate(()=>({entity:document.querySelector('[data-entity-card]')?.dataset.entityId,
 lens:document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,url:location.href,
 pages:[...document.querySelectorAll('[data-city-page]')].filter(n=>n.style.visibility==='visible').map(n=>n.dataset.cityPage),
 status:[...document.querySelectorAll('[data-geographic-status],[data-page-status]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent).join(' '),
 nodes:document.querySelector('.planet-stage')?.querySelectorAll('*').length,blobs:window.__recoveryBlobs.size,
 stable:!window.__recoveryNodes||window.__recoveryNodes.every(n=>n.isConnected),
 scenes:document.querySelectorAll('.polycss-scene').length}));
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:server.launchArgs});report.browser=browser.version();
 for(const dpr of dprs)for(const fault of cases){
  assert.ok([1,2].includes(dpr));const row={name:`dpr${dpr}-${fault}`,dpr,fault,attempts:[],errors:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,...(record?{recordVideo:{dir:output,size:{width:1440,height:1000}}}:{})});
  await context.addInitScript(()=>{window.__recoveryBlobs=new Map();const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
   URL.createObjectURL=function(blob){const url=create.call(this,blob);window.__recoveryBlobs.set(url,blob.size);return url;};
   URL.revokeObjectURL=function(url){window.__recoveryBlobs.delete(url);return revoke.call(this,url);};});
  const page=await context.newPage(),pending=new Set();let failing=true,phase='fault',maxPending=0,faultKey=null,faultArmed=false;
  page.on('pageerror',e=>row.errors.push(e.message));
  context.on('request',r=>{if(/^https?:/.test(r.url())){pending.add(r);maxPending=Math.max(maxPending,pending.size);}});
  context.on('requestfinished',r=>pending.delete(r));context.on('requestfailed',r=>pending.delete(r));
  const matches=value=>{const url=value.href;return fault==='rgb-image'?url.includes('mapproxy.terrascope.be/'):
   fault==='rgb-metadata'?url.includes('/wmts-')&&url.endsWith('.pack'):
   fault==='noise-image'?/\/earth-noise-day-[^/]+\.webp$/.test(url):fault==='noise-package'?/\/geographic-lens-buenos-aires-noise-/.test(url):false;};
  await page.route(matches,async route=>{
   if(!faultArmed){await route.continue();return;}
   const url=route.request().url(),key=url+'#'+(route.request().headers().range??'');
   if(fault==='rgb-image'&&!/\/13\/\d+\/\d+\.png$/.test(url)){await route.continue();return;}
   faultKey??=key;
   if(key!==faultKey){await route.continue();return;}
   row.faultKey=faultKey;row.attempts.push({phase,url:route.request().url(),range:route.request().headers().range??null});
   if(failing)await route.fulfill({status:503,headers:{'access-control-allow-origin':'*','retry-after':'0'},body:'Stationary recovery fault fixture'});else await route.continue();});
  const settle=async()=>{
   let last='',quiet=Date.now(),logAt=Date.now();
   for(const start=Date.now();Date.now()-start<120000;){
    const s=await state(page),signature=JSON.stringify([s.pages,s.url,s.status]);
    if(signature!==last||[...pending].some(r=>[server.url,'https://earth-assets.lowpoly.cc','https://mapproxy.terrascope.be'].includes(new URL(r.url()).origin))){last=signature;quiet=Date.now();}
    if(Date.now()-logAt>15000){logAt=Date.now();console.log(JSON.stringify({name:row.name,phase,pages:s.pages.length,status:s.status,pending:[...pending].map(r=>r.url()).slice(0,6),url:s.url}));}
    if(Date.now()-quiet>2500)return s;
    await page.waitForTimeout(100);
   }row.pending=[...pending].map(r=>r.url());throw new Error('Recovery fixture did not settle: '+row.pending.join(', '));
  };
  page.on('crash',()=>{row.crashed=true;console.log(JSON.stringify({name:row.name,crashed:true}));});
  try{
   const lens=fault.startsWith('noise')?'buenos-aires-noise':'normal';
   // Save a real camera through normal selection, then start a fresh document
   // at that view so the first fault belongs to stationary demand, not a flight.
   console.log(JSON.stringify({name:row.name,phase:'warm-view'}));await page.goto(`${server.url}/earth/#place=3435910`);
   await page.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&document.querySelector('[data-entity-card]')?.ariaBusy!=='true',null,{timeout:90000});
   await settle();await page.mouse.move(1000,500);await page.mouse.wheel(0,1);await settle();
   const target=new URL(page.url());target.hash=`place=3435910&lens=${lens}`;
   await page.goto('about:blank');faultArmed=true;console.log(JSON.stringify({name:row.name,phase:'stationary-fault'}));await page.goto(target.href);
   await page.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&document.querySelector('[data-entity-card]')?.ariaBusy!=='true',null,{timeout:90000});
   await settle();
   await page.evaluate(()=>window.__recoveryNodes=[...document.querySelector('.planet-stage').querySelectorAll('*')]);
   row.otherPending=[...pending].map(r=>new URL(r.url())).filter(url=>![server.url,'https://earth-assets.lowpoly.cc','https://mapproxy.terrascope.be'].includes(url.origin)).map(url=>url.origin+url.pathname);row.failed=await state(page);console.log(JSON.stringify({name:row.name,phase:'failed',attempts:row.attempts.length,pages:row.failed.pages.length}));await writeFile(resolve(output,row.name+'-progress.json'),JSON.stringify(row,null,2));await page.screenshot({path:resolve(output,row.name+'-failed.png')});
   assert.ok(row.attempts.length,'The fault must reach the intended live transport');
   row.failedAttempts=row.attempts.length;failing=false;phase='service-restored';await page.waitForTimeout(1000);
   assert.equal(row.attempts.length,row.failedAttempts,'Stationary failures must not create an automatic retry storm');
   phase='retry';await page.locator(`button[name="lens"][value="${lens}"]`).click();
   row.recovered=await settle();console.log(JSON.stringify({name:row.name,phase:'retried',attempts:row.attempts.length,pages:row.recovered.pages.length}));await page.screenshot({path:resolve(output,row.name+'-recovered.png')});
   assert.ok(row.attempts.length>row.failedAttempts,'Explicit same-view retry must restart failed requests');
   assert.match(row.failed.status,/could not load|could not open/i,'Failure must be visible in the current card');
   assert.doesNotMatch(row.recovered.status,/could not|unavailable|loading/i);
   assert.equal(row.recovered.entity,'3435910');assert.equal(row.recovered.lens,lens);
   assert.equal(row.recovered.url,row.failed.url,'Retry preserves the same camera and selection URL');
   assert.ok(row.recovered.stable);assert.equal(row.recovered.nodes,row.failed.nodes);assert.equal(row.recovered.scenes,1);
   assert.ok(row.recovered.pages.some(key=>!row.failed.pages.includes(key)),'Recovered detail must replace usable backing');
   const byKey=new Map();for(const a of row.attempts.filter(a=>a.phase==='fault')){const key=a.url+'#'+a.range;byKey.set(key,(byKey.get(key)??0)+1);}
   assert.ok([...byKey.values()].every(n=>n<=3),'No failed image request exceeds its two automatic retries');
   row.failureAttemptsByKey=[...byKey];row.maxPending=maxPending;assert.deepEqual(row.errors,[]);row.passed=true;
   console.log(JSON.stringify({name:row.name,passed:true,attempts:row.attempts.length,pages:row.recovered.pages.length}));
  }catch(e){row.error=e.stack;throw e;}finally{await writeFile(resolve(output,row.name+'-progress.json'),JSON.stringify(row,null,2));await boundedClose(context.close(),'Context');row.video=await page.video()?.path();}
 }
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{
 await boundedClose(browser?.close(),'Browser').catch(error=>{report.cleanupError=error.message;process.exitCode=1;});await server.close();report.closed=!report.cleanupError;
 report.scripts=[...new Map(server.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];
 for(const r of report.scripts)assert.equal(r.sha256,createHash('sha256').update(await readFile(resolve(built,'.'+r.path))).digest('hex'));
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed??false,error:report.error}));
}
