import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {cpus,totalmem} from 'node:os';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
import {WHEEL_ZOOM_SPEED_MULTIPLIER} from '../../../../site/runtime-policy.mjs';

const option=(key,fallback)=>process.argv.find(arg=>arg.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const dpr=Number(option('dpr','1')), cycles=Number(option('cycles','2'));
const journey=option('journey',cycles===0?'first-city-visit':'extended-exploration');
assert.ok(['first-city-visit','extended-exploration','polar-exploration','continuous-exploration'].includes(journey));
const viewport={width:Number(option('width','1440')),height:Number(option('height','1000'))};
const touch=option('touch',String(viewport.width<=820||viewport.width<viewport.height))==='true';
assert.ok(Number.isInteger(viewport.width)&&viewport.width>=800&&viewport.width<=1920&&Number.isInteger(viewport.height)&&viewport.height>=600&&viewport.height<=1400);
const cpuRate=Number(option('cpu-rate','1')),networkProfile=option('network','none');
assert.ok([1,2,4,6].includes(cpuRate)&&['none','constrained-broadband'].includes(networkProfile));
const emulatedNetwork=networkProfile==='none'?null:{offline:false,latency:150,downloadThroughput:10_000_000/8,uploadThroughput:1_000_000/8,connectionType:'other'};
const record=option('record','true')==='true', trace=option('trace','true')==='true';
const screenshots=option('screenshots','true')==='true', memoryDumps=trace&&option('memory-dumps','true')==='true';
const memoryCheckpointNames=option('memory-checkpoints','all').split(',');
assert.ok(memoryCheckpointNames.every(name=>/^[a-z0-9-]+$/.test(name)));
const traceKind=option('trace-kind','memory');assert.ok(['memory','timeline'].includes(traceKind));
const chromeGraphite=option('chrome-graphite','default'),gpuDetail=option('trace-gpu-detail','false')==='true';
const diagnosticVolumeClip=option('diagnostic-volume-clip','false')==='true';
assert.ok(['default','disabled'].includes(chromeGraphite));
assert.ok(!gpuDetail||(trace&&traceKind==='timeline'),'GPU detail requires a timeline trace');
const traceFrom=option('trace-from','startup'),traceUntil=option('trace-until','final');
assert.ok(/^[a-z0-9-]+$/.test(traceFrom)&&/^[a-z0-9-]+$/.test(traceUntil));
assert.ok(!memoryDumps||(traceFrom==='startup'&&traceUntil==='final'),'Phase-limited traces require --memory-dumps=false');
assert.ok([1,2].includes(dpr)&&Number.isInteger(cycles)&&cycles>=0&&cycles<=6);
const built=resolve(option('built','dist')), output=resolve(option('output',`output/playwright/exploration-dpr${dpr}-${Date.now()}`));
const cameraPlan=JSON.parse(await readFile('src/planets/earth/prepared/runtime.json')).camera;
await mkdir(output,{recursive:true});
const harnessSource=await readFile(new URL(import.meta.url));
await writeFile(resolve(output,'captured-harness.mjs'),harnessSource);
const fixture=await serveBuiltFixture(built);
const browser=await chromium.launch({channel:'chrome',headless:true,args:[...fixture.launchArgs,
  ...(chromeGraphite==='disabled'?['--disable-skia-graphite']:[])]});
const context=await browser.newContext({viewport,deviceScaleFactor:dpr,hasTouch:touch,...(record?{recordVideo:{dir:output,size:viewport}}:{})});
const page=await context.newPage(), cdp=await context.newCDPSession(page), browserCdp=await browser.newBrowserCDPSession();
let mergeHead=null;
try{mergeHead=execFileSync('git',['rev-parse','MERGE_HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{}
const report={schema:'cssearth-exploration@1',output,built,dpr,cycles,record,trace,screenshots,memoryDumps,memoryCheckpointNames,traceKind,traceFrom,traceUntil,
  journey,
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  mergeHead,
  harnessSha256:createHash('sha256').update(harnessSource).digest('hex'),
  environment:{browser:browser.version(),cpu:cpus()[0].model,cores:cpus().length,memory:totalmem(),viewport,
    chromeGraphite,gpuDetail,diagnosticVolumeClip,
    emulation:{cpuRate,networkProfile,network:emulatedNetwork,applied:'Before initial navigation; reapplied after offline recovery'},
    transport:'Local HTTPS production build, normal browser cache, real public assets; no response routes or application camera writes',
    input:touch?'Emulated Chrome touch pinch and drag on the map; mouse/keyboard card controls and wheel page scrolling. Pinch spans stay between 120 and 240 CSS pixels.'
      :'Paced scripted Chrome mouse/keyboard; driver wheel deltas multiplied by emulated DPR to deliver the same CSS-pixel gesture',
    qualification:`Not a physical trackpad, phone or native-renderer parity measurement.${chromeGraphite==='disabled'?' Non-default Chrome graphics backend: diagnostic only, not default-browser qualification.':''}${diagnosticVolumeClip?' Injected viewport clipping on volume projections: diagnostic candidate, not unchanged-build qualification.':''}`},
  visualStatus:screenshots||record?'unreviewed':'not-recorded',
  observers:{sampleIntervalMs:250,screenshots,memoryDumps,video:record,
    frameQualification:screenshots||memoryDumps?'Includes intrusive screenshot/memory-dump checkpoints; measure their overhead separately':'No screenshot, memory-dump or video observer when record=false'},
  actions:[],checkpoints:[],errors:[],consoleErrors:[],network:[]};
await context.addInitScript(()=>{
  const p=window.__exploration={phase:'startup',frames:[],tasks:[],samples:[],wheels:[],marks:[],blobs:[],live:new Map(),decodes:[],pendingDecodes:0,searches:[]};
  // Measure the actual input event through the next callback with completed
  // result rows. Keep superseded queries, misses and failures in the receipt.
  let pendingSearch=null;
  document.addEventListener('input',event=>{
    if(!event.target.matches?.('.planet-sidebar-search'))return;
    if(pendingSearch?.outcome==='pending')pendingSearch.outcome='superseded';
    pendingSearch={query:event.target.value,at:performance.now(),phase:p.phase,trusted:event.isTrusted,outcome:'pending'};
    p.searches.push(pendingSearch);
  },true);
  document.addEventListener('DOMContentLoaded',()=>{
    const root=document.querySelector('.planet-destination-results');if(!root)return;
    new MutationObserver(()=>{
      const query=pendingSearch;if(!query||query.outcome!=='pending'||query.scheduled||root.closest('[hidden]'))return;
      const hint=root.querySelector('.planet-destination-hint')?.textContent;
      if(hint!=='Places'&&!hint?.startsWith('No matching places.')&&!hint?.startsWith('Places could not load.'))return;
      query.readyAt=performance.now();query.scheduled=true;
      const results=[...root.querySelectorAll('[data-destination-id]')].filter(node=>!node.closest('[hidden]')).map(node=>node.dataset.destinationId);
      requestAnimationFrame(()=>{
        if(pendingSearch!==query||query.outcome!=='pending')return;
        query.callbackAt=performance.now();query.inputToCallbackMs=query.callbackAt-query.at;
        query.outcome=hint==='Places'?'results':hint.startsWith('No matching')?'empty':'failed';query.results=results;
      });
    }).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  },{once:true});
  let previous,previousCallback,baseline=null;
  const frame=at=>{const callbackAt=performance.now();if(previous!==undefined)p.frames.push({at,ms:at-previous,callbackAt,callbackMs:callbackAt-previousCallback,visibility:document.visibilityState,phase:p.phase});previous=at;previousCallback=callbackAt;requestAnimationFrame(frame)};
  requestAnimationFrame(frame);
  new PerformanceObserver(list=>{for(const e of list.getEntries())p.tasks.push({at:e.startTime,ms:e.duration,phase:p.phase})}).observe({type:'longtask',buffered:true});
  addEventListener('wheel',e=>p.wheels.push({at:performance.now(),deltaY:e.deltaY,phase:p.phase,sceneTarget:!!e.target.closest?.('.planet-input-surface'),trusted:e.isTrusted}),{passive:true});
  p.touches=[];
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])addEventListener(type,e=>{
    if(e.pointerType==='touch')p.touches.push({type,at:performance.now(),phase:p.phase,pointerId:e.pointerId,
      sceneTarget:!!e.target.closest?.('.planet-input-surface'),trusted:e.isTrusted});
  },{capture:true,passive:true});
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL,decode=HTMLImageElement.prototype.decode;
  URL.createObjectURL=function(blob){const url=create.call(this,blob);p.live.set(url,blob.size);p.blobs.push({kind:'create',at:performance.now(),url,bytes:blob.size});return url};
  URL.revokeObjectURL=function(url){p.live.delete(url);p.blobs.push({kind:'revoke',at:performance.now(),url});return revoke.call(this,url)};
  HTMLImageElement.prototype.decode=function(){
    const row={url:this.src,at:performance.now(),phase:p.phase};p.pendingDecodes++;
    return decode.call(this).then(value=>{row.width=this.naturalWidth;row.height=this.naturalHeight;return value},error=>{row.error=String(error);throw error})
      .finally(()=>{row.end=performance.now();p.pendingDecodes--;p.decodes.push(row)});
  };
  p.mark=name=>{p.phase=name;p.marks.push({name,at:performance.now()});performance.mark(`exploration:${name}`)};
  p.state=(checkIdentity=false)=>{
    const card=document.querySelector('[data-entity-card]'),stage=document.querySelector('.planet-stage');
    const leaves=[...document.querySelectorAll('[data-city-page]')];
    let stable=null;
    if(checkIdentity&&stage){const nodes=[...stage.querySelectorAll('*')];baseline??=nodes;stable=baseline.length===nodes.length&&baseline.every((node,i)=>node===nodes[i])}
    return {at:performance.now(),phase:p.phase,url:location.href,ready:document.documentElement.dataset.ready,
      emptyObjectCardVisible:(()=>{const system=document.querySelector('[data-solar-system-results]');return Boolean(system&&!system.closest('[hidden]')&&
        ![...system.querySelectorAll('.planet-object-item')].some(item=>!item.closest('[hidden]')))})(),
      entity:card?.dataset.entityId,kind:card?.dataset.entityKind,busy:card?.ariaBusy,title:card?.querySelector('h1')?.ariaLabel,
      introduction:card?.querySelector('.planet-introduction')?.textContent,introductionState:card?.dataset.introductionState,introductionSource:card?.dataset.introductionSource,
      parents:[...document.querySelectorAll('[data-entity-parent]')].filter(e=>!e.parentElement.hidden).map(e=>({id:e.dataset.entityParent,name:e.textContent})),
      lenses:[...document.querySelectorAll('button[name="lens"]')].filter(e=>!e.closest('[hidden]')).map(e=>({id:e.value,pressed:e.ariaPressed,disabled:e.disabled})),
      pages:leaves.filter(e=>e.style.visibility==='visible').map(e=>({key:e.dataset.cityPage,zIndex:e.style.zIndex})),retainedPages:leaves.length,
      sceneCount:document.querySelectorAll('.polycss-scene').length,stable,blobCount:p.live.size,blobBytes:[...p.live.values()].reduce((a,b)=>a+b,0),pendingDecodes:p.pendingDecodes,
      transform:document.querySelector('.polycss-scene')?.style.transform,diagnosticsAbsent:!window.__earth,
      status:[...document.querySelectorAll('[data-geographic-status],.planet-destination-status')].filter(e=>!e.closest('[hidden]')).map(e=>e.textContent.trim()).join(' ')};
  };
  setInterval(()=>p.samples.push(p.state()),250);
});
await cdp.send('Network.enable');await cdp.send('Performance.enable');
if(cpuRate!==1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
const applyNetwork=async()=>{if(emulatedNetwork)await cdp.send('Network.emulateNetworkConditions',emulatedNetwork)};
await applyNetwork();
const setOffline=async offline=>{
  await context.setOffline(offline);
  // This CDP session also owns bandwidth emulation. Keep it in the same state
  // as Playwright's context session, including its worker targets.
  if(emulatedNetwork)await cdp.send('Network.emulateNetworkConditions',{...emulatedNetwork,offline});
  if(offline){
    const probe=await page.evaluate(async()=>{
      try{await fetch(`/favicon.ico?offline-probe=${Date.now()}`,{cache:'no-store'});return {online:navigator.onLine,rejected:false}}
      catch{return {online:navigator.onLine,rejected:true}}
    });
    report.offlineProbe=probe;assert.equal(probe.rejected,true,'Offline emulation must reject an uncached local request');
  }
};
const requests=new Map(),contextRequests=new Map(),started=Date.now();let phase='startup',tracing=false;
const relative=()=>Date.now()-started;
// Playwright follows dedicated-worker sessions. Page-level CDP misses their
// fetches and can leave the worker bootstrap request without a terminal event.
// Preserve that raw CDP log for byte/cache accounting, but use the reconciled
// context lifecycle to report which requests are actually pending.
context.on('request',request=>contextRequests.set(request,{id:contextRequests.size,url:request.url(),at:relative(),phase,type:request.resourceType()}));
context.on('response',response=>{const row=contextRequests.get(response.request());if(row)Object.assign(row,{status:response.status(),responseAt:relative()})});
context.on('requestfinished',request=>{const row=contextRequests.get(request);if(row)row.end=relative()});
context.on('requestfailed',request=>{const row=contextRequests.get(request);if(row)Object.assign(row,{end:relative(),error:request.failure()?.errorText})});
const startTrace=async()=>{
  const extraCategories=gpuDetail?(await browserCdp.send('Tracing.getCategories')).categories.filter(name=>/dawn|skia/i.test(name)):[];
  report.extraTraceCategories=extraCategories;
  await cdp.send('Tracing.start',{traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:262144,
    excludedCategories:['*'],includedCategories:['blink.user_timing',...(memoryDumps?['disabled-by-default-memory-infra']:[]),
      ...(traceKind==='timeline'?['toplevel','devtools.timeline','disabled-by-default-devtools.timeline.frame','cc','viz','gpu','renderer.scheduler',...extraCategories]:[])]},
    transferMode:'ReturnAsStream',streamFormat:'json'});
  tracing=true;report.traceStartedAt=relative();
};
const stopTrace=async()=>{
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const result=await done;
  tracing=false;report.traceStoppedAt=relative();
  const path=resolve(output,'trace.json.gz'),zip=createGzip(),file=createWriteStream(path);zip.pipe(file);
  for(;;){const chunk=await cdp.send('IO.read',{handle:result.stream,size:1048576});if(!zip.write(Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8')))await once(zip,'drain');if(chunk.eof)break}
  zip.end();await once(file,'finish');await cdp.send('IO.close',{handle:result.stream});report.traceFile=path;report.traceDataLoss=result.dataLossOccurred;
};
cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{id:e.requestId,url:e.request.url,at:relative(),phase,type:e.type,range:e.request.headers.Range??null}));
cdp.on('Network.responseReceived',e=>{const row=requests.get(e.requestId);if(row)Object.assign(row,{status:e.response.status,responseAt:relative(),cached:!!e.response.fromDiskCache,protocol:e.response.protocol})});
cdp.on('Network.loadingFinished',e=>{const row=requests.get(e.requestId);if(row)Object.assign(row,{end:relative(),bytes:e.encodedDataLength})});
cdp.on('Network.loadingFailed',e=>{const row=requests.get(e.requestId);if(row)Object.assign(row,{end:relative(),error:e.errorText,canceled:e.canceled})});
page.on('pageerror',e=>report.errors.push({at:relative(),phase,message:e.message}));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({at:relative(),phase,message:m.text()})});
const mark=async name=>{
  if(trace&&!tracing&&!report.traceFile&&name===traceFrom)await startTrace();
  phase=name;await page.evaluate(name=>window.__exploration.mark(name),name);
  if(tracing&&traceUntil!=='final'&&name===traceUntil)await stopTrace();
};
const state=()=>page.evaluate(()=>window.__exploration.state(true));
const action=async(name,run)=>{
  await mark(name);const row={name,at:relative(),before:await state()};report.actions.push(row);
  row.pendingBefore=[...contextRequests.values()].filter(r=>r.end===undefined&&/city-|wmts|worldcover/i.test(r.url)).map(r=>r.url);
  try{await run();row.ok=true}catch(error){row.ok=false;row.error=String(error);throw error}
  finally{row.end=relative();row.after=await state();
    row.transportOverlap=[...contextRequests.values()].filter(r=>/city-|wmts|worldcover/i.test(r.url)&&r.at<row.end&&(r.end===undefined||r.end>row.at)).map(r=>r.url)}
};
const look=ms=>page.waitForTimeout(ms);
const search=page.getByRole('searchbox',{name:'Search objects and places'});
const select=async(name,id)=>{
  await search.click({clickCount:3,delay:100});await search.pressSequentially(name,{delay:85});
  await page.locator(`[data-destination-id="${id}"]:visible`).click({timeout:15000,delay:100});
};
const lens=async id=>page.locator(`button[name="lens"][value="${id}"]:visible`).click({timeout:15000,delay:100});
let pointer={x:930,y:500};
const sceneHit=point=>page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.planet-input-surface'),point);
const revealScene=async()=>{
  // On portrait layouts, reading a card scrolls the document. Return to the
  // map with ordinary wheel input before aiming at its current screen bounds.
  for(let step=0;step<8;step++){
    const scroll=await page.evaluate(()=>{
      if(scrollY<=1)return null;
      for(const y of [innerHeight*.6,innerHeight*.4,innerHeight*.8])for(const x of [innerWidth*.5,innerWidth*.8]){
        if(document.elementFromPoint(x,y)?.closest('.planet-sidebar'))return {x,y,from:scrollY};
      }
      throw new Error('No visible information panel to scroll back from.');
    });
    if(!scroll)break;
    await page.mouse.move(scroll.x,scroll.y,{steps:8});
    await page.mouse.wheel(0,-Math.min(700,scroll.from+80)*dpr);await look(200);
    const to=await page.evaluate(()=>scrollY);
    (report.actions.at(-1).documentScrolls??=[]).push({from:scroll.from,to});
    assert.ok(to<scroll.from,'Wheel input over the information panel must reveal the map');
  }
  pointer=await page.evaluate(()=>{
    const r=document.querySelector('.polycss-camera').getBoundingClientRect();
    return {x:Math.min(innerWidth-190,r.left+r.width/2+40),y:r.top+r.height/2};
  });
  assert.ok(await sceneHit(pointer),'The gesture must start on the visible map input surface');
};
const drag=async(dx,dy=20)=>{
  await revealScene();
  assert.ok(await sceneHit({x:pointer.x+dx,y:pointer.y+dy}),'The drag must finish on the visible map');
  const before=(await state()).transform;
  if(touch){
    const point=(x,y)=>[{id:1,x,y,radiusX:4,radiusY:4,force:1}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(pointer.x,pointer.y)});await look(90);
    for(let i=1;i<=30;i++){const t=(1-Math.cos(Math.PI*i/30))/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(pointer.x+dx*t,pointer.y+dy*t)});await look(28);}
    await look(90);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.notEqual((await state()).transform,before,'The touch drag must actually move the camera');
    return;
  }
  await page.mouse.move(pointer.x,pointer.y,{steps:12});await page.mouse.down();await look(90);
  for(let i=1;i<=30;i++){const t=(1-Math.cos(Math.PI*i/30))/2;await page.mouse.move(pointer.x+dx*t,pointer.y+dy*t);await look(28)}
  await look(90);await page.mouse.up();
  assert.notEqual((await state()).transform,before,'The drag must actually move the camera');
};
const wheel=async(total,steps=20)=>{
  await revealScene();const before=(await state()).transform;
  if(touch){
    const first=await page.evaluate(()=>window.__exploration.touches.length);
    const gestures=Math.ceil(Math.abs(total/400)/Math.log(2)),scale=Math.exp(-total/400/gestures);
    const startSpan=scale>1?120:240,endSpan=startSpan*scale;
    for(const dx of [-120,120])assert.ok(await sceneHit({x:pointer.x+dx,y:pointer.y}),'Both pinch points must hit the map');
    const points=span=>[1,2].map((id,i)=>({id,x:pointer.x+(i?1:-1)*span/2,y:pointer.y,radiusX:4,radiusY:4,force:1}));
    for(let gesture=0;gesture<gestures;gesture++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(startSpan)});await look(90);
      for(let i=1;i<=steps;i++){const t=(1-Math.cos(Math.PI*i/steps))/2;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(startSpan+(endSpan-startSpan)*t)});await look(35);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await look(120);
    }
    const delivered=await page.evaluate(first=>window.__exploration.touches.slice(first),first);
    assert.ok(delivered.length>0&&delivered.every(event=>event.trusted&&event.sceneTarget),'Pinch input must reach the map');
    assert.ok(delivered.every(event=>event.type!=='pointercancel'),'The browser must not take over map pinch');
    assert.notEqual((await state()).transform,before,'Pinch must actually move the camera');
    return;
  }
  const first=await page.evaluate(()=>window.__exploration.wheels.length);
  await page.mouse.move(pointer.x,pointer.y,{steps:12});
  const weights=Array.from({length:steps},(_,i)=>Math.sin(Math.PI*(i+1)/(steps+1))),sum=weights.reduce((a,b)=>a+b,0);
  for(const weight of weights){await page.mouse.wheel(0,total*weight/sum*dpr);await look(55)}
  const delivered=await page.evaluate(first=>window.__exploration.wheels.slice(first),first);
  assert.ok(delivered.length>0&&delivered.every(event=>event.trusted&&event.sceneTarget),'Zoom input must reach the map');
  assert.notEqual((await state()).transform,before,'The zoom gesture must actually move the camera');
};
// Express the new journey in visible scale changes. Old wheel packet totals
// were calibrated around the enclosing-sphere bug and are unsuitable here.
const zoom=scale=>wheel(-Math.log(scale)*(touch?400:1/(cameraPlan.dolly.wheelStepPerDelta*WHEEL_ZOOM_SPEED_MULTIPLIER)),20);
const checkpoint=async name=>{
  await mark(`checkpoint-${name}`);
  const row={name,at:relative(),state:await state(),heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters')};
  if(memoryDumps&&(memoryCheckpointNames.includes('all')||memoryCheckpointNames.includes(name))){
    await mark(`memory-${name}-start`);
    row.memoryDump=await browserCdp.send('Tracing.requestMemoryDump',{levelOfDetail:'detailed'});
    await mark(`memory-${name}-end`);
  }
  row.pendingRequests=[...contextRequests.values()].filter(r=>r.end===undefined).map(r=>({url:r.url,age:relative()-r.at}));
  row.unresolvedPageNetworkEvents=[...requests.values()].filter(r=>r.end===undefined).map(r=>({url:r.url,age:relative()-r.at}));
  row.workerTargets=page.workers().map(worker=>worker.url());
  report.checkpoints.push(row);if(screenshots)await page.screenshot({path:resolve(output,`${name}.png`)});
  await writeFile(resolve(output,'progress.json'),JSON.stringify({checkpoint:row,actions:report.actions.length,errors:report.errors},null,2));
  console.log(JSON.stringify({checkpoint:name,entity:row.state.entity,pages:row.state.pages.length,pending:row.pendingRequests.length,elapsed:relative(),output}));
  assert.equal(row.state.stable,true);assert.equal(row.state.sceneCount,1);assert.equal(row.state.diagnosticsAbsent,true);
  assert.equal(row.state.emptyObjectCardVisible,false,'Search must not show an empty Solar System card');
  assert.ok(row.state.retainedPages<=544);
};
const assertOwner=async id=>{
  // Await the requested card's asynchronous record, not imagery or flight.
  await page.waitForFunction(id=>document.querySelector('[data-entity-card]')?.dataset.entityId===id,id,{timeout:15000});
  const s=await state();assert.equal(s.entity,id);
  const allowed=id==='earth'?['normal','night-lights']:id==='3435910'?['normal','buenos-aires-noise']:['normal'];
  assert.deepEqual(s.lenses.map(l=>l.id),allowed);
};
const arrive=async id=>{
  // Follow the visible flight to its destination, then interact immediately.
  // A selected card alone does not prove arrival: an interrupted flight may
  // leave that card above an unrelated ocean. Do not await imagery or tiles.
  const startedAt=relative();
  await page.waitForFunction(id=>{
    const card=document.querySelector('[data-entity-card]');
    const status=card?.querySelector('.planet-destination-status');
    return card?.dataset.entityId===id&&card.ariaBusy==='false'&&status?.hidden&&status.textContent==='';
  },id,{timeout:12000});
  const arrived=await state();
  (report.arrivals??=[]).push({id,startedAt,at:relative(),state:arrived,
    pendingRequests:[...contextRequests.values()].filter(r=>r.end===undefined).map(r=>r.url)});
  await assertOwner(id);
};
try{
  if(trace&&traceFrom==='startup')await startTrace();
  await page.goto(`${fixture.url}/earth/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:180000});
  if(diagnosticVolumeClip){
    report.diagnosticStyle='.css-volume-projection { overflow: clip !important; }';
    await page.addStyleTag({content:report.diagnosticStyle});
    report.diagnosticVolumeRoots=await page.locator('.css-volume-projection').count();
    assert.equal(report.diagnosticVolumeRoots,3);
  }
  pointer=await page.evaluate(()=>{const r=document.querySelector('.polycss-camera').getBoundingClientRect();return {x:Math.min(innerWidth-190,r.left+r.width/2+40),y:r.top+r.height/2}});
  report.pointer=pointer;
  await look(1800);await checkpoint('globe');
  if(journey==='continuous-exploration'){
    await action('correct-search',async()=>{
      await search.click({clickCount:3,delay:100});await search.pressSequentially('Buneos',{delay:90});
      await look(350);await search.press('ControlOrMeta+A');await search.pressSequentially('Buenos Aires',{delay:85});
      await page.locator('[data-destination-id="3435910"]:visible').click({delay:100});
    });
    await arrive('3435910');await action('zoom-during-arrival',()=>zoom(1.2));
    await action('drag-during-arrival',()=>drag(90,-20));
    await action('noise-during-arrival',()=>lens('buenos-aires-noise'));
    await look(400);await action('visible-during-arrival',()=>lens('normal'));
    await checkpoint('arrival-interrupted');
    for(let cycle=1;cycle<=cycles;cycle++){
      await action(`${cycle}-tokyo`,()=>select('Tokyo','1850147'));
      if(cycle===1){
        await look(600);
        await action(`${cycle}-interrupt-with-polar-destination`,async()=>{
          const a=(await state()).transform;await look(150);const b=(await state()).transform;
          assert.notEqual(a,b,'Destination replacement must interrupt a moving flight');
          await select('Longyearbyen','2729907');
        });
        await look(450);await action('interrupt-flight-with-pan',()=>drag(60,0));
        await action('resume-polar-flight',()=>select('Longyearbyen','2729907'));
      }else{
        await arrive('1850147');await action(`${cycle}-tokyo-pan`,()=>drag(70,-15));
        await action(`${cycle}-polar-destination`,()=>select('Longyearbyen','2729907'));
      }
      await arrive('2729907');await action(`${cycle}-polar-zoom`,()=>zoom(1.2));
      await action(`${cycle}-polar-drag`,()=>drag(100,40));
      await action(`${cycle}-polar-reverse`,()=>zoom(1/1.2));await assertOwner('2729907');
      await checkpoint(`${cycle}-polar`);
      await action(`${cycle}-suva`,()=>select('Suva','2198148'));await arrive('2198148');
      await action(`${cycle}-dateline-zoom`,()=>zoom(1.15));
      await action(`${cycle}-dateline-drag`,()=>drag(-120,-15));await assertOwner('2198148');
      await checkpoint(`${cycle}-dateline`);
      await action(`${cycle}-apia`,()=>select('Apia','4035413'));await arrive('4035413');
      await action(`${cycle}-history-back`,()=>page.goBack({waitUntil:'domcontentloaded'}));await assertOwner('2198148');
      await action(`${cycle}-history-forward`,()=>page.goForward({waitUntil:'domcontentloaded'}));await assertOwner('4035413');
      await checkpoint(`${cycle}-revisit`);
      if(cycle===1){
        await action('network-offline',()=>setOffline(true));
        await action('select-uncached-place-offline',()=>select('Ushuaia','3833367'));
        await action('pan-while-offline',()=>drag(70,10));
        await page.waitForFunction(()=>document.querySelector('.planet-destination-hint')?.textContent.includes('This place could not open'),null,{timeout:15000});
        report.offlineFeedback=await page.locator('.planet-destination-hint').textContent();
        await checkpoint('offline');
        await action('network-restored',()=>setOffline(false));
        await action('retry-place',()=>select('Ushuaia','3833367'));await arrive('3833367');
        report.recoveredEntity=(await state()).entity;
        await action('zoom-after-recovery',()=>zoom(1.1));
      }
      await action(`${cycle}-return-city`,()=>select('Buenos Aires','3435910'));await arrive('3435910');
      await action(`${cycle}-city-revisit-zoom`,()=>zoom(1.1));
      await action(`${cycle}-city-revisit-pan`,()=>drag(80,-20));
      await action(`${cycle}-noise-revisit`,()=>lens('buenos-aires-noise'));await look(350);
      await action(`${cycle}-province`,()=>page.locator('[data-entity-parent="admin1:3433955"]').click());await assertOwner('admin1:3433955');
      if(cycle>1)await arrive('admin1:3433955');
      await action(`${cycle}-country`,()=>page.locator('[data-entity-parent="country:AR"]').click());await assertOwner('country:AR');
      if(cycle>1)await arrive('country:AR');
      await action(`${cycle}-earth`,()=>page.locator('[data-entity-parent="earth"]').click());await assertOwner('earth');
      // Root reset currently has no visible flight status; its accepted
      // duration is 4.5 seconds. The first cycle keeps the rapid-change case.
      if(cycle>1)await look(4500);
      await action(`${cycle}-night-lights`,()=>lens('night-lights'));await look(600);
      await action(`${cycle}-visible-global`,()=>lens('normal'));await look(300);
    }
    await action('return-city-final',()=>select('Buenos Aires','3435910'));
    await action('noise-final',()=>lens('buenos-aires-noise'));
    report.imageLoadingGestures=report.actions.filter(a=>/zoom|drag|pan/.test(a.name)&&
      a.transportOverlap.some(url=>/\.(webp|png)(?:[?#]|$)|\/wmts\//i.test(url))).map(a=>a.name);
    assert.ok(report.imageLoadingGestures.length>=3,
      'At least three continuous gestures must overlap actual geographic image downloads');
  }else if(journey==='polar-exploration'){
    await action('select-northern-place',()=>select('Longyearbyen','2729907'));await look(6500);
    await action('northern-wider-view',()=>zoom(.5));await look(2200);
    await action('northern-pan',()=>drag(-180,160));await look(2200);await checkpoint('north-wide');
    await action('northern-closer-view',()=>zoom(1.5));await look(2200);await checkpoint('north-close');
    await action('northern-reversal',()=>zoom(1/1.5));await look(1800);
    await action('select-antarctica',()=>select('Antarctica','country:AQ'));await look(6500);await assertOwner('country:AQ');await checkpoint('south-arrival');
    for(let i=1;i<=3;i++){await action(`southern-closer-view-${i}`,()=>zoom(1.5));await look(1800)}
    await action('southern-pan',()=>drag(140,-90));await look(2400);await checkpoint('south-close');
    await action('southern-reversal',()=>zoom(1/1.5));await look(2200);
  }else if(journey==='first-city-visit'){
    await action('select-buenos-aires',()=>select('Buenos Aires','3435910'));
    await look(7000);
    for(let i=1;i<=3;i++){await action(`closer-look-${i}`,()=>zoom(1.2));await look(i===3?3500:1700)}
    await action('follow-river',()=>drag(150,-35));await look(3500);
    await action('noise',()=>lens('buenos-aires-noise'));await look(6000);await checkpoint('first-noise');await assertOwner('3435910');
    await action('compare-imagery',()=>lens('normal'));await look(3500);
    await action('compare-noise',()=>lens('buenos-aires-noise'));await look(4500);
  }else{
    await action('correct-search',async()=>{
      await search.click({clickCount:3,delay:100});
      await search.pressSequentially('Buneos',{delay:100});assert.equal(await search.inputValue(),'Buneos');
      await look(700);await search.press('ControlOrMeta+A');
      await search.pressSequentially('Buenos Aires',{delay:90});assert.equal(await search.inputValue(),'Buenos Aires');
      await page.locator('[data-destination-id="3435910"]:visible').click({delay:100});
    });
    await look(6500);await action('small-zoom',()=>zoom(1.2));await look(2000);
    await action('city-drag',()=>drag(-100));await look(1600);
    await action('noise',()=>lens('buenos-aires-noise'));await look(5000);await checkpoint('first-noise');await assertOwner('3435910');
  }
  for(let cycle=1;journey==='extended-exploration'&&cycle<=cycles;cycle++){
    await action(`${cycle}-province`,()=>page.locator('[data-entity-parent="admin1:3433955"]').click({delay:100}));
    await look(2600);await assertOwner('admin1:3433955');await checkpoint(`${cycle}-province`);
    await action(`${cycle}-country`,()=>page.locator('[data-entity-parent="country:AR"]').click({delay:100}));
    await look(2500);await assertOwner('country:AR');await checkpoint(`${cycle}-country`);
    await action(`${cycle}-tokyo`,()=>select('Tokyo','1850147'));await look(650);
    await action(`${cycle}-interrupt-with-polar-destination`,async()=>{
      const a=(await state()).transform;await look(200);const b=(await state()).transform;
      report.actions.at(-1).cameraMovingBeforeChange=a!==b;assert.notEqual(a,b,'The destination change must interrupt a moving camera');
      await select('Longyearbyen','2729907');
    });
    await look(6000);await action(`${cycle}-polar-zoom-out`,()=>zoom(.5));await look(1600);
    await action(`${cycle}-polar-drag`,()=>drag(140,-50));await look(2000);await assertOwner('2729907');await checkpoint(`${cycle}-polar`);
    await action(`${cycle}-suva`,()=>select('Suva','2198148'));await look(6200);
    await action(`${cycle}-dateline-zoom-out`,()=>zoom(.5));await look(1800);
    await action(`${cycle}-dateline-drag`,()=>drag(-180,-10));await look(2000);await checkpoint(`${cycle}-dateline`);
    await action(`${cycle}-dateline-reversal`,()=>zoom(1.5));await look(1600);
    await action(`${cycle}-apia`,()=>select('Apia','4035413'));await look(5500);await checkpoint(`${cycle}-apia`);
    await action(`${cycle}-return-city`,()=>select('Buenos Aires','3435910'));await look(6000);
    await action(`${cycle}-noise-revisit`,()=>lens('buenos-aires-noise'));await look(4000);await checkpoint(`${cycle}-revisit`);
    await action(`${cycle}-compare-visible`,()=>lens('normal'));await look(1600);
    await action(`${cycle}-history-back`,()=>page.goBack());await look(2400);await assertOwner('3435910');
    assert.equal((await state()).lenses.find(l=>l.pressed==='true')?.id,'buenos-aires-noise');
    await action(`${cycle}-history-forward`,()=>page.goForward());await look(2200);await assertOwner('3435910');
    assert.equal((await state()).lenses.find(l=>l.pressed==='true')?.id,'normal');
    if(cycle===1){
      await action('network-offline',()=>setOffline(true));
      await action('select-uncached-place-offline',()=>select('Ushuaia','3833367'));await look(4500);await checkpoint('offline');
      await action('network-restored',()=>setOffline(false));await look(600);
      await action('retry-place',()=>select('Ushuaia','3833367'));await look(6000);await assertOwner('3833367');await checkpoint('reconnected');
      await action('return-after-recovery',()=>select('Buenos Aires','3435910'));await look(5500);
    }
    await action(`${cycle}-end-noise`,()=>lens('buenos-aires-noise'));await look(3200);
  }
  await mark('final-consistency');await look(cycles===0?2500:10000);await checkpoint('final');
  await assertOwner(journey==='polar-exploration'?'country:AQ':'3435910');
  const final=report.checkpoints.at(-1).state;
  assert.equal(final.lenses.find(l=>l.pressed==='true')?.id,journey==='polar-exploration'?'normal':'buenos-aires-noise');
  assert.equal(final.pages.filter(p=>p.key.startsWith('noise-')).length,journey==='polar-exploration'?0:16);
  assert.deepEqual(report.errors,[]);report.functionalPassed=true;
}catch(error){report.functionalPassed=false;report.error=String(error);await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{})}
finally{
  const cleanup=name=>{const step={name,at:relative()};(report.cleanup??=[]).push(step);console.log(JSON.stringify({cleanup:step,output}))};
  cleanup('reset-network');
  await context.setOffline(false).catch(()=>{});
  if(tracing)await stopTrace();
  cleanup('capture-metrics');
  report.metrics=await page.evaluate(()=>{const p=window.__exploration;return {frames:p.frames,tasks:p.tasks,samples:p.samples,wheels:p.wheels,touches:p.touches,marks:p.marks,blobs:p.blobs,decodes:p.decodes,searches:p.searches}}).catch(()=>null);
  report.network=[...requests.values()];report.contextNetwork=[...contextRequests.values()];
  report.scripts=[...new Map(fixture.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];
  for(const script of report.scripts)assert.equal(script.sha256,createHash('sha256').update(await readFile(resolve(built,`.${script.path}`))).digest('hex'));
  // Read backend identity after the journey so inspection cannot warm its GPU
  // process before the measured cold arrival.
  cleanup('read-graphics');
  try{report.environment.graphics=(await browserCdp.send('SystemInfo.getInfo')).gpu}
  catch(error){report.environment.graphicsReadError=String(error)}
  // Preserve completed observations even if Chrome stalls during teardown.
  // Only the final write below may claim that cleanup completed.
  report.closed=false;
  try{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2))}
  catch(error){report.interimWriteError=String(error)}
  cleanup('close-context');await context.close();report.video=await page.video()?.path();
  cleanup('close-browser');await browser.close();
  cleanup('close-fixture');await fixture.close();report.closed=true;report.elapsed=relative();cleanup('complete');
  const intervals=(report.metrics?.frames??[]).map(f=>f.ms).sort((a,b)=>a-b);
  const interactive=(report.metrics?.frames??[]).filter(frame=>frame.phase!=='startup');
  const callbacks=interactive.map(frame=>frame.callbackMs).sort((a,b)=>a-b);
  const searchCallbacks=(report.metrics?.searches??[]).filter(query=>query.outcome==='results').map(query=>query.inputToCallbackMs).sort((a,b)=>a-b);
  report.summary={functionalPassed:report.functionalPassed,visualStatus:report.visualStatus,
    traceStatus:!trace?'not-recorded':!report.traceFile?'invalid-phase-not-reached':report.traceDataLoss?'invalid-data-loss':'captured-awaiting-analysis',
    actions:report.actions.length,frameCallbackIntervalP95:callbacks[Math.floor(callbacks.length*.95)],frameCallbackIntervalMax:callbacks.at(-1),frameCallbackIntervalsOver100:callbacks.filter(ms=>ms>100).length,searchResultCallbackP95:searchCallbacks[Math.floor(searchCallbacks.length*.95)],frameP95:intervals[Math.floor(intervals.length*.95)],worstFrame:intervals.at(-1),framesOver100:intervals.filter(ms=>ms>100).length,pageErrors:report.errors.length};
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report.summary,error:report.error}));
}
if(!report.functionalPassed)process.exitCode=1;
