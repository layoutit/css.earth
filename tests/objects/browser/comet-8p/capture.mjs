import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {runtimeAssets} from '../../../../tools/runtime-assets.mjs';
import {installRuntimeAssets} from '../../../../tools/setup.mjs';
// Run against a completed production build; serve fresh R2 bytes separately.
const origin=process.argv[2]??'http://127.0.0.1:53135',id='comet-8p',out=resolve('output/playwright/tuttle/final');
await mkdir(out,{recursive:true});
const files=await runtimeAssets(process.cwd(),[id]);
const stage=await mkdtemp(resolve(out,'fresh-assets-'));
const installation=await installRuntimeAssets(files.map(asset=>({...asset,file:resolve(stage,asset.filename)})));
assert.equal(installation.installed,files.length);assert.equal(installation.reused,0);
const delivery={stage,files};
const pins=new Map(delivery.files.map(a=>[a.filename,a]));
const hash=b=>createHash('sha256').update(b).digest('hex');
const payload=await readFile(`src/planets/${id}/prepared/object.json`);
const descriptor=JSON.parse(await readFile(`src/planets/${id}/object.json`));assert.equal(hash(payload),descriptor.prepared.sha256);
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
async function capture(base,dpr,{fresh=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(60000);
 const page=await context.newPage(),errors=[],pending=[],loaded=[],requests=[];
 context.on('request',r=>requests.push(r.url()));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 context.on('response',r=>{
  if(r.status()>=400)errors.push(r.status()+' '+r.url());
  const p=(async()=>{await r.finished();const sizes=await r.request().sizes();const pathname=new URL(r.url()).pathname;
   const decodedSha256=/\.(?:m?js)$|\/object\.[^/]+\.json$/.test(pathname)?hash(await r.body()):undefined;
   loaded.push({url:r.url(),status:r.status(),type:r.request().resourceType(),...sizes,...(decodedSha256?{decodedSha256}:{})});})();
  p.catch(()=>{});pending.push(p);
 });
 try{
  await page.goto(base+'/'+id+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true' && document.querySelector('.planet-stage')?.dataset.objectId==='comet-8p' && document.querySelectorAll('.comet-8p-body > u').length===1000);
  await page.waitForTimeout(350);await Promise.all(pending);
  const cold=loaded.slice(),coldRequests=requests.length;
  const transported=cold.find(r=>r.decodedSha256===hash(payload));assert.ok(transported,'The browser must load the exact prepared object bytes.');
  const details=page.locator('[data-lens-details="model"]');
  assert.equal(await details.locator('.planet-facts > li').count(),2);
  assert.equal(await details.locator('.planet-lens-details-copy').innerText(),'Two smooth spheres fitted to the observations. Surface detail is unknown, and the displayed rotation phase is illustrative.');
  assert.ok(!await page.evaluate(()=>!!window['__comet-8p']),'Use the production build.');
  const initial=await page.locator('.polycss-scene').evaluate(root=>{
   const leaves=[...document.querySelectorAll('.comet-8p-body > u')];window.__tuttleNodes={root,leaves,geometry:leaves.map(n=>['transform','width','height','background-position','background-size'].map(k=>n.style.getPropertyValue(k)))};
   return {leaves:leaves.length,atlas:[...new Set(leaves.map(n=>getComputedStyle(n).backgroundImage))],dimensions:[...new Set(leaves.map(n=>{const s=getComputedStyle(n);return s.width+' × '+s.height}))]};
  });assert.equal(initial.leaves,1000);
  const inspectAtlases=async()=>{
   const urls=await page.locator('.comet-8p-body > u').evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).backgroundImage.match(/url\("?([^"\)]+)/)[1]))]);
   const records=[];
   for(const url of urls){const response=await context.request.get(url),bytes=await response.body();assert.equal(response.status(),200);const filename=new URL(url).pathname.split('/').at(-1);assert.equal(hash(bytes),pins.get(filename)?.sha256);records.push({filename,bytes:bytes.length,sha256:hash(bytes)});}return records;
  };
  const shadows=await inspectAtlases();assert.ok(shadows.every(a=>a.filename.endsWith('-shadow@2x.webp')));
  const prefix=fresh?'fresh-runtime':`dpr-${dpr}`;
  await page.screenshot({path:resolve(out,prefix+'-shadows.png')});
  const settings=page.getByRole('button',{name:'Settings',exact:true});
  const settingsVisible=await settings.isVisible();
  if(settingsVisible){await settings.click();await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');}
  else await page.locator('input[name="shadows"]').evaluate(input=>input.click());
  await page.waitForLoadState('networkidle');await page.waitForTimeout(250);
  const flood=await inspectAtlases();assert.ok(flood.every(a=>a.filename.endsWith('-surface@2x.webp')));
  await page.screenshot({path:resolve(out,prefix+'-flood.png')});
  const incremental=loaded.slice(cold.length);
  const requestOffset=requests.length;
  const beforeFlight=await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);
  await page.mouse.dblclick(755,455,{delay:45});await page.waitForTimeout(1600);
  const afterFlight=await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);
  assert.notEqual(afterFlight,beforeFlight,'Double-clicking the nucleus must fly toward its surface.');
  await page.mouse.move(930,430);await page.mouse.down();await page.mouse.move(1130,505,{steps:45});await page.mouse.up();await page.waitForTimeout(800);
  await page.screenshot({path:resolve(out,prefix+'-turned.png')});
  await page.mouse.move(760,450);await page.mouse.wheel(0,-160);await page.waitForTimeout(800);
  await page.setViewportSize({width:820,height:900});await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const mobilePose=await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);
  await page.mouse.wheel(0,-160);await page.waitForTimeout(400);
  assert.equal(await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform),mobilePose,'Mobile wheel input must preserve the camera.');
  await page.screenshot({path:resolve(out,prefix+'-mobile.png')});
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(250);
  const interactionRequests=requests.slice(requestOffset);
  const state=await page.evaluate(()=>{
   const p=window.__tuttleNodes,root=document.querySelector('.polycss-scene'),leaves=[...document.querySelectorAll('.comet-8p-body > u')];
   return {retained:root===p.root&&leaves.length===p.leaves.length&&leaves.every((n,i)=>n===p.leaves[i]),geometryRetained:leaves.every((n,i)=>['transform','width','height','background-position','background-size'].every((k,j)=>n.style.getPropertyValue(k)===p.geometry[i][j])),scenes:document.querySelectorAll('.polycss-scene').length,forbiddenElements:document.querySelectorAll('.planet-stage canvas,.planet-stage svg').length,forbiddenStyles:leaves.some(n=>{const s=getComputedStyle(n);return s.clipPath!=='none'||s.maskImage!=='none'||s.filter!=='none'||s.mixBlendMode!=='normal'||/gradient\(/.test(s.backgroundImage)}),lensFacts:document.querySelector('.planet-lens-legend-panel')?.innerText??null};
  });
  assert.ok(state.retained&&state.geometryRetained);assert.equal(state.scenes,1);assert.equal(state.forbiddenElements,0);assert.equal(state.forbiddenStyles,false);assert.deepEqual(errors,[]);assert.deepEqual(interactionRequests,[]);
  await Promise.all(pending);
  const totals=rows=>({responses:rows.length,bodyBytes:rows.reduce((n,r)=>n+r.responseBodySize,0),headerBytes:rows.reduce((n,r)=>n+r.responseHeadersSize,0)});
  return {dpr,fresh,lightingAccess:settingsVisible?'Visible settings control':'Existing input binding exercised programmatically; current shared shell hides Settings.',transportedPrepared:{url:transported.url,sha256:transported.decodedSha256},surfaceFlight:true,mobileWheelPreserved:true,route:base+'/'+id+'/',initial,shadows,flood,...state,errors,interactionRequests,cold:{...totals(cold),requests:coldRequests,includes:'HTML, JavaScript, CSS, prepared JSON, workers, shared shell and scene images, as observed by BrowserContext response events.',responses:cold},lightingToggle:{...totals(incremental),responses:incremental},preparedSha256:hash(payload)};
 }finally{await context.close()}
}
let server;
try{
 for(const dpr of [1,2])reports.push(await capture(origin,dpr));
 const served=[];
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/scenes/'+id+'/')){
    const filename=url.pathname.slice(('/scenes/'+id+'/').length);const pin=pins.get(filename);assert.ok(pin,'Every scene request must belong to the fresh runtime inventory.');
    const bytes=await readFile(resolve(delivery.stage,filename));assert.equal(hash(bytes),pin.sha256);served.push(filename);
    res.writeHead(200,{'Content-Type':filename.endsWith('.png')?'image/png':'image/webp','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
   }else{
    const upstream=await fetch(origin+url.pathname+url.search);const bytes=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
   }
  }catch(e){res.writeHead(500);res.end(String(e));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const fresh=await capture('http://127.0.0.1:'+server.address().port,1,{fresh:true});fresh.freshSourceDirectory=delivery.stage;fresh.freshFilesServed=[...new Set(served)].sort();fresh.cold.qualification='Fixture proxy transport; production transfer is measured separately above.';
 assert.ok(fresh.freshFilesServed.includes('comet-8p-model-shadow@2x.webp')&&fresh.freshFilesServed.includes('comet-8p-model-surface@2x.webp'));
 reports.push(fresh);
 await writeFile(resolve(out,'report.json'),JSON.stringify({browser:browser.version(),capturedAt:new Date().toISOString(),viewport:{width:1440,height:900},freshInstallation:{stage,...installation,bytes:files.reduce((n,a)=>n+a.bytes,0)},reports},null,2)+'\n');
 console.log(JSON.stringify(reports.map(r=>({dpr:r.dpr,fresh:r.fresh,retained:r.retained,coldBodyBytes:r.cold.bodyBytes,lightingBodyBytes:r.lightingToggle.bodyBytes,freshFiles:r.freshFilesServed?.length}))));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
