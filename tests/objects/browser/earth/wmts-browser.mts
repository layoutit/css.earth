import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { chromium, type Request } from "playwright";
import { PREPARED_EARTH_SCENE as scene, runtimeDefinition, preparePagingDiagnostic, routePagingDiagnostic } from "../../unit/earth/prepared-fixture.mts";
import { PREPARED_EARTH_CITY_PAGES as existing } from "../../unit/earth/prepared-fixture.mts";
import { prepareWmtsTile,wmtsAddress,WMTS_RASTER_SCALE } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { prepareLocationPoint,prepareLocationCamera } from "../../../../tools/objects/geographic-pages/prepare-location.mts";
import { prepareWmtsBlocks } from "../../../../tools/objects/geographic-pages/operations/prepare-wmts-blocks.mts";

import type { PageLayerStats } from "../../../../src/renderers/css/runtime/object-runtime-types.js";
import type { ObjectRuntimeDiagnostics } from "../../../../site/env.js";
declare global { interface Window { __wmtsNodes: readonly Element[] } }
type WmtsState = { paging: PageLayerStats; stable: boolean; identical: boolean; nodes: number };
type WmtsRun = { dpr: number; views: { id: string; firstPaintMs: number; firstPublished: number; elapsedMs: number; complete: boolean; state: WmtsState }[]; pageErrors: string[]; failures: ({ url: string } & ({ failure: ReturnType<Request['failure']> } | { error: string }))[]; network: string[]; released?: PageLayerStats; selectionFailure?: { camera: ReturnType<ObjectRuntimeDiagnostics['camera']['state']>; viewport: { width: number; height: number; originX: number; originY: number }; visible: number[]; stats: PageLayerStats } };
type WmtsResponse = { dpr: number; url: string; status: number; sha256: string; bytes: number; timing: ReturnType<Request['timing']>; cacheControl?: string; cors?: string };
const root=new URL("../../../../",import.meta.url);
const base=(process.argv.slice(2).find(argument=>/^https?:\/\//u.test(argument))??"http://127.0.0.1:4210").replace(/\/$/u,"");
const output=new URL(`output/playwright/wmts-direct-${Date.now()}/`,root);
await mkdir(output,{recursive:true});
const selected=process.argv.find(arg=>arg.startsWith("--sample="))?.slice(9);
const tileZoom=Number(process.argv.find(arg=>arg.startsWith("--zoom="))?.slice(7)??12);
const mobile=process.argv.includes("--mobile");
const packed=process.argv.includes("--packed");
const samples=[
  {id:"buenos-aires",longitude:-58.3816,latitude:-34.6037},
  {id:"helsinki",longitude:24.9384,latitude:60.1699},
  {id:"face-and-band-seam",longitude:112.5,latitude:33.75},
  {id:"antimeridian",longitude:180,latitude:-16.78},
].map(sample=>({...sample,camera:prepareLocationCamera(scene,prepareLocationPoint(scene,sample.longitude,sample.latitude),1024*2**(tileZoom-12),
  {body:scene.earth,camera:runtimeDefinition.camera})})).filter(sample=>!selected||sample.id===selected);
assert.ok(samples.length);
const pages=new Map<string, ReturnType<typeof prepareWmtsTile>[number]>();
for(const sample of samples){
  const center=wmtsAddress(sample.longitude,sample.latitude,tileZoom),n=2**tileZoom;
  for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){
    for(const p of prepareWmtsTile({zoom:tileZoom,x:(center.x+dx+n)%n,y:center.y+dy},scene))pages.set(p.key,p);
  }

}
const initialLayer=pages.values().next().value;
assert.ok(initialLayer, "WMTS diagnostic requires an initial layer");
const preparedRoots: (ReturnType<typeof prepareWmtsTile>[number] | ReturnType<typeof prepareWmtsBlocks>["roots"][number])[]=[...pages.values()];
const plan={...existing,roots:preparedRoots,initialLayer,
  rasterScale:WMTS_RASTER_SCALE,decodedPageBytes:256*256*4,pageTemplate:"clipped-projective",
  qualification:"Direct WMTS diagnostic windows with substituted prepared data; no HTTP-cache qualification."};
const blocks=packed?prepareWmtsBlocks([...pages.values()],plan.dataset,{assetPath:'/scenes/earth/'}):null;
if(blocks)plan.roots=blocks.roots;
const report: { capturedAt: string; tileZoom: number; mobile: boolean; qualification: string; planBytes: number; responses: WmtsResponse[]; runs: WmtsRun[]; samples: typeof samples; mode: string; channel: string; base?: string; browser?: string; passed?: boolean; blocks?: { count: number; encodedBytes: number; decodedBytes: number; fullJsonBytes: number; references: NonNullable<typeof blocks>['files'][number]['ref'][] } }={capturedAt:new Date().toISOString(),tileZoom,mobile,qualification:plan.qualification,
  planBytes:Buffer.byteLength(JSON.stringify(plan)),responses:[],runs:[],samples,mode:"headless",channel:"chrome"};
if(blocks)report.blocks={count:blocks.files.length,encodedBytes:blocks.files.reduce((sum,file)=>sum+file.ref.bytes,0),
  decodedBytes:blocks.files.reduce((sum,file)=>sum+file.ref.decodedBytes,0),fullJsonBytes:Buffer.byteLength(JSON.stringify([...pages.values()])),references:blocks.files.map(file=>file.ref)};
await writeFile(new URL("plan.json",output),JSON.stringify(plan));
// Substitute the prepared plan while reusing the supplied server. Browser
// routing disables HTTP caching, so this diagnostic only checks page delivery.
const diagnostic=await preparePagingDiagnostic(plan);
if(blocks)for(const file of blocks.files)await writeFile(new URL(file.ref.url.slice(file.ref.url.lastIndexOf("/")+1),output),file.bytes);
let browser;
try{
  report.base=base;
  browser=await chromium.launch({channel:"chrome",headless:true});report.browser=browser.version();
  for(const dpr of mobile?[2]:[1,2]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:1000},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile});
    const run: WmtsRun={dpr,views:[],pageErrors:[],failures:[],network:[]};report.runs.push(run);
    const pending: Promise<unknown>[]=[];
    try{
      await routePagingDiagnostic(context,diagnostic);
      for(const file of blocks?.files??[]){
        await context.route(new URL(file.ref.url,base).href,route=>route.fulfill({contentType:"application/octet-stream",body:file.bytes}));
      }
      const page=await context.newPage();
      page.on("pageerror",error=>run.pageErrors.push(error.message));
      page.on("requestfailed",request=>run.failures.push({url:request.url(),failure:request.failure()}));
      page.on("response",response=>{
        if(!response.url().includes("/mapproxy/wmts/"))return;
        pending.push((async()=>{
          const bytes=await response.body(),sha256=createHash("sha256").update(bytes).digest("hex");
          report.responses.push({dpr,url:response.url(),status:response.status(),sha256,bytes:bytes.length,
            timing:response.request().timing(),cacheControl:response.headers()["cache-control"],cors:response.headers()["access-control-allow-origin"]});
          await writeFile(new URL(`${sha256}.png`,output),bytes);
        })().catch(error=>run.failures.push({url:response.url(),error:error instanceof Error ? error.message : String(error)})));
      });
      page.on("request",request=>{if(request.url().includes("/mapproxy/")||request.url().includes("earth-assets.lowpoly.cc"))run.network.push(request.url());});
      await page.goto(`${base}/earth/`);await page.waitForFunction(()=>window.__earth?.ready);
      await page.evaluate(()=>{
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
        function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }
{ const motion = requiredInput(document.querySelector('input[name="motion"]')); if (motion.checked) motion.click(); }window.__wmtsNodes=[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")];});
      for(const sample of samples){
        // Release the previous view before checking the next selected window.
        await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.setState({zoom:1.1}); });
        await page.waitForFunction(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.length===0; });
        const start=Date.now();
        await page.evaluate(camera=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.setState(camera); },sample.camera);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        if(!packed&&await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.desired.length===0; })){
          const diagnostic=await page.evaluate(async pages=>{
            function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

            function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

            const imported: unknown=await import(new URL('/src/renderers/css/dist/testing.js', location.href).href);
            if (!imported || typeof imported !== 'object' || !('projectCityPage' in imported) || typeof imported.projectCityPage !== 'function') throw new Error('Prepared projection export is missing');
            const projectCityPage = imported.projectCityPage;
            const stage=requiredElement(document.querySelector('.planet-stage')),camera=requiredElement(stage.querySelector('.polycss-camera'));
            const m=new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.polycss-scene'))).transform)
              .multiply(new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.earth-system'))).transform))
              .multiply(new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.earth-body:not(.earth-body-polar)'))).transform));
            const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
            const viewport={width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top};
            const projected=pages.map(p=>{const value: unknown=projectCityPage(p,Array.from(m.toFloat64Array()),parseFloat(getComputedStyle(camera).scale),viewport); if (!value || typeof value !== 'object' || !('visible' in value) || typeof value.visible !== 'boolean' || !('span' in value) || typeof value.span !== 'number' || !Number.isFinite(value.span)) throw new Error('Invalid prepared projection'); return {visible:value.visible,span:value.span};});
            return {camera:requiredDiagnostics(window.__earth).camera.state(),viewport,visible:projected.filter(p=>p.visible).map(p=>p.span),stats:requiredDiagnostics(window.__earth).runtime.pages().city};
          },[...pages.values()]);
          run.selectionFailure=diagnostic;throw new Error(`No selected WMTS page: ${JSON.stringify(diagnostic)}`);
        }
        await page.waitForFunction(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.some(slot=>slot.published); },null,{timeout:120000});
        const firstPaintMs=Date.now()-start;
        const firstPublished=await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.filter(slot=>slot.published).length; });
        await page.waitForFunction(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          const s=requiredDiagnostics(window.__earth).runtime.pages().city;return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads;
        },null,{timeout:120000});
        const elapsedMs=Date.now()-start;
        const state=await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({paging:requiredDiagnostics(window.__earth).runtime.pages().city,stable:requiredDiagnostics(window.__earth).assertStableDomIdentity(),
          identical:[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")].every((n,i)=>n===window.__wmtsNodes[i]),nodes:window.__wmtsNodes.length}); });
        const complete=state.paging.desired.every(key=>state.paging.retained.some(p=>p.key===key&&p.ready&&p.published));
        run.views.push({id:sample.id,firstPaintMs,firstPublished,elapsedMs,complete,state});
        assert.ok(state.stable&&state.identical);assert.ok(state.paging.reservedDecodedBytes<=state.paging.decodedPageByteBound);
        assert.deepEqual([...state.paging.desired].sort(),await page.evaluate(async records=>{
          function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

          const imported: unknown=await import(new URL('/src/renderers/css/dist/testing.js', location.href).href);
          if (!imported || typeof imported !== 'object' || !('selectCityPages' in imported) || typeof imported.selectCityPages !== 'function') throw new Error('Prepared selection export is missing');
          const selectCityPages = imported.selectCityPages;
          const stage=requiredElement(document.querySelector('.planet-stage')),camera=requiredElement(stage.querySelector('.polycss-camera'));
          const matrix=new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.polycss-scene'))).transform)
            .multiply(new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.earth-system'))).transform))
            .multiply(new DOMMatrix(getComputedStyle(requiredElement(stage.querySelector('.earth-body:not(.earth-body-polar)'))).transform));
          const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
          const result: unknown=selectCityPages({roots:records,poolSize:512,maximumDecodedBytes:103833600},new Map(records.map(p=>[p.key,p])),Array.from(matrix.toFloat64Array()),parseFloat(getComputedStyle(camera).scale),
            {width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top});
          if (!result || typeof result !== 'object' || !('keys' in result) || !Array.isArray(result.keys) || !result.keys.every((key: unknown)=>typeof key==='string')) throw new Error('Invalid prepared selection keys');
          return result.keys.sort();
        },[...pages.values()]));
        await page.screenshot({path:new URL(`${sample.id}-dpr${dpr}.png`,output).pathname});
        console.log(JSON.stringify({dpr,sample:sample.id,complete,firstPaintMs,elapsedMs,pages:state.paging.desired.length,retries:state.paging.apiImages.retries}));
      }
      await page.evaluate(()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.setState({zoom:1.1}); });
      await page.waitForFunction(()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.length===0; });
      run.released=await page.evaluate(()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city; });
      assert.equal(run.released.apiImages.residentImages,0);
      assert.equal(run.network.some(url=>url.includes("earth-assets.lowpoly.cc")),false);
      assert.deepEqual(run.pageErrors,[]);await Promise.all(pending);
      assert.deepEqual(run.released.index.errors,[]);
    }finally{await context.close();}
  }
  if(!mobile)assert.deepEqual(report.runs[0].views.map(v=>[...v.state.paging.desired].sort()),report.runs[1].views.map(v=>[...v.state.paging.desired].sort()));
  report.passed=report.runs.every(run=>run.views.every(view=>view.complete));assert.ok(report.passed,"Incomplete provider view; see report.");
}finally{
  await browser?.close();
  await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output:output.pathname,passed:report.passed??false}));
}
