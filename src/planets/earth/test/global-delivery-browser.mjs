import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const root=resolve(import.meta.dirname,"../../../.."),base=process.argv[2]??"http://127.0.0.1:4228";
const output=resolve(root,`output/playwright/global-delivery-${Date.now()}`);
await mkdir(output,{recursive:true});
const report={base,output,qualification:"Unchanged built application bytes served by the harness on the production application origin; geometry and imagery fetched from their real public endpoints. The live application is not deployed by this test.",runs:[]};
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const browser=await chromium.launch({channel:"chrome",headless:true});report.browser=browser.version();
try{
  for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:dpr,
      recordVideo:{dir:output,size:{width:1400,height:1000}}});
    const run={dpr,errors:[],ranges:[],providerRequests:0,views:[],scripts:[]};report.runs.push(run);
    let page;const pending=new Set();
    try{
      await context.route("https://css.earth/**",async route=>{
        const url=new URL(route.request().url());
        assert.ok(!/\/wmts-[a-f0-9]{16}\//u.test(url.pathname),"Production must request geometry from the public asset origin");
        const response=await fetch(`${base}${url.pathname}${url.search}`),bytes=Buffer.from(await response.arrayBuffer());
        if(url.pathname.startsWith("/_astro/")&&url.pathname.endsWith(".js")){
          const local=await readFile(resolve(root,"dist",url.pathname.slice(1)));
          assert.equal(sha(bytes),sha(local));run.scripts.push({path:url.pathname,sha256:sha(bytes)});
        }
        await route.fulfill({status:response.status,headers:{"content-type":response.headers.get("content-type")??"application/octet-stream"},body:bytes});
      });
      page=await context.newPage();
      page.on("pageerror",error=>run.errors.push(error.message));
      page.on("request",request=>{
        if(request.url().includes(".pack")||request.url().includes("mapproxy")||request.url().includes("earth-noise-day-"))pending.add(request);
        if(request.url().includes("mapproxy"))run.providerRequests++;
      });
      page.on("requestfinished",request=>pending.delete(request));
      page.on("requestfailed",request=>{pending.delete(request);if(!request.failure()?.errorText.includes("ERR_ABORTED"))run.errors.push(`${request.url()}: ${request.failure()?.errorText}`)});
      page.on("response",response=>{
        if(response.url().includes(".pack"))run.ranges.push({url:response.url(),status:response.status(),range:response.headers()["content-range"],cache:response.headers()["cf-cache-status"]});
        if(response.status()>=400)run.errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await page.goto("https://css.earth/earth/");
      await page.waitForFunction(()=>document.documentElement.dataset.ready==="true");
      await page.locator('input[name="motion"]').uncheck();
      await page.evaluate(()=>window.__deliveryNodes=[...document.querySelector(".planet-stage").querySelectorAll("*")]);
      const settled=async prefix=>{
        let prior="",quiet=Date.now();const start=Date.now();
        while(Date.now()-start<120000){
          const keys=await page.evaluate(prefix=>[...document.querySelectorAll("[data-city-page]")].filter(n=>n.style.visibility==="visible"&&n.dataset.cityPage.startsWith(prefix)).map(n=>n.dataset.cityPage).sort(),prefix);
          const current=keys.join(",");if(current!==prior||pending.size){quiet=Date.now();prior=current}
          if(current&&!pending.size&&Date.now()-quiet>=1000)return keys;
          await page.waitForTimeout(100);
        }throw new Error(`Public ${prefix} imagery did not settle`);
      };
      for(const [name,label] of [["Buenos Aires","Buenos Aires, Buenos Aires F.D., Argentina"],["Tokyo","Tokyo, Tokyo, Japan"]]){
        await page.locator(".planet-sidebar-search").fill(name);
        const start=Date.now();await page.getByRole("button",{name:label,exact:true}).click();
        await page.waitForFunction(()=>document.querySelector(".planet-destination-panel")?.ariaBusy==="false");
        const keys=await settled("wmts-");
        run.views.push({name,keys,elapsedMs:Date.now()-start});
        await page.screenshot({path:resolve(output,`${name.toLowerCase().replaceAll(" ","-")}-dpr${dpr}.png`)});
        if(name==="Buenos Aires"){
          await page.locator('button[name="lens"][value="buenos-aires-noise"]').click();
          const noise=await settled("noise-");assert.ok(noise.length>0);
          run.views.push({name:"noise",keys:noise});
          await page.screenshot({path:resolve(output,`noise-dpr${dpr}.png`)});
          await page.locator('button[name="lens"][value="normal"]').click();
        }
      }
      run.stable=await page.evaluate(()=>{const current=[...document.querySelector(".planet-stage").querySelectorAll("*")];return current.length===window.__deliveryNodes.length&&current.every((n,i)=>n===window.__deliveryNodes[i])});
      assert.ok(run.stable);assert.deepEqual(run.errors,[]);assert.ok(run.scripts.length&&run.providerRequests);
      assert.ok(run.ranges.length&&run.ranges.every(r=>r.status===206&&r.range&&r.url.startsWith("https://earth-assets.lowpoly.cc/")));
      assert.ok(run.ranges.some(r=>r.cache==="HIT"));run.complete=true;
    }finally{await context.close();run.video=await page?.video()?.path();}
    console.log(JSON.stringify({dpr,complete:run.complete,ranges:run.ranges.length,output}));
  }
  assert.deepEqual(report.runs[0].views.map(v=>v.keys),report.runs[1].views.map(v=>v.keys));
  report.complete=true;
}finally{await browser.close();await writeFile(resolve(output,"report.json"),JSON.stringify(report,null,2)+"\n");}
