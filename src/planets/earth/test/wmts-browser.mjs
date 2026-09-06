import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { dev } from "astro";
import { chromium } from "playwright";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_CITY_PAGES as existing } from "../runtime/preparedCityPages.mjs";
import { PREPARED_PRESENTATION as presentation } from "../runtime/preparedPresentation.mjs";
import { prepareWmtsTile,wmtsAddress,WMTS_RASTER_SCALE } from "../tools/city/wmts-page-geometry.mjs";
import { prepareLocationPoint,prepareLocationCamera } from "../tools/city/prepare-location.mjs";
import { prepareWmtsBlocks } from "../tools/city/prepare-wmts-blocks.mjs";

const root=new URL("../../../../",import.meta.url);
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
].filter(sample=>!selected||sample.id===selected);
assert.ok(samples.length);
const pages=new Map();
for(const sample of samples){
  const center=wmtsAddress(sample.longitude,sample.latitude,tileZoom),n=2**tileZoom;
  for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){
    for(const p of prepareWmtsTile({zoom:tileZoom,x:(center.x+dx+n)%n,y:center.y+dy},scene))pages.set(p.key,p);
  }
  sample.camera=prepareLocationCamera(scene,prepareLocationPoint(scene,sample.longitude,sample.latitude),1024*2**(tileZoom-12));
}
// These diagnostic roots are complete image pieces (or flat packed groups),
// not the production tile quadtree. Use the existing generic page traversal.
const plan={...existing,topology:undefined,roots:[...pages.values()],initialLayer:pages.values().next().value,
  rasterScale:WMTS_RASTER_SCALE,decodedPageBytes:256*256*4,pageTemplate:"clipped-projective",
  qualification:"Bounded prepared WMTS windows: direct imagery, source identity and retained lifetime. This diagnostic does not qualify global coverage."};
const blocks=packed?prepareWmtsBlocks([...pages.values()],plan.dataset):null;
if(blocks)plan.roots=blocks.roots;
const report={capturedAt:new Date().toISOString(),tileZoom,mobile,qualification:plan.qualification,
  planBytes:Buffer.byteLength(JSON.stringify(plan)),responses:[],runs:[],samples,mode:"headless",channel:"chrome"};
if(blocks)report.blocks={count:blocks.files.length,encodedBytes:blocks.files.reduce((sum,file)=>sum+file.ref.bytes,0),
  decodedBytes:blocks.files.reduce((sum,file)=>sum+file.ref.decodedBytes,0),fullJsonBytes:Buffer.byteLength(JSON.stringify([...pages.values()])),references:blocks.files.map(file=>file.ref)};
await writeFile(new URL("plan.json",output),JSON.stringify(plan));
// Substitute prepared data in the diagnostic server, not through browser
// routing: Playwright routing disables HTTP caching and invalidates cache tests.
const config=new URL("astro.config.mjs",output);
const diagnosticPresentation={...presentation,pageLayers:presentation.pageLayers.map(layer=>layer.id==='city'
  ?{...layer,plan:{...layer.plan,...plan,schema:layer.plan.schema,assetPath:layer.plan.assetPath}}:layer)};
