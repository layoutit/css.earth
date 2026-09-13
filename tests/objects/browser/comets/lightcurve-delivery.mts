import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {required} from '../../../../tools/test-values.mts';
import {shape,array,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import type { Request } from 'playwright';
type Receipt=Awaited<ReturnType<Request['sizes']>> & {url:string;status:number;sha256?:string};
declare global { interface Window { __expansionNodes: {root:HTMLElement;leaves:HTMLElement[];geometry:string[]}; } }
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {runtimeAssets} from '../../../../tools/runtime-assets.mts';
import {installRuntimeAssets} from '../../../../tools/setup.mts';
const origin=process.argv[2]??'http://127.0.0.1:53135';
const out=resolve(process.argv[3]??'output/playwright/comet-expansion');
const ids=['comet-137p','comet-143p','comet-162p'];
await mkdir(out,{recursive:true});
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const assets=await runtimeAssets(process.cwd(),ids),stage=await mkdtemp(resolve(out,'fresh-assets-'));
const installation=await installRuntimeAssets(assets.map(a=>({...a,file:resolve(stage,a.filename)})));
assert.equal(installation.installed,assets.length);assert.equal(installation.reused,0);
const pins=new Map(assets.map(a=>[a.filename,a]));
// All comet scene files in this server come from the empty-directory installer.
// The normal production build supplies shared shell assets and compiled JSON.
const proxy=createServer(async(req,res)=>{
 try{
  const path=new URL(required(req.url),'http://localhost').pathname,name=basename(path);
  if(ids.some(id=>path.startsWith(`/scenes/${id}/`))&&pins.has(name)){
   res.writeHead(200,{'content-type':'image/webp'});res.end(await readFile(resolve(stage,name)));return;
  }
  const response=await fetch(origin+req.url),body=Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'application/octet-stream'});res.end(body);
 }catch(e){res.writeHead(500);res.end(e instanceof Error ? e.message : String(e));}
});
await new Promise<void>(r=>proxy.listen(0,'127.0.0.1',r));
const address=proxy.address();assert.ok(address && typeof address==='object');
const freshOrigin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
try{
 for(const dpr of [1,2])for(const id of ids){
  const fresh=dpr===1,base=fresh?freshOrigin:origin;
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  const page=await context.newPage(),errors:string[]=[],loaded:Receipt[]=[],pending:Promise<unknown>[]=[];page.setDefaultTimeout(25000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable',{maxTotalBufferSize:268435456,maxResourceBufferSize:134217728});
  context.on('response',r=>{const task=(async()=>{await r.finished();const url=r.url(),path=new URL(url).pathname;if(r.status()>=400)errors.push(`${r.status()} ${url}`);const bytes=/\/object\.[^/]+\.json$|\/scenes\//.test(path)?await r.body():null;loaded.push({url,status:r.status(),...(await r.request().sizes()),...(bytes?{sha256:hash(bytes)}:{})});})();task.catch(()=>{});pending.push(task);});
  try{
   const payload=await readFile(`src/objects/${id}/prepared/object.json`),content=shape({lenses:shape({controls:array(shape({description:text}))})})(JSON.parse(await readFile(`src/objects/${id}/source/content/object.json`,'utf8')));
   await page.goto(`${base}/${id}/`,{waitUntil:'networkidle'});
   await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId===id,id);
   await Promise.all(pending);const cold=loaded.slice();assert.ok(cold.some(r=>r.sha256===hash(payload)),'Actual transported prepared JSON must match the local payload');
   assert.equal(await page.evaluate(id=>Boolean(Reflect.get(window, `__${id}`)),id),false,'Use production public observables');
   const shadows=page.locator('input[name="shadows"]');assert.equal(await shadows.isChecked(),false);
   const initial=await page.evaluate(id=>{
     function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
const root=requiredElement(document.querySelector('.polycss-scene')),leaves=[...document.querySelectorAll<HTMLElement>(`.${id}-body > u`)];window.__expansionNodes={root,leaves,geometry:leaves.map(n=>n.style.transform)};return {leaves:leaves.length,dimensions:[...new Set(leaves.map(n=>getComputedStyle(n).width+' × '+getComputedStyle(n).height))],initialPose:getComputedStyle(root).transform};},id);assert.equal(initial.leaves,800);
   const details=page.locator('[data-lens-details="model"]');assert.equal(await details.locator('.planet-facts > li').count(),2);assert.equal(await details.locator('.planet-lens-details-copy').innerText(),content.lenses.controls[0].description);
   let gridRange;
   const inspect=async (lit:boolean)=>{
    const suffix=`${id}-model-${lit?'shadow':'surface'}@2x.webp`;
    await page.waitForFunction(({id,suffix})=>[...document.querySelectorAll<HTMLElement>(`.${id}-body > u`)].every(n=>getComputedStyle(n).backgroundImage.includes(suffix)),{id,suffix});
    const urls=await page.locator(`.${id}-body > u`).evaluateAll(nodes=>[...new Set(nodes.map(n=>{const match=getComputedStyle(n).backgroundImage.match(/url\("?([^"\)]+)/);if(!match)throw new Error('Visible leaf has no atlas URL');return match[1];}))]);
    for(const url of urls){
     const r=await context.request.get(url),bytes=await r.body();assert.equal(hash(bytes),required(pins.get(basename(new URL(url).pathname))).sha256);
     if(!lit){
      const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let minimum=255,maximum=0;
      for(let i=0;i<data.length;i+=info.channels)if(data[i+3])for(let c=0;c<3;c++){minimum=Math.min(minimum,data[i+c]);maximum=Math.max(maximum,data[i+c]);}
      // The shared grid is RGB 82/84/82 through 112/115/111. Allow a small
      // WebP encoding margin; directional darkening would fail this check.
      assert.ok(minimum>=72&&maximum<=125,`Shadows off must preserve the plain grid (${minimum}..${maximum})`);gridRange={minimum,maximum};
     }
    }return urls;
   };
   const flood=await inspect(false);await page.screenshot({path:resolve(out,`${id}-dpr-${dpr}.png`)});
   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');assert.equal(await shadows.isChecked(),true);await inspect(true);
   await page.screenshot({path:resolve(out,`${id}-dpr-${dpr}-shadows.png`)});
   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('label').filter({hasText:'Shadows'}).click();await page.keyboard.press('Escape');await inspect(false);
   await page.waitForLoadState('networkidle');const requestsBefore=loaded.length;
   const input=await page.locator('.planet-input-surface').boundingBox();assert.ok(input);const x=input.x+input.width*.5,y=input.y+input.height*.5;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+160,y+80,{steps:45});await page.mouse.up();await page.waitForTimeout(500);
   const dragged=await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);assert.notEqual(dragged,initial.initialPose);
   await page.mouse.wheel(0,-130);await page.waitForTimeout(500);await page.screenshot({path:resolve(out,`${id}-dpr-${dpr}-turned.png`)});
   await page.setViewportSize({width:820,height:900});await page.waitForTimeout(300);const before=await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform);await page.mouse.wheel(0,-130);await page.waitForTimeout(400);assert.equal(await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform),before);await page.screenshot({path:resolve(out,`${id}-dpr-${dpr}-compact.png`)});
   const retained=await page.evaluate(id=>{
     function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
const state=window.__expansionNodes,nodes=[...document.querySelectorAll<HTMLElement>(`.${id}-body > u`)];return state.root===requiredElement(document.querySelector('.polycss-scene'))&&nodes.length===800&&nodes.every((n,i)=>n===state.leaves[i]&&n.style.transform===state.geometry[i]);},id);assert.ok(retained);
   const forbidden=await page.locator('.polycss-scene').evaluate(root=>[...root.querySelectorAll<HTMLElement>('*')].filter(n=>{const s=getComputedStyle(n);return ['CANVAS','SVG'].includes(n.tagName)||s.clipPath!=='none'||s.filter!=='none'||s.maskImage!=='none'||s.mixBlendMode!=='normal'||s.backgroundImage.includes('gradient(')}).length);assert.equal(forbidden,0);
   await Promise.all(pending);assert.deepEqual(errors,[]);assert.equal(loaded.length,requestsBefore,'Prepared interaction must not fetch scene assets');
   reports.push({id,dpr,fresh,preparedSha256:hash(payload),initial,retained,defaultShadows:false,gridRange,optInWorks:true,forbidden,errors,coldResponses:cold,coldBodyBytes:cold.reduce((s,r)=>s+r.responseBodySize,0),flood});
  }finally{await context.close();}
 }
 await writeFile(resolve(out,'report.json'),JSON.stringify({at:new Date().toISOString(),origin,browser:browser.version(),installation,stage,files:assets,reports,qualification:'DPR 1 uses newly installed scene assets through a local proxy. DPR 2 records normal production responses. Transfer totals are separate; neither represents GPU memory.'},null,2)+'\n');
 console.log(JSON.stringify({objects:ids.length,captures:reports.length,restored:installation.installed,leaves:800,shadowsDefault:false}));
}finally{await browser.close();await new Promise<void>((resolve,reject)=>proxy.close(error=>error?reject(error):resolve()));}
