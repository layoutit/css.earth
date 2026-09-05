import assert from "node:assert/strict";
import { mkdir,writeFile,readFile,open } from "node:fs/promises";
import { dev } from "astro";
import { chromium } from "playwright";
import { PREPARED_EARTH_NOISE as noisePlan } from "../runtime/preparedNoise.mjs";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_CITY_PAGES as existing } from "../runtime/preparedCityPages.mjs";
import { prepareRegionPack } from "../tools/city/prepare-wmts-tree.mjs";
import { prepareWmtsTile,wmtsAddress } from "../tools/city/wmts-page-geometry.mjs";
import { prepareLocationPoint,prepareLocationCamera } from "../tools/city/prepare-location.mjs";
const root=new URL("../../../../",import.meta.url),output=new URL(`output/playwright/wmts-tree-${Date.now()}/`,root);
await mkdir(output,{recursive:true});
const requested=process.argv.find(a=>a.startsWith("--sample="))?.slice(9),mobile=process.argv.includes("--mobile");
const noise=process.argv.includes("--noise");
const globalManifest=process.argv.find(a=>a.startsWith("--manifest="))?.slice(11)??(process.argv.includes("--global")?new URL(`../../../../.local/wmts-global/${existing.geometryVersion}/manifest.json`,import.meta.url).pathname:null);
const samples=[{id:"buenos-aires",lon:-58.3816,lat:-34.6037},{id:"helsinki",lon:24.9384,lat:60.1699},
  {id:"longyearbyen",lon:15.6469,lat:78.2232},{id:"antimeridian",lon:179.99,lat:-16.78},
  {id:"face-seam",lon:112.5,lat:33.75},{id:"tokyo",lon:139.6917,lat:35.6895}].filter(s=>!requested||s.id===requested);
const paths={},roots=[],version=globalManifest?JSON.parse(await readFile(globalManifest,"utf8")).version:"1111111111111111";
let manifest;
if(globalManifest){manifest=JSON.parse(await readFile(globalManifest,"utf8"));assert.ok(manifest.complete);roots.push(...manifest.roots);}
else for(const sample of samples){
  const center=wmtsAddress(sample.lon,sample.lat,8);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const address={zoom:8,x:(center.x+dx+256)%256,y:center.y+dy};
    const url=`/scenes/earth/wmts-${version}/8-${address.x}-${address.y}.pack`;
    if(paths[url])continue;
    const pack=prepareRegionPack(address,scene,()=>true,existing.dataset,version),path=new URL(url.split("/").at(-1),output).pathname;
    await writeFile(path,pack.bytes);paths[url]=path;roots.push(pack.root);
  }
}
const plan={...existing,index:{...existing.index,maximumBytes:12*1024*1024,maximumDirectories:96},topology:"wmts-quadtree@1",geometryVersion:version,roots,rasterScale:8,decodedPageBytes:256*256*4,pageTemplate:"clipped-projective",
  initialLayer:prepareWmtsTile(wmtsAddress(-58.38,-34.6,14),scene)[0],qualification:manifest?"Global prepared source-footprint index":"Regional pack transport checkpoint; worldwide build in progress"};