const moduleBody=`export const PREPARED_PRESENTATION=Object.freeze(${JSON.stringify(diagnosticPresentation)});`;
if(blocks)for(const file of blocks.files)await writeFile(new URL(file.ref.url.split("/").at(-1),output),file.bytes);
const blockPaths=Object.fromEntries((blocks?.files??[]).map(file=>[file.ref.url,new URL(file.ref.url.split("/").at(-1),output).pathname]));
await writeFile(config,`import base from ${JSON.stringify(new URL("astro.config.mjs",root).href)};
import {readFile} from "node:fs/promises";
export default {...base,vite:{...base.vite,plugins:[{name:"prepared-wmts-diagnostic",enforce:"pre",load(id){
if(id.endsWith("/src/planets/earth/runtime/preparedPresentation.mjs"))return ${JSON.stringify(moduleBody)};
},configureServer(server){const paths=${JSON.stringify(blockPaths)};server.middlewares.use(async(req,res,next)=>{
const path=paths[req.url];if(!path)return next();const bytes=await readFile(path);
res.setHeader("Content-Type","application/octet-stream");res.setHeader("Cache-Control","public,max-age=31536000,immutable");res.end(bytes);
});}}]}};`);
let server,base,browser;
try{
  server=await dev({root,configFile:config.pathname.slice(root.pathname.length),server:{host:"127.0.0.1",port:4308},logLevel:"error"});
  base=`http://127.0.0.1:${server.address.port}`;
  report.base=base;
  browser=await chromium.launch({channel:"chrome",headless:true});report.browser=browser.version();
  for(const dpr of mobile?[2]:[1,2]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:1000},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile});
    const run={dpr,views:[],pageErrors:[],failures:[],servedFromCache:[],network:[]};report.runs.push(run);
    const pending=[];
    try{
      const page=await context.newPage(),cdp=await context.newCDPSession(page),urls=new Map();
      await cdp.send("Network.enable");
      cdp.on("Network.requestWillBeSent",event=>urls.set(event.requestId,event.request.url));
      cdp.on("Network.requestServedFromCache",event=>{const url=urls.get(event.requestId);if(url?.includes("/mapproxy/wmts/"))run.servedFromCache.push(url);});
      cdp.on("Network.responseReceived",event=>{if(event.response.fromDiskCache&&event.response.url.includes("/mapproxy/wmts/"))run.servedFromCache.push(event.response.url);});
      page.on("pageerror",error=>run.pageErrors.push(error.message));
      page.on("requestfailed",request=>run.failures.push({url:request.url(),failure:request.failure()}));
      page.on("response",response=>{
        if(!response.url().includes("/mapproxy/wmts/"))return;
        pending.push((async()=>{
          const bytes=await response.body(),sha256=createHash("sha256").update(bytes).digest("hex");
          report.responses.push({dpr,url:response.url(),status:response.status(),sha256,bytes:bytes.length,
            timing:response.request().timing(),cacheControl:response.headers()["cache-control"],cors:response.headers()["access-control-allow-origin"]});
          await writeFile(new URL(`${sha256}.png`,output),bytes);
        })().catch(error=>run.failures.push({url:response.url(),error:error.message})));
      });
      page.on("request",request=>{if(request.url().includes("/mapproxy/")||request.url().includes("earth-assets.lowpoly.cc"))run.network.push(request.url());});
      await page.goto(`${base}/earth/`);await page.waitForFunction(()=>window.__earth?.ready);
      await page.evaluate(()=>{{ const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); }window.__wmtsNodes=[...document.querySelector(".planet-stage").querySelectorAll("*")];});
      for(const sample of [...samples,{...samples[0],id:`${samples[0].id}-warm`}]){
        // Release the previous view even when testing one location, so a warm
        // result must reuse a verified resource or the provider's HTTP cache.
        await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
        await page.waitForFunction(()=>window.__earth.runtime.pages().city.retained.length===0);
        const start=Date.now(),cacheBefore=run.servedFromCache.length;
        await page.evaluate(camera=>window.__earth.camera.setState(camera),sample.camera);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        if(!packed&&await page.evaluate(()=>window.__earth.runtime.pages().city.desired.length===0)){
          const diagnostic=await page.evaluate(async pages=>{
            const {projectCityPage}=await import('/src/platform/prepared-map/city-page-selection.mjs');
            const stage=document.querySelector('.planet-stage'),camera=stage.querySelector('.polycss-camera');
            const m=new DOMMatrix(getComputedStyle(stage.querySelector('.polycss-scene')).transform)
              .multiply(new DOMMatrix(getComputedStyle(stage.querySelector('.earth-system')).transform))
              .multiply(new DOMMatrix(getComputedStyle(stage.querySelector('.earth-body:not(.earth-body-polar)')).transform));
            const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
            const viewport={width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top};
            const projected=pages.map(p=>projectCityPage(p,Array.from(m.toFloat64Array()),parseFloat(getComputedStyle(camera).scale),viewport));
            return {camera:window.__earth.camera.state(),viewport,visible:projected.filter(p=>p.visible).map(p=>p.span),stats:window.__earth.runtime.pages().city};
          },plan.roots);
          run.selectionFailure=diagnostic;throw new Error(`No selected WMTS page: ${JSON.stringify(diagnostic)}`);
        }
        await page.waitForFunction(()=>window.__earth.runtime.pages().city.retained.some(slot=>slot.published),null,{timeout:120000});
        const firstPaintMs=Date.now()-start;
        const firstPublished=await page.evaluate(()=>window.__earth.runtime.pages().city.retained.filter(slot=>slot.published).length);
        await page.waitForFunction(()=>{
          const s=window.__earth.runtime.pages().city;return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads;
        },null,{timeout:120000});
        const elapsedMs=Date.now()-start;
        const state=await page.evaluate(()=>({paging:window.__earth.runtime.pages().city,stable:window.__earth.assertStableDomIdentity(),
          identical:[...document.querySelector(".planet-stage").querySelectorAll("*")].every((n,i)=>n===window.__wmtsNodes[i]),nodes:window.__wmtsNodes.length}));
        const complete=state.paging.desired.every(key=>state.paging.retained.some(p=>p.key===key&&p.ready&&p.published));
        run.views.push({id:sample.id,firstPaintMs,firstPublished,elapsedMs,complete,cachedResponses:run.servedFromCache.length-cacheBefore,state});
        assert.ok(state.stable&&state.identical);assert.ok(state.paging.reservedDecodedBytes<=state.paging.decodedPageByteBound);
        assert.deepEqual([...state.paging.desired].sort(),await page.evaluate(async records=>{
          const {selectCityPages}=await import('/src/platform/prepared-map/city-page-selection.mjs');
          const stage=document.querySelector('.planet-stage'),camera=stage.querySelector('.polycss-camera');
          const matrix=new DOMMatrix(getComputedStyle(stage.querySelector('.polycss-scene')).transform)
            .multiply(new DOMMatrix(getComputedStyle(stage.querySelector('.earth-system')).transform))
            .multiply(new DOMMatrix(getComputedStyle(stage.querySelector('.earth-body:not(.earth-body-polar)')).transform));
          const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
          return selectCityPages({roots:records,poolSize:512,maximumDecodedBytes:103833600},new Map(records.map(p=>[p.key,p])),Array.from(matrix.toFloat64Array()),parseFloat(getComputedStyle(camera).scale),
            {width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top}).keys.sort();
        },[...pages.values()]));
        await page.screenshot({path:new URL(`${sample.id}-dpr${dpr}.png`,output).pathname});
        console.log(JSON.stringify({dpr,sample:sample.id,complete,firstPaintMs,elapsedMs,pages:state.paging.desired.length,retries:state.paging.apiImages.retries,cachedResponses:run.servedFromCache.length-cacheBefore}));
      }
      await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
      await page.waitForFunction(()=>window.__earth.runtime.pages().city.retained.length===0);
      run.released=await page.evaluate(()=>window.__earth.runtime.pages().city);
      assert.equal(run.released.apiImages.activeImages,0);
      assert.ok(run.released.apiImages.idleImages>0,"Released pages remain available for bounded reuse");
      assert.ok(run.released.apiImages.entries<=run.released.apiImages.maximumEntries);
      assert.ok(run.released.apiImages.decodedBytes<=run.released.apiImages.maximumDecodedBytes);
      assert.equal(run.network.some(url=>url.includes("earth-assets.lowpoly.cc")),false);
      assert.deepEqual(run.pageErrors,[]);await Promise.all(pending);
      assert.deepEqual(run.released.index.errors,[]);
      assert.ok(run.views.at(-1).cachedResponses>0 || run.views.at(-1).state.paging.apiImages.hits>run.views[0].state.paging.apiImages.hits,
        "Warm revisit must reuse verified image identities or cached HTTP responses");
      const destroyed=await page.evaluate(()=>{
        const runtime=window.__earth.runtime;
        window.dispatchEvent(new PageTransitionEvent("pagehide"));
        return runtime.pages().city.apiImages;
      });
      assert.equal(destroyed.residentImages,0);
    }finally{await context.close();}
  }
  if(!mobile)assert.deepEqual(report.runs[0].views.map(v=>[...v.state.paging.desired].sort()),report.runs[1].views.map(v=>[...v.state.paging.desired].sort()));
  report.passed=report.runs.every(run=>run.views.every(view=>view.complete));assert.ok(report.passed,"Incomplete provider view; see report.");
}finally{
  await browser?.close();await server?.stop();
  await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output:output.pathname,passed:report.passed??false}));
}
