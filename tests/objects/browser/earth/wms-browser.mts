import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Request } from "playwright";
import { PREPARED_EARTH_SCENE, runtimeDefinition, preparePagingDiagnostic, routePagingDiagnostic } from "../../unit/earth/prepared-fixture.mts";
import { PREPARED_EARTH_CITY_PAGES } from "../../unit/earth/prepared-fixture.mts";
import { prepareWmsPage } from "../../../../tools/objects/geographic-pages/wms-page-geometry.mts";
import { prepareCityPageGeometry } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { pageCoordinates, prepareLocationPoint, prepareLocationCamera } from "../../../../tools/objects/geographic-pages/prepare-location.mts";

import type { PageLayerStats } from "../../../../src/renderers/css/runtime/object-runtime-types.js";
declare global { interface Window { __wmsNodes: readonly Element[] } }
type WmsRun = { dpr: number; views: { id: string; complete: boolean; state: { paging: PageLayerStats; stable: boolean; identical: boolean; nodes: number } }[]; pageErrors: string[]; requests: string[]; requestFailures: { url: string; failure: ReturnType<Request['failure']> }[] };
type WmsResponse = { dpr: number; url: string } & ({ error: string } | { status: number; bytes: number; sha256: string; cors?: string; contentType?: string });
const root=new URL("../../../../",import.meta.url);
const base=(process.argv.slice(2).find(argument=>/^https?:\/\//u.test(argument))??"http://127.0.0.1:4210").replace(/\/$/u,"");
const output=new URL(`output/playwright/wms-direct-${Date.now()}/`,root);
await mkdir(output,{recursive:true});
const selected=process.argv.find(arg=>arg.startsWith("--sample="))?.slice(9);
const samples=[
  {id:"buenos-aires",longitude:-58.3816,latitude:-34.6037},
  {id:"nairobi",longitude:36.8219,latitude:-1.2921},
  {id:"helsinki",longitude:24.9384,latitude:60.1699},
  {id:"face-seam",longitude:112.5,latitude:32.52},
].map(sample=>({...sample, camera:prepareLocationCamera(PREPARED_EARTH_SCENE,
  prepareLocationPoint(PREPARED_EARTH_SCENE,sample.longitude,sample.latitude),1024,
  {body:PREPARED_EARTH_SCENE.earth,camera:runtimeDefinition.camera})})).filter(sample=>!selected||sample.id===selected);
if(!samples.length)throw new Error("Unknown WMS sample.");
const roots=new Map<string, ReturnType<typeof prepareWmsPage>>();
for(const sample of samples){
  const longitude=(sample.longitude+360)%360;
  const rootX=Math.floor(longitude/11.25),rootY=Math.floor((sample.latitude+90)/11.25);
  // Geographic addresses and apron-partition addresses differ at face edges.
  // Find the sample in every neighboring accepted face during preparation.
  for(const rx of [rootX-1,rootX,rootX+1])for(const ry of [rootY-1,rootY,rootY+1]){
    if(rx<0||rx>31||ry<1||ry>14)continue;
    const coarse=prepareCityPageGeometry({level:0,x:rx,y:ry},PREPARED_EARTH_SCENE);
    const coordinates=pageCoordinates(coarse,longitude,sample.latitude);
    assert.ok(coordinates, "Geographic address must map into its prepared face");
    const [u,v]=coordinates;
    const x=Math.floor((-.25+32.5*u)/32*64),y=Math.floor((-.25+32.5*v)/32*64);
    for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
      if(x+dx<0||x+dx>=64||y+dy<0||y+dy>=64)continue;
      const page=prepareWmsPage({level:6,x:rx*64+x+dx,y:ry*64+y+dy},PREPARED_EARTH_SCENE);
      roots.set(page.key,page);
    }
  }

}
const initialLayer=roots.values().next().value;
assert.ok(initialLayer, "WMS diagnostic must have an initial layer");
const plan={...PREPARED_EARTH_CITY_PAGES,qualification:"Direct WMS diagnostic: four geographic windows; not global coverage.",
  roots:[...roots.values()], initialLayer};
const report: { capturedAt: string; qualification: string; planBytes: number; channel: string; mode: string; samples: typeof samples; runs: WmsRun[]; responses: WmsResponse[]; base?: string; browser?: string; passed?: boolean }={capturedAt:new Date().toISOString(),qualification:plan.qualification,
  planBytes:Buffer.byteLength(JSON.stringify(plan)),channel:"chrome",mode:"headless",samples,runs:[],responses:[]};
await writeFile(new URL("plan.json",output),JSON.stringify(plan));
let browser;
try{
  report.base=base;
  browser=await chromium.launch({channel:"chrome",headless:true});
  report.browser=browser.version();
  for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:dpr});
    const run: WmsRun={dpr,views:[],pageErrors:[],requests:[],requestFailures:[]};report.runs.push(run);
    const pending: Promise<unknown>[]=[];
    try{
      // Only the prepared plan is substituted. The canonical Earth route uses
      // the actual retained renderer and image loader; provider requests are live.
      await routePagingDiagnostic(context,await preparePagingDiagnostic(plan));
      const page=await context.newPage();
      page.on("pageerror",error=>run.pageErrors.push(error.message));
      page.on("requestfailed",request=>run.requestFailures.push({url:request.url(),failure:request.failure()}));
      page.on("request",request=>{
        if(request.url().includes("mapproxy.terrascope.be")||/city-.*\.(webp|json)$/.test(request.url()))run.requests.push(request.url());
      });
      page.on("response",response=>{
        if(!response.url().startsWith("https://mapproxy.terrascope.be/mapproxy/service?"))return;
        pending.push((async()=>{
          const bytes=await response.body();
          const sha256=createHash("sha256").update(bytes).digest("hex");
          report.responses.push({dpr,url:response.url(),status:response.status(),bytes:bytes.length,sha256,
            cors:response.headers()["access-control-allow-origin"],contentType:response.headers()["content-type"]});
          await writeFile(new URL(`${sha256}.png`,output),bytes);
        })().catch(error=>{report.responses.push({dpr,url:response.url(),error:error instanceof Error ? error.message : String(error)});}));
      });
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(()=>window.__earth?.ready);
      await page.evaluate(()=>{
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
        function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }

        { const motion = requiredInput(document.querySelector('input[name="motion"]')); if (motion.checked) motion.click(); }
        window.__wmsNodes=[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")];
      });
      for(const sample of samples){
        await page.evaluate(camera=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.setState(camera); },sample.camera);
        await page.waitForFunction(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          const s=requiredDiagnostics(window.__earth).runtime.pages().city;
          return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads;
        },null,{timeout:60000});
        const state=await page.evaluate(()=>{
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

          function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({
          paging:requiredDiagnostics(window.__earth).runtime.pages().city,stable:requiredDiagnostics(window.__earth).assertStableDomIdentity(),
          identical:[...requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*")].every((n,i)=>n===window.__wmsNodes[i]),
          nodes:window.__wmsNodes.length,
        }); });
        assert.equal(state.stable,true);assert.equal(state.identical,true);
        assert.deepEqual(state.paging.index.errors,[]);
        assert.ok(state.paging.desired.length>0);
        assert.ok(state.paging.reservedDecodedBytes<=state.paging.decodedPageByteBound);
        const complete=state.paging.desired.every(key=>state.paging.retained.some(slot=>slot.key===key&&slot.ready&&slot.published));
        run.views.push({id:sample.id,complete,state});
        await page.screenshot({path:new URL(`${sample.id}-dpr${dpr}.png`,output).pathname});
        console.log(JSON.stringify({dpr,sample:sample.id,pages:state.paging.desired.length,complete,errors:state.paging.errors}));
      }
      await page.evaluate(()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).camera.setState({zoom:1.1}); });
      await page.waitForFunction(()=>{
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__earth).runtime.pages().city.retained.length===0; });
      assert.equal(run.requests.some(url=>url.includes("earth-assets.lowpoly.cc")),false);
      assert.deepEqual(run.pageErrors,[]);
      await Promise.all(pending);
    }finally{await context.close();}
  }
  const pages=(run: WmsRun)=>run.views.map(view=>({id:view.id,keys:[...view.state.paging.desired].sort()}));
  assert.deepEqual(pages(report.runs[0]),pages(report.runs[1]));
  report.passed=report.runs.every(run=>run.views.every(view=>view.complete));
  assert.ok(report.passed,"At least one direct API view failed to load completely; see report.json.");
}finally{
  await browser?.close();
  await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output:output.pathname,passed:report.passed??false}));
}
