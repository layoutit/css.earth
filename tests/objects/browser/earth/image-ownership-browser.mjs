import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
const boundedClose=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' cleanup timed out')),15000);})]);}finally{clearTimeout(timer);}};
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const built=resolve(option('built','dist')),output=resolve(option('output',`output/playwright/image-ownership-${Date.now()}`));await mkdir(output,{recursive:true});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),built,output,dpr:2,idleSeconds:Number(option('idle-seconds','123')),
 qualification:'Finite Chrome allocator snapshots with real imagery and visible navigation. Weak image observers and blob URL accounting distinguish held handles from browser caches. Detailed dumps and forced collection are intrusive; no timing or physical GPU budget claim.',
 harnessSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),snapshots:[],errors:[]};
const fixture=await serveBuiltFixture(built);let browser,context,page,cdp,browserCdp,tracing=false;
const pending=new Set();
const settle=async()=>{let quiet=Date.now();for(const start=Date.now();Date.now()-start<120000;){if([...pending].some(r=>[fixture.url,'https://earth-assets.lowpoly.cc','https://mapproxy.terrascope.be'].includes(new URL(r.url()).origin)))quiet=Date.now();if(Date.now()-quiet>1800)return;await page.waitForTimeout(100);}throw new Error('Ownership requests did not settle');};
const snapshot=async name=>{
 await settle();await cdp.send('HeapProfiler.collectGarbage');
 const state=await page.evaluate(()=>{
  const p=window.__imageOwnership,images=[];
  for(const [id,weak]of p.images){const image=weak.deref();if(!image){p.images.delete(id);continue;}if(image.getAttribute('src'))images.push({url:image.src,width:image.naturalWidth,height:image.naturalHeight,decodedBytes:image.naturalWidth*image.naturalHeight*4});}
  const cssUrls=[...new Set([...document.querySelector('.planet-stage').querySelectorAll('*')].flatMap(n=>[...getComputedStyle(n).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])))];
  const pages=[...document.querySelectorAll('[data-city-page]')].filter(n=>n.style.visibility==='visible');
  const bound=new Set(pages.flatMap(n=>[n,...n.querySelectorAll('*')]).flatMap(n=>[...n.style.backgroundImage.matchAll(/blob:[^"')]+/g)].map(m=>m[0])));
  return {url:location.href,entity:document.querySelector('[data-entity-card]')?.dataset.entityId,lens:document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,
   scenes:document.querySelectorAll('.polycss-scene').length,pages:pages.length,pageKeys:pages.map(n=>n.dataset.cityPage),images,cssUrls,
   blobs:[...p.blobs].map(([url,bytes])=>({url,bytes,bound:bound.has(url)})),
   oldEarthAlive:p.oldEarth?.reduce((n,w)=>n+Number(Boolean(w.deref())),0)??null,
   oldEarthConnected:p.oldEarth?.reduce((n,w)=>n+Number(w.deref()?.isConnected??false),0)??null};
 });
 await cdp.send('Tracing.start',{traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:65536,excludedCategories:['*'],includedCategories:['blink.user_timing','disabled-by-default-memory-infra']},transferMode:'ReturnAsStream',streamFormat:'json'});tracing=true;
 await page.evaluate(name=>performance.mark('ownership:'+name+':start'),name);
 const memoryDump=await browserCdp.send('Tracing.requestMemoryDump',{levelOfDetail:'detailed'});
 await page.evaluate(name=>performance.mark('ownership:'+name+':end'),name);
 const row={name,state,memoryDump,otherPending:[...pending].map(r=>new URL(r.url())).map(url=>url.origin+url.pathname),heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters')};report.snapshots.push(row);await stopTrace();
 if(name==='mars-after-earth'&&state.oldEarthAlive>0){
  row.detached=await page.evaluate(()=>{const counts={};for(const w of window.__imageOwnership.oldEarth){const n=w.deref();if(n){const key=n.tagName+'.'+n.className;counts[key]=(counts[key]??0)+1;}}return counts;});
  await cdp.send('HeapProfiler.enable');const file=resolve(output,'departed-earth.heapsnapshot');const collect=({chunk})=>appendFileSync(file,chunk);cdp.on('HeapProfiler.addHeapSnapshotChunk',collect);try{await cdp.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});}finally{cdp.off('HeapProfiler.addHeapSnapshotChunk',collect);}
  const object=await cdp.send('Runtime.evaluate',{expression:'window.__imageOwnership.oldEarth.map(w=>w.deref()).find(Boolean)',objectGroup:'ownership-retainer'});if(object.result.objectId){row.retainedHeapObject=await cdp.send('HeapProfiler.getHeapObjectId',{objectId:object.result.objectId});await cdp.send('Runtime.releaseObjectGroup',{objectGroup:'ownership-retainer'});}
 }
 await writeFile(resolve(output,'progress.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({name,images:state.images.length,blobs:state.blobs.length,pages:state.pages,oldEarthConnected:state.oldEarthConnected}));
 return row;
};
const select=async(query,id)=>{await page.locator('.planet-sidebar-search').fill(query);await page.locator(`[data-destination-id="${id}"]:visible`).click();await page.waitForFunction(id=>document.querySelector('[data-entity-card]')?.dataset.entityId===id&&document.querySelector('[data-entity-card]').ariaBusy!=='true',id);let prior='',quiet=Date.now();for(const start=Date.now();;){const value=await page.locator('.polycss-scene').evaluate(n=>n.style.transform);if(value!==prior){prior=value;quiet=Date.now();}if(Date.now()-quiet>600)break;assert.ok(Date.now()-start<20000,'Destination flight must settle');await page.waitForTimeout(100);}};
const lens=async id=>{await page.locator(`button[name="lens"][value="${id}"]:visible`).click();await page.waitForTimeout(500);};
const stopTrace=async()=>{
 const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const result=await done;tracing=false;
 const chunks=[];for(;;){const row=await cdp.send('IO.read',{handle:result.stream,size:1048576});chunks.push(Buffer.from(row.data,row.base64Encoded?'base64':'utf8'));if(row.eof)break;}await cdp.send('IO.close',{handle:result.stream});
 const bytes=Buffer.concat(chunks),current=report.snapshots.at(-1);current.traceFile='trace-'+current.name+'.json.gz';await writeFile(resolve(output,current.traceFile),gzipSync(bytes));current.traceDataLoss=result.dataLossOccurred;assert.equal(Boolean(result.dataLossOccurred),false);
 const events=JSON.parse(bytes).traceEvents,groups=new Map();
 for(const event of events.filter(e=>e.ph==='v'&&e.args?.dumps)){const key=event.id+':'+event.pid;const group=groups.get(key)??{id:event.id,pid:event.pid,ts:event.ts,allocators:{}};Object.assign(group.allocators,event.args.dumps.allocators);if(event.args.dumps.process_totals)group.totals=event.args.dumps.process_totals;groups.set(key,group);}
 const size=(a,key)=>a[key]?.attrs?.size?.value===undefined?null:parseInt(a[key].attrs.size.value,16);
 for(const row of [current]){const start=events.find(e=>e.name==='ownership:'+row.name+':start'),end=events.find(e=>e.name==='ownership:'+row.name+':end');assert.ok(start&&end);
  const found=[...groups.values()].filter(g=>g.pid===start.pid&&g.ts>=start.ts&&g.ts<=end.ts&&g.allocators.cc);assert.equal(found.length,1,'One associated renderer dump for '+row.name);const g=found[0];
  row.native={rendererPid:g.pid,traceId:g.id,imageCacheBytes:size(g.allocators,'cc/image_memory'),compositorBytes:size(g.allocators,'cc'),v8AccountedBytes:size(g.allocators,'v8'),
   privateFootprintBytes:g.totals?.private_footprint_bytes===undefined?null:parseInt(g.totals.private_footprint_bytes,16),gpuImageBytes:!g.allocators['cc/image_memory']?null:Object.entries(g.allocators).filter(([key])=>/^cc\/image_memory\/cache_[^/]+\/gpu$/.test(key)).reduce((sum,[,value])=>sum+parseInt(value.attrs?.size?.value??'0',16),0)};
 }
};
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});report.browser=browser.version();browserCdp=await browser.newBrowserCDPSession();
 context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 await context.addInitScript(()=>{
  const p=window.__imageOwnership={images:new Map(),blobs:new Map()},seen=new WeakMap();let next=0;const decode=HTMLImageElement.prototype.decode,create=URL.createObjectURL,revoke=URL.revokeObjectURL;
  HTMLImageElement.prototype.decode=function(){if(!seen.has(this)){seen.set(this,++next);p.images.set(next,new WeakRef(this));}return decode.call(this);};
  URL.createObjectURL=function(blob){const url=create.call(this,blob);p.blobs.set(url,blob.size);return url;};URL.revokeObjectURL=function(url){p.blobs.delete(url);return revoke.call(this,url);};
 });
 context.on('request',r=>{if(/^https?:/.test(r.url()))pending.add(r);});context.on('requestfinished',r=>pending.delete(r));context.on('requestfailed',r=>pending.delete(r));
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));cdp=await context.newCDPSession(page);
 await page.goto(fixture.url+'/earth/');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:120000});await snapshot('earth-globe');
 await select('Buenos Aires','3435910');const city=await snapshot('city-visible');assert.equal(city.state.entity,'3435910');assert.equal(city.state.lens,'normal');assert.ok(city.state.pages>0&&city.state.blobs.some(b=>b.bound),'City memory must include real visible geographic detail');
 await lens('buenos-aires-noise');const noise=await snapshot('city-noise');assert.equal(noise.state.lens,'buenos-aires-noise');assert.ok(noise.state.pageKeys.some(k=>k.startsWith('noise-')),'Noise memory must include its actual observation');
 await lens('normal');await snapshot('city-visible-revisit');
 await page.waitForTimeout(6000);await snapshot('city-visible-idle');
 // The production transport gives unbound images a two-minute reuse window.
 // Observe the actual timer without advancing the application's clock.
 for(let seconds=0;seconds<Number(option('idle-seconds','123'));seconds+=1){await page.waitForTimeout(1000);if(seconds%30===29)console.log(JSON.stringify({idleSeconds:seconds+1}));}
 await snapshot(report.idleSeconds>=120?'city-visible-idle-expired':'city-visible-idle-diagnostic');
 await page.evaluate(()=>window.__imageOwnership.oldEarth=[document.querySelector('.polycss-scene'),...document.querySelector('.polycss-scene').querySelectorAll('*')].map(n=>new WeakRef(n)));
 await page.locator('.planet-sidebar-search').fill('Mars');await page.locator('.planet-object-browser a[href="/mars/"]:visible').click();
 await page.waitForFunction(()=>location.pathname==='/mars/'&&document.documentElement.dataset.ready==='true',null,{timeout:120000});const departed=await snapshot('mars-after-earth');
 assert.equal(departed.state.oldEarthConnected,0);assert.equal(departed.state.oldEarthAlive,0,'Persistent shell must not retain the departed scene');assert.equal(departed.state.blobs.length,0);assert.ok(!departed.state.images.some(i=>i.url.includes('/scenes/earth/')),'Departed Earth image handles must be released');assert.equal(departed.state.scenes,1);
 await page.locator('.planet-sidebar-search').fill('Earth');await page.locator('.planet-object-browser a[href="/earth/"]:visible').click();await page.waitForFunction(()=>location.pathname==='/earth/'&&document.documentElement.dataset.ready==='true',null,{timeout:120000});await snapshot('earth-globe-remount');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{
 if(tracing)await stopTrace().catch(e=>{report.traceError=e.stack;});
 report.scripts=[...new Map(fixture.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];for(const r of report.scripts)assert.equal(r.sha256,createHash('sha256').update(await readFile(resolve(built,'.'+r.path))).digest('hex'));
 await writeFile(resolve(output,'before-cleanup.json'),JSON.stringify(report,null,2)+'\n');
 for(const [label,close]of [['Context',()=>context?.close()],['Browser',()=>browser?.close()],['Fixture',()=>fixture.close()]]){try{await boundedClose(close(),label);}catch(e){(report.cleanupErrors??=[]).push(e.message);process.exitCode=1;}}
 report.closed=!report.cleanupErrors;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed??false,error:report.error,native:report.snapshots.map(({name,native})=>({name,...native}))}));
}
