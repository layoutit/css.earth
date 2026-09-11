import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import { required } from '../../../../tools/test-values.mts';
import { shape, array, text, number } from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import type { Request } from 'playwright';
type ResponseReceipt = Awaited<ReturnType<Request['sizes']>> & { url: string; status: number; type: string; decodedSha256?: string };
declare global { interface Window { __tuttleNodes: { root: Element; leaves: HTMLElement[]; geometry: string[][] }; __tuttleDeselects: number; __tuttleDeselectProbe: (event: Event) => void; } }
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {runtimeAssets} from '../../../../tools/runtime-assets.mts';
import {installRuntimeAssets} from '../../../../tools/setup.mts';
import {contactEllipsoidMesh} from '../../../../tools/objects/terrestrial-layers/contact-ellipsoids.mts';
import {BASE_TILE} from '@layoutit/polycss';
// Run against a completed production build; serve fresh R2 bytes separately.
const origin=process.argv[2]??'http://127.0.0.1:53135',id='comet-8p',out=resolve(process.argv[3]??'output/playwright/tuttle/arecibo');
await mkdir(out,{recursive:true});
const files=await runtimeAssets(process.cwd(),[id]);
const stage=await mkdtemp(resolve(out,'fresh-assets-'));
const installation=await installRuntimeAssets(files.map(asset=>({...asset,file:resolve(stage,asset.filename)})));
assert.equal(installation.installed,files.length);assert.equal(installation.reused,0);
const delivery={stage,files};
const pins=new Map(delivery.files.map(a=>[a.filename,a]));
const hash=(b: Uint8Array)=>createHash('sha256').update(b).digest('hex');
const payload=await readFile(`src/planets/${id}/prepared/object.json`);
const descriptor=shape({prepared:shape({sha256:text})})(JSON.parse(await readFile(`src/planets/${id}/object.json`,'utf8')));assert.equal(hash(payload),descriptor.prepared.sha256);
const content=shape({lenses:shape({controls:array(shape({id:text,description:text}))})})(JSON.parse(await readFile(`src/planets/${id}/source/content/object.json`,'utf8')));
const recipe=shape({geometry:shape({radiusKm:number,radius:number})})(JSON.parse(await readFile(`src/planets/${id}/source/preparation/terrestrial.json`,'utf8')));
const analytic: Record<string, ReturnType<typeof contactEllipsoidMesh>> = {};
for (const lens of ['model','arecibo']) analytic[lens]=contactEllipsoidMesh(JSON.parse(await readFile(`src/planets/${id}/source/shape/${lens}.json`,'utf8')));
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports: (Awaited<ReturnType<typeof capture>> & { freshSourceDirectory?: string; freshFilesServed?: string[] })[]=[];
async function capture(base: string,dpr: number,{fresh=false}: { fresh?: boolean }={}){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(60000);
 const page=await context.newPage(),errors: string[]=[],pending: Promise<unknown>[]=[],loaded: ResponseReceipt[]=[],requests: string[]=[];
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
  await page.goto(base+'/'+id+'/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true' && document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId==='comet-8p' && document.querySelectorAll<HTMLElement>('.comet-8p-body > u').length===2000);
  await page.waitForTimeout(350);await Promise.all(pending);
  const cold=loaded.slice(),coldRequests=requests.length;
  const transported=cold.find(r=>r.decodedSha256===hash(payload));assert.ok(transported,'The browser must load the exact prepared object bytes.');
  for(const lens of content.lenses.controls){
   const details=page.locator(`[data-lens-details="${lens.id}"]`);
   assert.equal(await details.locator('.planet-facts > li').count(),2);
   assert.equal(await details.locator('.planet-lens-details-copy').innerText(),lens.description);
  }
  assert.ok(!await page.evaluate(()=>Boolean(Reflect.get(window, '__comet-8p'))),'Use the production build.');
  const initial=await page.locator('.polycss-scene').evaluate(root=>{
   const leaves=[...document.querySelectorAll<HTMLElement>('.comet-8p-body > u')];window.__tuttleNodes={root,leaves,geometry:leaves.map(n=>['transform','width','height','background-position','background-size'].map(k=>n.style.getPropertyValue(k)))};
   return {leaves:leaves.length,atlas:[...new Set(leaves.map(n=>getComputedStyle(n).backgroundImage))],dimensions:[...new Set(leaves.map(n=>{const s=getComputedStyle(n);return s.width+' × '+s.height}))]};
  });assert.equal(initial.leaves,2000);
  const inspectAtlases=async()=>{
   const urls=await page.locator('.comet-8p-body > u').evaluateAll(nodes=>[...new Set(nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>getComputedStyle(n).backgroundImage.match(/url\("?([^"\)]+)/)?.[1]))]);
   const records=[];
   for(const url of urls){assert.ok(url, "Visible leaf has an atlas URL"); const response=await context.request.get(url),bytes=await response.body();assert.equal(response.status(),200);const filename=basename(new URL(url).pathname);assert.equal(hash(bytes),pins.get(filename)?.sha256);records.push({filename,bytes:bytes.length,sha256:hash(bytes)});}return records;
  };
  const prefix=fresh?'fresh-runtime':`dpr-${dpr}`;
  const settings=page.getByRole('button',{name:'Settings',exact:true});
  const settingsVisible=await settings.isVisible();
  const lighting=async()=>{
   if(settingsVisible){await settings.click();await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');}
   else await page.locator('input[name="shadows"]').evaluate(input=>{
if (!(input instanceof HTMLElement)) throw new Error("Expected HTMLElement observation");
return input.click(); });
   await page.waitForLoadState('networkidle');await page.waitForTimeout(250);
  };
  const pose=()=>page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);
  const initialPose=await pose();
  const select=async (lens: string)=>{
   await page.locator(`button[name="lens"][value="${lens}"]`).click();
   await page.waitForFunction(lens=>{
     function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return requiredElement(document.querySelector('.planet-stage')).dataset.lens===lens; },lens);
   await page.waitForLoadState('networkidle');
   const visible=await page.locator('.comet-8p-body > u').evaluateAll(nodes=>{
    const selected=nodes.filter(n=>getComputedStyle(n).display!=='none');
    return {count:selected.length,models:[...new Set(selected.map(n=>n.dataset.surfaceModel))]};
   });
   assert.deepEqual(visible,{count:1000,models:[lens]});assert.equal(await pose(),initialPose,'A dataset switch must preserve the shared camera.');
  };
  const views=[];
  for(const lens of ['model','arecibo']){
   const offset=loaded.length;await select(lens);
   const shadows=await inspectAtlases();assert.ok(shadows.every(a=>a.filename===`${id}-${lens}-shadow@2x.webp`));
   await page.screenshot({path:resolve(out,`${prefix}-${lens}-shadows.png`)});
   await lighting();
   const flood=await inspectAtlases();assert.ok(flood.every(a=>a.filename===`${id}-${lens}-surface@2x.webp`));
   await page.screenshot({path:resolve(out,`${prefix}-${lens}-flood.png`)});
   await lighting();await Promise.all(pending);
   views.push({lens,shadows,flood,visibleLeaves:1000,responses:loaded.slice(offset)});
  }
  // The analytic source ellipsoids independently choose a point that belongs
  // only to one model. Real double-clicks prove the committed picking range.
  const hitLens=fresh?'model':'arecibo',missLens=fresh?'arecibo':'model';
  const exclusive=await page.evaluate(({analytic,metersPerCss,hitLens,missLens})=>{
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

   const camera=requiredElement(document.querySelector('.comet-8p-camera')),body=requiredElement(document.querySelector('.comet-8p-body'));
   const bounds=camera.getBoundingClientRect(),style=getComputedStyle(camera),focal=parseFloat(style.perspective),principal=style.perspectiveOrigin.split(' ').map(parseFloat);
   let matrix=new DOMMatrix();let node: Element | null=body;
   while(node&&node!==camera){matrix=new DOMMatrix(getComputedStyle(node).transform).multiply(matrix);node=node.parentElement;}
   const inverse=matrix.inverse(),eye=inverse.transformPoint(new DOMPoint(principal[0]-bounds.width/2,principal[1]-bounds.height/2,focal));
   const world=(p: DOMPointReadOnly)=>[p.y*metersPerCss,p.x*metersPerCss,p.z*metersPerCss],origin=world(eye);
   const hits=(lens: string,x: number,y: number)=>{
    const direction=world(inverse.transformPoint(new DOMPoint(x-bounds.x-principal[0],y-bounds.y-principal[1],-focal,0)));
    return analytic[lens].axesMeters.some((axes,i)=>{
     const o=origin.map((n,j)=>(n-(j===0?analytic[lens].centersMeters[i]:0))/axes[j]),d=direction.map((n,j)=>n/axes[j]);
     const a=d.reduce((s,n)=>s+n*n,0),b=2*d.reduce((s,n,j)=>s+n*o[j],0),c=o.reduce((s,n)=>s+n*n,0)-1,disc=b*b-4*a*c;
     return disc>=0&&(-b+Math.sqrt(disc))/(2*a)>=0;
    });
   };
   const candidates=[];
   for(let y=110;y<780;y+=12)for(let x=400;x<1200;x+=12)candidates.push({x,y});
   candidates.sort((a,b)=>Math.hypot(a.x-innerWidth/2,a.y-innerHeight/2)-Math.hypot(b.x-innerWidth/2,b.y-innerHeight/2));
   for(const {x,y} of candidates){
    if([[0,0],[-10,0],[10,0],[0,-10],[0,10]].every(([dx,dy])=>hits(hitLens,x+dx,y+dy)&&!hits(missLens,x+dx,y+dy)))return {x,y,hitLens,missLens};
   }
   return null;
  },{analytic,metersPerCss:recipe.geometry.radiusKm*1000/recipe.geometry.radius/BASE_TILE,hitLens,missLens});
  assert.ok(exclusive,'The models must have independently distinguishable silhouettes.');
  await select(missLens);
  // Empty-sky clicks request deselection. Cancel only that documented event
  // while comparing silhouettes, so its overview flight cannot mask a hit.
  await page.evaluate(()=>{
   window.__tuttleDeselects=0;
   window.__tuttleDeselectProbe=event=>{window.__tuttleDeselects++;event.preventDefault()};
   window.addEventListener('objectdeselect',window.__tuttleDeselectProbe,{capture:true});
  });
  await page.mouse.dblclick(exclusive.x,exclusive.y,{delay:45});await page.waitForTimeout(1600);
  const backgroundClicks=await page.evaluate(()=>window.__tuttleDeselects);
  assert.ok(backgroundClicks>0,'The inactive silhouette must be classified as empty sky.');
  assert.equal(await pose(),initialPose,'The inactive model must not receive surface clicks.');
  await select(hitLens);
  const requestOffset=requests.length;
  await page.mouse.dblclick(exclusive.x,exclusive.y,{delay:45});await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(()=>window.__tuttleDeselects),backgroundClicks,'The active silhouette must not be classified as empty sky.');
  assert.notEqual(await pose(),initialPose,'The active model must receive its surface click.');
  await page.evaluate(()=>window.removeEventListener('objectdeselect',window.__tuttleDeselectProbe,{capture:true}));
  Object.assign(exclusive, {backgroundClicks, qualification:'Native double-clicks with the cancelable empty-sky deselection event prevented, isolating surface flight from the shared overview flight.'});
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
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

   const p=window.__tuttleNodes,root=requiredElement(document.querySelector('.polycss-scene')),leaves=[...document.querySelectorAll<HTMLElement>('.comet-8p-body > u')];
   return {retained:root===p.root&&leaves.length===p.leaves.length&&leaves.every((n,i)=>n===p.leaves[i]),geometryRetained:leaves.every((n,i)=>['transform','width','height','background-position','background-size'].every((k,j)=>n.style.getPropertyValue(k)===p.geometry[i][j])),scenes:document.querySelectorAll<HTMLElement>('.polycss-scene').length,forbiddenElements:document.querySelectorAll<HTMLElement>('.planet-stage canvas,.planet-stage svg').length,forbiddenStyles:leaves.some(n=>{const s=getComputedStyle(n);return s.clipPath!=='none'||s.maskImage!=='none'||s.filter!=='none'||s.mixBlendMode!=='normal'||/gradient\(/.test(s.backgroundImage)}),lensFacts:document.querySelector<HTMLElement>('.planet-lens-legend-panel')?.innerText??null};
  });
  assert.ok(state.retained&&state.geometryRetained);assert.equal(state.scenes,1);assert.equal(state.forbiddenElements,0);assert.equal(state.forbiddenStyles,false);assert.deepEqual(errors,[]);assert.deepEqual(interactionRequests,[]);
  await Promise.all(pending);
  const totals=(rows: readonly ResponseReceipt[])=>({responses:rows.length,bodyBytes:rows.reduce((n,r)=>n+r.responseBodySize,0),headerBytes:rows.reduce((n,r)=>n+r.responseHeadersSize,0)});
  return {dpr,fresh,lightingAccess:settingsVisible?'Visible settings control':'Existing input binding exercised programmatically; current shared shell hides Settings.',transportedPrepared:{url:transported.url,sha256:transported.decodedSha256},surfaceFlight:true,exclusivePicking:exclusive,mobileWheelPreserved:true,route:base+'/'+id+'/',initial,views:views.map(view=>({...view,transfer:totals(view.responses)})),...state,errors,interactionRequests,cold:{...totals(cold),requests:coldRequests,includes:'HTML, JavaScript, CSS, prepared JSON, workers, shared shell and scene images, as observed by BrowserContext response events.',responses:cold},preparedSha256:hash(payload)};
 }finally{await context.close()}
}
let server: ReturnType<typeof createServer> | undefined;
try{
 for(const dpr of [1,2])reports.push(await capture(origin,dpr));
 const served: string[]=[];
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(required(req.url),'http://127.0.0.1');
   if(url.pathname.startsWith('/scenes/'+id+'/')){
    const filename=url.pathname.slice(('/scenes/'+id+'/').length);const pin=pins.get(filename);assert.ok(pin,'Every scene request must belong to the fresh runtime inventory.');
    const bytes=await readFile(resolve(delivery.stage,filename));assert.equal(hash(bytes),pin.sha256);served.push(filename);
    res.writeHead(200,{'Content-Type':filename.endsWith('.png')?'image/png':'image/webp','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
   }else{
    const upstream=await fetch(origin+url.pathname+url.search);const bytes=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
   }
  }catch(e){res.writeHead(500);res.end(String(e));}
 });
 const proxy=server;
 await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 const address=proxy.address(); assert.ok(address && typeof address==='object', 'Proxy has a TCP address');
 const fresh=Object.assign(await capture('http://127.0.0.1:'+address.port,1,{fresh:true}), {freshSourceDirectory:delivery.stage,freshFilesServed:[...new Set(served)].sort()});
 Object.assign(fresh.cold,{qualification:'Fixture proxy transport; production transfer is measured separately above.'});
 for(const lens of ['model','arecibo'])for(const mode of ['shadow','surface'])assert.ok(fresh.freshFilesServed.includes(`comet-8p-${lens}-${mode}@2x.webp`));
 reports.push(fresh);
 await writeFile(resolve(out,'report.json'),JSON.stringify({browser:browser.version(),capturedAt:new Date().toISOString(),viewport:{width:1440,height:900},freshInstallation:{stage,...installation,bytes:files.reduce((n,a)=>n+a.bytes,0)},reports},null,2)+'\n');
 console.log(JSON.stringify(reports.map(r=>({dpr:r.dpr,fresh:r.fresh,retained:r.retained,exclusivePicking:r.exclusivePicking,coldBodyBytes:r.cold.bodyBytes,freshFiles:r.freshFilesServed?.length}))));
}finally{await browser.close();if(server){const proxy=server;await new Promise<void>((resolve,reject)=>proxy.close(error=>error?reject(error):resolve()));}}