const config=new URL("astro.config.mjs",output);
await writeFile(config,globalManifest?`export { default } from ${JSON.stringify(new URL("astro.config.mjs",root).href)};`:`import base from ${JSON.stringify(new URL("astro.config.mjs",root).href)};
import {open,stat} from "node:fs/promises";
export default {...base,vite:{...base.vite,plugins:[{name:"wmts-tree-checkpoint",enforce:"pre",load(id){
if(id.endsWith("/src/planets/earth/runtime/preparedCityPages.mjs"))return ${JSON.stringify(`export const PREPARED_EARTH_CITY_PAGES=${JSON.stringify(plan)};`)};
},configureServer(server){const paths=${JSON.stringify(paths)},directory=${JSON.stringify(manifest?.directory??null)};
server.middlewares.use(async(req,res,next)=>{
const name=req.url?.match(/^\\/scenes\\/earth\\/wmts-${version}\\/((?:5|8)-\\d+-\\d+\\.pack)$/)?.[1];
const path=paths[req.url]??(directory&&name?directory+"/"+name:null);if(!path)return next();
try{const size=(await stat(path)).size,match=/^bytes=(\\d+)-(\\d+)$/.exec(req.headers.range??"");
if(!match){res.statusCode=416;res.end();return;}const start=Number(match[1]),end=Number(match[2]);
if(end>=size||end<start){res.statusCode=416;res.end();return;}
const handle=await open(path),bytes=Buffer.alloc(end-start+1);try{await handle.read(bytes,0,bytes.length,start);}finally{await handle.close();}
res.statusCode=206;res.setHeader("Content-Range",\`bytes \${start}-\${end}/\${size}\`);res.setHeader("Content-Length",bytes.length);
res.setHeader("Content-Type","application/octet-stream");res.setHeader("Cache-Control","public,max-age=31536000,immutable");res.end(bytes);
}catch(error){res.statusCode=500;res.end(error.message);}});}}]}};`);
let server,browser;
const report={output:output.pathname,createdAt:new Date().toISOString(),qualification:plan.qualification,runs:[]};
try{
  server=await dev({root,configFile:config.pathname.slice(root.pathname.length),server:{host:"127.0.0.1",port:4318},logLevel:"error"});
  browser=await chromium.launch({channel:"chrome",headless:true});report.browser=browser.version();
  for(const dpr of mobile?[2]:[1,2]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:1000},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile,recordVideo:{dir:output.pathname,size:{width:1400,height:1000}}});
    const page=await context.newPage(),run={dpr,views:[],errors:[],ranges:[],imagery:[]};report.runs.push(run);
    page.on("pageerror",error=>run.errors.push(error.message));
    page.on("response",async response=>{if(response.status()>=400 && !response.url().includes("mapproxy"))console.log(JSON.stringify({failedUrl:response.url(),status:response.status(),body:(await response.text().catch(()=>"")).slice(0,2500)}));});
    page.on("console",message=>{if(message.type()==="error")console.log(JSON.stringify({consoleError:message.text()}));});
    page.on("response",response=>{if(response.url().endsWith(".pack"))run.ranges.push({url:response.url(),status:response.status(),range:response.headers()["content-range"],bytes:Number(response.headers()["content-length"])});
      if(response.url().includes("mapproxy/wmts"))run.imagery.push({url:response.url(),status:response.status()});});
    try{
      await page.goto(`http://127.0.0.1:${server.address.port}/earth/`);await page.waitForFunction(()=>window.__earth?.ready);
      await page.evaluate(()=>{{ const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); }window.__savedNodes=[...document.querySelector(".planet-stage").querySelectorAll("*")];});
      for(const sample of [...samples,{...samples[0],id:samples[0].id+"-revisit"}]){
        const camera=noise?noisePlan.camera:prepareLocationCamera(scene,prepareLocationPoint(scene,sample.lon,sample.lat),noise?512:2048);
        const start=Date.now();
        if(noise)await page.evaluate(()=>window.__earth.lenses.select("buenos-aires-noise"));
        await page.evaluate(camera=>window.__earth.camera.setState(camera),camera);
        try{
          await page.waitForFunction(()=>{const s=window.__earth.cityPages.stats();return s.desired.length>0&&!s.pendingSelection&&!s.activeLoads&&!s.index.activeLoads&&s.desired.every(key=>s.retained.some(p=>p.key===key&&p.published));},null,{timeout:120000});
        }catch(error){run.failure=await page.evaluate(()=>window.__earth.cityPages.stats());throw error;}
        if(noise)await page.waitForFunction(()=>{const s=window.__earth.noisePages.stats();return s.desired.length>0&&!s.activeLoads&&s.desired.every(key=>s.retained.some(p=>p.key===key&&p.published));});
        const state=await page.evaluate(()=>({paging:window.__earth.cityPages.stats(),noise:window.__earth.noisePages.stats(),stable:window.__earth.assertStableDomIdentity(),identical:[...document.querySelector(".planet-stage").querySelectorAll("*")].every((n,i)=>n===window.__savedNodes[i]),nodes:window.__savedNodes.length}));
        assert.ok(state.stable&&state.identical);assert.deepEqual(state.paging.index.errors,[]);assert.deepEqual(state.paging.errors,[]);
        assert.ok(state.paging.reservedDecodedBytes<=plan.maximumDecodedBytes);assert.ok(state.paging.index.reservedDecodedBytes<=plan.index.maximumBytes);
        run.views.push({id:sample.id,elapsedMs:Date.now()-start,state});
        await page.screenshot({path:new URL(`${sample.id}${noise?"-noise":""}-dpr${dpr}.png`,output).pathname});
        if(process.argv.includes("--diagnose-polar")){
          run.diagnostic=await page.evaluate(()=>({
            camera:window.__earth.camera.state(),carriers:[...document.querySelectorAll(".earth-body")].map(n=>({class:n.className,transform:getComputedStyle(n).transform,style:getComputedStyle(n).transformStyle})),
            pages:[...document.querySelectorAll("[data-city-page]")].map(n=>({key:n.dataset.cityPage,transform:getComputedStyle(n).transform,childTransform:getComputedStyle(n.firstElementChild).transform,visibility:getComputedStyle(n).visibility}))}));
          await page.evaluate(()=>document.querySelectorAll(".earth-body-polar > s").forEach(n=>n.style.visibility="hidden"));
          await page.screenshot({path:new URL(`diagnostic-hidden-base-${dpr}.png`,output).pathname});
          await page.evaluate(()=>document.querySelectorAll(".earth-body-polar > s").forEach(n=>n.style.visibility=""));
        }
        console.log(JSON.stringify({dpr,sample:sample.id,elapsedMs:Date.now()-start,pages:state.paging.desired.length,metadata:state.paging.index.reservedDecodedBytes}));
      }
      assert.deepEqual(run.errors,[]);assert.ok(run.ranges.every(r=>r.status===206&&r.range));
      await page.evaluate(async()=>{await window.__earth.lenses.select("normal");window.__earth.camera.setState({zoom:1.1});});await page.waitForFunction(()=>window.__earth.cityPages.stats().retained.length===0);
    }finally{await context.close();run.video=await page.video()?.path();}
  }
  if(!mobile)assert.deepEqual(report.runs[0].views.map(v=>v.state.paging.desired),report.runs[1].views.map(v=>v.state.paging.desired));
  report.passed=true;
}finally{await browser?.close();await server?.stop();await writeFile(new URL("report.json",output),JSON.stringify(report,null,2));console.log(JSON.stringify({output:output.pathname,passed:report.passed??false}));}
