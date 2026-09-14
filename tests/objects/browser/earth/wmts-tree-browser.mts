import assert from "node:assert/strict";
import { mkdir,writeFile,readFile,open, type FileHandle } from "node:fs/promises";
import { chromium } from "playwright";
import { PREPARED_EARTH_NOISE as noisePlan } from "../../unit/earth/prepared-fixture.mts";
import { PREPARED_EARTH_SCENE as scene, preparePagingDiagnostic, routePagingDiagnostic } from "../../unit/earth/prepared-fixture.mts";
import { PREPARED_EARTH_CITY_PAGES as existing } from "../../unit/earth/prepared-fixture.mts";
import { prepareRegionPack } from "../../../../tools/objects/geographic-pages/prepare-wmts-tree.mts";
import { prepareWmtsTile,wmtsAddress } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { prepareLocationPoint,prepareLocationCamera } from "../../../../tools/objects/geographic-pages/prepare-location.mts";
import sourceConfig from '../../../../src/objects/earth/source/preparation/paged-ellipsoid.json' with { type: 'json' };
import { parseGlobalManifest, parseBodyAttitude } from "../../../../tools/objects/geographic-pages/source-records.mts";
import { requireRecord } from "../../../../tools/source-values.mts";
import type { PageLayerStats } from "../../../../src/renderers/css/runtime/object-runtime-types.js";
import type { ObjectRuntimeDiagnostics } from "../../../../site/env.js";
declare global { interface Window { __savedNodes: readonly Element[] } }
type TreeState = { paging: PageLayerStats; noise: PageLayerStats; stable: boolean; identical: boolean; nodes: number };
type TreeRun = { dpr: number; views: { id: string; elapsedMs: number; state: TreeState }[]; errors: string[]; ranges: { url: string; status: number; range?: string; bytes: number }[]; imagery: { url: string; status: number }[]; failure?: PageLayerStats; video?: string; diagnostic?: { camera: ReturnType<ObjectRuntimeDiagnostics['camera']['state']>; carriers: { class: string; transform: string; style: string }[]; pages: { key?: string; transform: string; childTransform: string | null; visibility: string }[] } };
const root=new URL("../../../../",import.meta.url),output=new URL(`output/playwright/wmts-tree-${Date.now()}/`,root);
const base=(process.argv.slice(2).find(argument=>/^https?:\/\//u.test(argument))??"http://127.0.0.1:4210").replace(/\/$/u,"");
await mkdir(output,{recursive:true});
const requested=process.argv.find(a=>a.startsWith("--sample="))?.slice(9),mobile=process.argv.includes("--mobile");
const noise=process.argv.includes("--noise");
const globalManifest=process.argv.find(a=>a.startsWith("--manifest="))?.slice(11)??(process.argv.includes("--global")?new URL(`../../../../.local/wmts-global/${existing.geometryVersion}/manifest.json`,import.meta.url).pathname:null);
const samples=[{id:"buenos-aires",lon:-58.3816,lat:-34.6037},{id:"helsinki",lon:24.9384,lat:60.1699},
  {id:"longyearbyen",lon:15.6469,lat:78.2232},{id:"antimeridian",lon:179.99,lat:-16.78},
  {id:"face-seam",lon:112.5,lat:33.75},{id:"tokyo",lon:139.6917,lat:35.6895}].filter(s=>!requested||s.id===requested);
const manifest=globalManifest?parseGlobalManifest(JSON.parse(await readFile(globalManifest,"utf8"))):undefined;
const paths: Record<string,string>={},roots: ReturnType<typeof prepareRegionPack>["root"][]=[],version=manifest?.version??"1111111111111111";
if(manifest){assert.ok(manifest.complete);roots.push(...manifest.roots);}
else for(const sample of samples){
  const center=wmtsAddress(sample.lon,sample.lat,8);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const address={zoom:8,x:(center.x+dx+256)%256,y:center.y+dy};
    const url=`/scenes/earth/wmts-${version}/8-${address.x}-${address.y}.pack`;
    if(paths[url])continue;
    const pack=prepareRegionPack(address,scene,()=>true,existing.dataset,version,{assetPath:'/scenes/earth/'}),path=new URL(url.slice(url.lastIndexOf("/")+1),output).pathname;
    await writeFile(path,pack.bytes);paths[url]=path;roots.push(pack.root);
  }
}
const initialLayer=prepareWmtsTile(wmtsAddress(-58.38,-34.6,14),scene)[0];
assert.ok(initialLayer, "WMTS tree diagnostic requires an initial layer");
assert.ok(samples[0], "WMTS tree diagnostic requires a geographic sample");
const plan={...existing,index:{...existing.index,maximumBytes:12*1024*1024,maximumDirectories:96},topology:"wmts-quadtree@1",geometryVersion:version,roots,rasterScale:8,decodedPageBytes:256*256*4,pageTemplate:"clipped-projective",
  initialLayer,qualification:manifest?"Global prepared source-footprint index":"Regional pack transport checkpoint; worldwide build in progress"};
const diagnostic=globalManifest?null:await preparePagingDiagnostic(plan);
let browser;
const report: { base: string; output: string; createdAt: string; qualification: string; runs: TreeRun[]; browser?: string; passed?: boolean }={base,output:output.pathname,createdAt:new Date().toISOString(),qualification:plan.qualification,runs:[]};
try{
  browser=await chromium.launch({channel:"chrome",headless:true});report.browser=browser.version();
  for(const dpr of mobile?[2]:[1,2]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:1000},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile,recordVideo:{dir:output.pathname,size:{width:1400,height:1000}}});
    if(diagnostic){
      await routePagingDiagnostic(context,diagnostic);
      await context.route(`${base}/scenes/earth/wmts-${version}/*.pack`,async route=>{
        const path=paths[new URL(route.request().url()).pathname];
        if(!path)return route.fallback();
        const match=/^bytes=(\d+)-(\d+)$/.exec(route.request().headers().range??"");
        if(!match)return route.fulfill({status:416,body:""});
        let handle: FileHandle | undefined;
        try{
          handle=await open(path);
          const size=(await handle.stat()).size,start=Number(match[1]),end=Number(match[2]);
          if(end>=size||end<start)return await route.fulfill({status:416,body:""});
          const bytes=Buffer.alloc(end-start+1);
          await handle.read(bytes,0,bytes.length,start);
          await route.fulfill({status:206,contentType:"application/octet-stream",
            headers:{"content-range":`bytes ${start}-${end}/${size}`,"content-length":String(bytes.length)},body:bytes});
        }catch(error){await route.fulfill({status:500,body:error instanceof Error ? error.message : String(error)});}
        finally{await handle?.close();}
      });
    }
    const page=await context.newPage(),run: TreeRun={dpr,views:[],errors:[],ranges:[],imagery:[]};report.runs.push(run);
    page.on("pageerror",error=>run.errors.push(error.message));
    page.on("response",async response=>{if(response.status()>=400 && !response.url().includes("mapproxy"))console.log(JSON.stringify({failedUrl:response.url(),status:response.status(),body:(await response.text().catch(()=>"")).slice(0,2500)}));});
    page.on("console",message=>{if(message.type()==="error")console.log(JSON.stringify({consoleError:message.text()}));});
    page.on("response",response=>{if(response.url().endsWith(".pack"))run.ranges.push({url:response.url(),status:response.status(),range:response.headers()["content-range"],bytes:Number(response.headers()["content-length"])});
      if(response.url().includes("mapproxy/wmts"))run.imagery.push({url:response.url(),status:response.status()});});
    try{
      await page.goto(`${base}/earth/`);await page.waitForFunction(()=>window.__earth?.ready);
      await page.evaluate(()=>{
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
        function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }
{ const motion = requiredInput(document.querySelector('input[name="motion"]')); if (motion.checked) motion.click(); }window.__savedNodes=[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")];});
      for(const sample of [...samples,{...samples[0],id:samples[0].id+"-revisit"}]){
        if(noise)assert.ok(noisePlan.camera, "Noise overlay requires its prepared location camera");
        const camera=noise?noisePlan.camera:prepareLocationCamera(scene,prepareLocationPoint(scene,sample.lon,sample.lat),2048,
          {body:parseBodyAttitude(requireRecord(scene)[sourceConfig.sceneBodyKey]),camera:sourceConfig.camera});
        assert.ok(camera, "Selected diagnostic camera must exist");
        const start=Date.now();
        if(noise)await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).lenses.select("buenos-aires-noise"); });
        await page.evaluate(camera=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.flyToState(camera,{surfaceTarget:true}); },camera);
        const progress=setInterval(()=>void page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          const owner=window.__cssEarth,earth=window.__earth;
          if(!earth)return {ready:owner?.ready,error:owner?.error};
          const s=earth.runtime.pages().city,camera=earth.camera.state();
          return {desired:s.desired.length,levels:[...new Set(s.desired.map(key=>key.split('-')[1]))],
            retained:s.retained.length,published:s.retained.filter(page=>page.published).length,
            pendingSelection:s.pendingSelection,imageLoads:s.activeLoads,imageRequests:s.requests,
            indexLoads:s.index.activeLoads,indexRequests:s.index.requests,indexErrors:s.index.errors,
            imageErrors:s.errors,zoom:camera.zoom,distanceKilometers:camera.distanceKilometers};
        }).then(state=>console.log(JSON.stringify({progress:sample.id,dpr,elapsedMs:Date.now()-start,state})))
          .catch(()=>{}),10000);
        try{
          await page.waitForFunction(()=>{
            function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
const s=requiredDiagnostics(window.__earth).runtime.pages().city;return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads&&s.desired.every(key=>s.retained.some(p=>p.key===key&&p.published));},null,{timeout:120000});
        }catch(error){run.failure=await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city; });throw error;}
        finally{clearInterval(progress);}
        if(noise)await page.waitForFunction(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
const s=requiredDiagnostics(window.__earth).runtime.pages().noise;return s.desired.length>0&&!s.activeLoads&&s.desired.every(key=>s.retained.some(p=>p.key===key&&p.published));});
        const state=await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({paging:requiredDiagnostics(window.__earth).runtime.pages().city,noise:requiredDiagnostics(window.__earth).runtime.pages().noise,stable:requiredDiagnostics(window.__earth).assertStableDomIdentity(),identical:[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")].every((n,i)=>n===window.__savedNodes[i]),nodes:window.__savedNodes.length}); });
        assert.ok(state.stable&&state.identical);assert.deepEqual(state.paging.index.errors,[]);assert.deepEqual(state.paging.errors,[]);
        assert.ok(state.paging.reservedDecodedBytes<=plan.maximumDecodedBytes);assert.ok(state.paging.index.reservedDecodedBytes<=plan.index.maximumBytes);
        run.views.push({id:sample.id,elapsedMs:Date.now()-start,state});
        await page.screenshot({path:new URL(`${sample.id}${noise?"-noise":""}-dpr${dpr}.png`,output).pathname});
        if(process.argv.includes("--diagnose-polar")){
          run.diagnostic=await page.evaluate(()=>{
            function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return ({
            camera:requiredDiagnostics(window.__earth).camera.state(),carriers:[...document.querySelectorAll<HTMLElement>(".earth-body")].map(n=>({class:n.className,transform:getComputedStyle(n).transform,style:getComputedStyle(n).transformStyle})),
            pages:[...document.querySelectorAll<HTMLElement>("[data-city-page]")].map(n=>({key:n.dataset.cityPage,transform:getComputedStyle(n).transform,childTransform:n.firstElementChild ? getComputedStyle(n.firstElementChild).transform : null,visibility:getComputedStyle(n).visibility}))}); });
          await page.evaluate(()=>document.querySelectorAll<HTMLElement>(".earth-body-polar > s").forEach(n=>n.style.visibility="hidden"));
          await page.screenshot({path:new URL(`diagnostic-hidden-base-${dpr}.png`,output).pathname});
          await page.evaluate(()=>document.querySelectorAll<HTMLElement>(".earth-body-polar > s").forEach(n=>n.style.visibility=""));
        }
        console.log(JSON.stringify({dpr,sample:sample.id,elapsedMs:Date.now()-start,pages:state.paging.desired.length,metadata:state.paging.index.reservedDecodedBytes}));
      }
      assert.deepEqual(run.errors,[]);assert.ok(run.ranges.every(r=>r.status===206&&r.range));
      await page.evaluate(async()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
await requiredDiagnostics(window.__earth).lenses.select("normal");requiredDiagnostics(window.__earth).camera.setState({zoom:1.1});});await page.waitForFunction(()=>{
  function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.length===0; });
    }finally{await context.close();run.video=await page.video()?.path();}
  }
  if(!mobile)assert.deepEqual(report.runs[0].views.map(v=>v.state.paging.desired),report.runs[1].views.map(v=>v.state.paging.desired));
  report.passed=true;
}finally{await browser?.close();await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));console.log(JSON.stringify({output:output.pathname,passed:report.passed??false}));}
