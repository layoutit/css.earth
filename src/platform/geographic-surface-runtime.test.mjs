import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createGeographicSurfaceRuntime } from "./geographic-surface-runtime.mjs";

const bytes = new Uint8Array([1,2,3,4]), sha256 = createHash("sha256").update(bytes).digest("hex");
const overview = { images: Array.from({length:8},(_,i)=>({slot:String(i),image:{url:`/image-${i}`,bytes:4,sha256,width:2,height:2}})) };
const image = () => ({src:"",naturalWidth:2,naturalHeight:2,async decode(){}});
const tick = () => new Promise(resolve => setImmediate(resolve));

test("overview transport caps concurrency, checks immutable bytes and publishes one complete retained bank", async () => {
  const requests = [], publications = [];
  const runtime = createGeographicSurfaceRuntime({ surface:{slots:overview.images.map(i=>i.slot),set:urls=>publications.push(urls),clear(){}}, createImage:image,
    fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{requests.push(()=>resolve(new Response(bytes))); signal.addEventListener("abort",()=>reject(signal.reason),{once:true});}) });
  const done = runtime.prepare(overview,new AbortController().signal);
  await tick(); assert.equal(requests.length,3); assert.equal(runtime.stats().activeLoads,3); assert.equal(publications.length,0);
  let completed = 0;
  while (completed < overview.images.length) {
    while (completed < requests.length) requests[completed++]();
    await tick(); await tick();
    assert.ok(runtime.stats().activeLoads<=3);
  }
  assert.equal(await done,true); assert.equal(publications.length,0);
  runtime.publish(); assert.equal(publications.length,1); assert.equal(publications[0].size,8);
  assert.equal(runtime.stats().reservedDecodedBytes,128);
  runtime.clear(); assert.equal(runtime.stats().retainedImages,0); runtime.destroy();
});

test("aborting an overview drains its queue before the next selection and cannot publish stale textures", async () => {
  let requests = 0;
  const runtime = createGeographicSurfaceRuntime({surface:{slots:overview.images.map(i=>i.slot),set(){assert.fail("stale publication");},clear(){}},createImage:image,
    fetcher:(_url,{signal})=>{requests++;return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));} });
  const first = runtime.prepare(overview,new AbortController().signal); await tick(); assert.equal(requests,3);
  const clear = runtime.prepare(null,new AbortController().signal);
  assert.equal(await first,false); assert.equal(await clear,true);
  assert.equal(runtime.stats().activeLoads,0); assert.equal(runtime.stats().retainedImages,0); runtime.publish(); runtime.destroy();
});

test("wrong bytes, decoded dimensions and HTTP failures retain the base and permit explicit retry", async () => {
  for (const failure of ["hash","dimensions","http"]) {
    let failed = true, publications = 0;
    const runtime = createGeographicSurfaceRuntime({surface:{slots:overview.images.map(i=>i.slot),set(){publications++;},clear(){}},
      createImage:()=>({...image(),naturalWidth:failed&&failure==="dimensions"?1:2}),
      fetcher:async()=>failed&&failure==="http"?new Response("",{status:503}):new Response(failed&&failure==="hash"?new Uint8Array(4):bytes) });
    await assert.rejects(runtime.prepare(overview,new AbortController().signal));
    assert.equal(publications,0); assert.equal(runtime.stats().retainedImages,0); assert.equal(runtime.stats().activeLoads,0);
    failed=false; assert.equal(await runtime.prepare(overview,new AbortController().signal),true); runtime.publish(); assert.equal(publications,1); runtime.destroy();
  }
});
