import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';

const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const built=resolve(option('built-dir','dist')),output=resolve(option('output',`output/playwright/history-interruption-${Date.now()}`));
const record=option('record','true')==='true';
await mkdir(output,{recursive:true});
const definition=JSON.parse(await readFile('src/planets/earth/prepared/runtime.json'));
const catalog=JSON.parse(gunzipSync(await readFile(resolve(built,'.'+definition.destinations.catalog.url))));
const detailPath=id=>catalog.packs[catalog.entries.find(([key])=>key===id)[1]].url;
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),built,output,
  fixture:'Controlled delayed detail response and populated history entries; native browser Back drives the product router.',
  harnessSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[],errors:[]};
const fixture=await serveBuiltFixture(built);let browser;
const state=page=>page.evaluate(()=>({entity:document.querySelector('[data-entity-card]').dataset.entityId,
  lens:document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,
  busy:document.querySelector('[data-entity-card]').ariaBusy,
  status:document.querySelector('.planet-destination-status').hidden?'':document.querySelector('.planet-destination-status').textContent,
  hash:location.hash,view:new URL(location.href).searchParams.get('v'),url:location.href,
  scenes:document.querySelectorAll('.polycss-scene').length,
  retained:document.querySelector('.polycss-scene')===window.__historyScene,
  pushes:window.__historyPushes??[]}));
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});report.browser=browser.version();
 for(const dpr of [1,2])for(const [previous,target,lens] of [['earth','3435910','night-lights'],['3435910','1850147','buenos-aires-noise']]){
  const name=`dpr${dpr}-${previous}`,row={name,previous,target,dpr};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,
    ...(record?{recordVideo:{dir:output,size:{width:1440,height:1000}}}:{})});
  let release=()=>{};const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  try{
   await page.goto(`${fixture.url}/earth/#${previous==='earth'?'':`place=${previous}&`}lens=${lens}`);
   await page.waitForFunction(({id,lens})=>document.documentElement.dataset.ready==='true'&&
    document.querySelector('[data-entity-card]')?.dataset.entityId===id&&document.querySelector('[data-entity-card]').ariaBusy!=='true'&&
    document.querySelector('button[name="lens"][aria-pressed="true"]')?.value===lens,{id:previous,lens},{timeout:90000});
   // A cold default URL has no saved camera yet. Create one through input so
   // equality checks compare actual saved views, not null with a later token.
   await page.mouse.move(1000,500);await page.mouse.wheel(0,1);
   await page.waitForFunction(()=>new URL(location.href).searchParams.has('v'));
   let saved='',stableSince=Date.now();
   for(const start=Date.now();;){
    const value=new URL(page.url()).searchParams.get('v');
    if(value!==saved){saved=value;stableSince=Date.now();}
    if(Date.now()-stableSince>400)break;
    assert.ok(Date.now()-start<10000,'The saved view must settle before the history fixture');
    await page.waitForTimeout(50);
   }
   await page.evaluate(()=>{window.__historyScene=document.querySelector('.polycss-scene');});
   row.before=await state(page);
   const path=detailPath(target),body=await readFile(resolve(built,'.'+path));
   let notify;const held=new Promise(resolve=>{notify=resolve;}),gate=new Promise(resolve=>{release=resolve;});
   await context.route('**'+path,async route=>{
    row.heldUrl=route.request().url();notify();await gate;
    try{await route.fulfill({status:200,contentType:'application/octet-stream',body});}
    catch(e){row.deliveryAfterCancellation=e.message;}
   });
   // Populate previous/target/previous entries without changing camera or
   // selection. Back/Back then exercises restoration while details are pending.
   await page.evaluate(({target,name})=>{
    const current=location.href,url=new URL(current);url.hash=`place=${target}`;
    for(const [suffix,value]of [['target',url.href],['return',current]])history.pushState({cssEarthEntry:`history-fixture-${name}-${suffix}`,cssEarthView:value},'',value);
    window.__historyPushes=[];const push=history.pushState.bind(history);
    history.pushState=(state,title,url)=>{window.__historyPushes.push(String(url));return push(state,title,url);};
   },{target,name});
   await page.goBack();
   let timer;
   try{await Promise.race([held,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('No delayed detail request observed')),15000);})]);}
   finally{clearTimeout(timer);}
   await page.goBack();
   await page.waitForFunction(hash=>location.hash===hash,row.before.hash);
   release();
   await page.waitForTimeout(1200);
   row.after=await state(page);
   await page.screenshot({path:resolve(output,`${name}-after.png`)});
   assert.equal(row.after.entity,previous,'A late detail response must preserve the restored card');
   assert.equal(row.after.lens,lens);assert.equal(row.after.hash,row.before.hash);
   assert.equal(row.after.view,row.before.view,'Back must keep the exact saved camera');
   assert.deepEqual(row.after.pushes,[],'A stale restoration must not push a new entry');
   assert.equal(row.after.busy,'false');assert.equal(row.after.scenes,1);assert.ok(row.after.retained);
   assert.equal(row.after.status,'','Canceled navigation must not publish an unavailable-place message');
   row.passed=true;console.log(JSON.stringify({name,passed:true}));
  }finally{release();await context.close();row.video=await page.video()?.path();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{
 await browser?.close();await fixture.close();report.closed=true;
 report.scripts=[...new Map(fixture.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];
 for(const r of report.scripts)assert.equal(r.sha256,createHash('sha256').update(await readFile(resolve(built,'.'+r.path))).digest('hex'));
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,passed:report.passed??false,closed:report.closed,error:report.error}));
}
