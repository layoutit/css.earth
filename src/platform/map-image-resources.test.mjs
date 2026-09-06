import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createApiImageTransport} from './prepared-map/api-image-transport.mjs';

const bytes=Buffer.from([1,2,3,4]);
const sha256=createHash('sha256').update(bytes).digest('hex');
const prepared=(id='a')=>({rasterSource:'prepared-raster@1',url:`/scenes/earth/${id}-${sha256.slice(0,16)}.webp`,sha256,bytes:bytes.length,width:2,height:2});
const api=()=>({rasterSource:'terrascope-wmts@1',url:'https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/webmercator/08/86/154.png',width:256,height:256});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function owner(t,options={}){const result=createApiImageTransport({createImage:page=>({src:"",naturalWidth:page.width,naturalHeight:page.height,async decode(){}}),...options});t.after(()=>result.destroy());return result;}
const scope=(store,maximumDecodedBytes=64,maximumEntries=4,extra={})=>store.createScope({maximumEntries,maximumDecodedBytes,...extra});
const confirm=lease=>lease.ready;

test('pages and overview scopes share verified bytes while retaining their own reservations',async t=>{
 let fetches=0,decodes=0;const native=[];
 const store=owner(t,{fetchImage:async()=>{fetches++;return new Response(bytes);},createImage:()=>{
   const image={src:'',naturalWidth:2,naturalHeight:2,async decode(){decodes++;}};native.push(image);return image;
 }}),pages=scope(store),overview=scope(store);
 const a=pages.acquire(prepared()),b=pages.acquire(prepared()),c=overview.acquire(prepared());
 const urls=await Promise.all([a,b,c].map(confirm));
 assert.equal(new Set(urls).size,1);assert.equal(fetches,1);
 assert.equal(pages.stats().decodedBytes,32);assert.equal(overview.stats().decodedBytes,16);
 a.release();b.release();assert.equal(pages.stats().decodedBytes,16);assert.equal(pages.stats().idleImages,1);
 const revisit=pages.acquire(prepared());assert.equal(await confirm(revisit),urls[0]);assert.equal(fetches,1);
 assert.equal(decodes,1);assert.equal(native.length,1);assert.equal(native[0].src,urls[0]);
 overview.destroy();assert.equal(store.stats().residentImages,1,'destroying one scope leaves the other lease alive');
 revisit.release();pages.destroy();assert.equal(store.stats().residentImages,0);assert.equal(native[0].src,'');
});

test('idle resources consume the old decoded and entry limits and yield to new demand',async t=>{
 const store=owner(t,{fetchImage:async()=>new Response(bytes)}),images=scope(store,32,2);
 const a=images.acquire(prepared('a')),b=images.acquire(prepared('b'));
 const first=await confirm(a);await confirm(b);a.release();
 const c=images.acquire(prepared('c'));await confirm(c);
 assert.equal(images.stats().decodedBytes,32);assert.equal(images.stats().entries,2);assert.equal(images.stats().evictions,1);
 assert.throws(()=>images.acquire(prepared('d')),/budget/);
 b.release();c.release();const again=images.acquire(prepared('a'));assert.notEqual(await confirm(again),first);again.release();
 assert.ok(images.stats().decodedBytes<=32);assert.ok(images.stats().entries<=2);
});

test('duplicate CSS bindings are charged individually even for one decoded resource',async t=>{
 const store=owner(t,{fetchImage:async()=>new Response(bytes)}),images=scope(store,32,4);
 const a=images.acquire(prepared()),b=images.acquire(prepared());await confirm(a);await confirm(b);
 assert.throws(()=>images.acquire(prepared()),/budget/);
 a.release();assert.equal(images.stats().decodedBytes,16);b.release();assert.equal(images.stats().decodedBytes,16);
});

test('idle expiry revokes resources without waiting for another camera update',async t=>{
 let time=0,callback=null;
 const store=owner(t,{now:()=>time,fetchImage:async()=>new Response(bytes),schedule:fn=>{callback=fn;return 1;},unschedule:()=>{callback=null;}}),images=scope(store,64,4,{idleMilliseconds:100});
 const a=images.acquire(prepared());await confirm(a);a.release();assert.equal(images.stats().idleImages,1);
 time=100;const fire=callback;callback=null;fire();assert.equal(store.stats().residentImages,0);assert.equal(callback,null);
});

test('provider freshness and no-store constrain idle identity reuse',async t=>{
 let time=0,calls=0;
 const store=owner(t,{now:()=>time,fetchImage:async()=>{calls++;return new Response(bytes,{headers:{'content-type':'image/png','cache-control':'max-age=10',age:'9'}});}}),images=scope(store,1048576,4);
 const a=images.acquire(api()),url=await confirm(a);a.release();time=500;
 const b=images.acquire(api());assert.equal(await confirm(b),url);b.release();assert.equal(calls,1);
 time=1001;const c=images.acquire(api());assert.notEqual(await confirm(c),url);c.release();assert.equal(calls,2);
 const uncached=owner(t,{fetchImage:async()=>new Response(bytes,{headers:{'content-type':'image/png','cache-control':'no-store,max-age=999'}})}),other=scope(uncached,1048576,4);
 const d=other.acquire(api());await confirm(d);d.release();assert.equal(uncached.stats().residentImages,0);
});

test('request accounting includes a held response body',async t=>{
 let writer;
 const stream=new ReadableStream({start(controller){writer=controller;}});
 const store=owner(t,{fetchImage:async()=>new Response(stream,{headers:{'content-type':'image/png'}})}),images=scope(store,1048576,4);
 const a=images.acquire(api());await tick();assert.equal(store.stats().activeRequests,1);assert.equal(store.stats().receivedBytes,0);
 writer.enqueue(bytes);writer.close();await confirm(a);assert.equal(store.stats().activeRequests,0);assert.equal(store.stats().receivedBytes,4);a.release();
});

test('canceling one consumer preserves a shared request for another owner',async t=>{
 let complete,fetches=0;
 const store=owner(t,{fetchImage:()=>{fetches++;return new Promise(resolve=>{complete=resolve;});}}),aScope=scope(store),bScope=scope(store),controller=new AbortController();
 const a=aScope.acquire(prepared(),{signal:controller.signal}),b=bScope.acquire(prepared());
 const canceled=assert.rejects(a.ready,{name:'AbortError'});controller.abort();await canceled;
 assert.equal(aScope.stats().entries,0);assert.equal(store.stats().residentImages,1);
 complete(new Response(bytes));await confirm(b);assert.equal(fetches,1);b.release();
});

test('a loading deadline cannot release an already decoded and displayed image',async t=>{
 const store=owner(t,{fetchImage:async()=>new Response(bytes)}),images=scope(store),controller=new AbortController();
 const a=images.acquire(prepared(),{signal:controller.signal});await confirm(a);
 controller.abort();assert.equal(images.stats().activeImages,1);assert.equal(images.stats().idleImages,0);
 a.release();assert.equal(images.stats().activeImages,0);assert.equal(images.stats().idleImages,1);
});

test('teardown aborts the final pending request and revokes all active and idle identities',async t=>{
 let requestSignal;
 const store=owner(t,{fetchImage:(url,{signal})=>url.includes('/pending-')?new Promise((_resolve,reject)=>{
   requestSignal=signal;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
 }):Promise.resolve(new Response(bytes))}),images=scope(store);
 const active=images.acquire(prepared('active')),idle=images.acquire(prepared('idle'));
 const urls=await Promise.all([active,idle].map(confirm));idle.release();
 const pending=images.acquire(prepared('pending'));const rejected=assert.rejects(pending.ready,{name:'AbortError'});
 store.destroy();await rejected;assert.equal(requestSignal.aborted,true);assert.equal(store.stats().residentImages,0);
 assert.equal(store.stats().activeRequests,0);assert.deepEqual(store.stats().scopes,[]);
 for(const url of urls)await assert.rejects(fetch(url));
 active.release();idle.release();pending.release();store.destroy();
 assert.throws(()=>images.acquire(prepared()),/destroyed/);
});

test('corrupt and invalidated images cannot enter idle reuse, and explicit retry succeeds',async t=>{
 let bad=true;
 const store=owner(t,{fetchImage:async()=>new Response(bad?Buffer.alloc(4):bytes)}),images=scope(store);
 const a=images.acquire(prepared());await assert.rejects(a.ready,/identity/);a.release();assert.equal(store.stats().residentImages,0);
 bad=false;const b=images.acquire(prepared());const url=await confirm(b);b.invalidate();b.release();
 const c=images.acquire(prepared());assert.notEqual(await confirm(c),url);c.release();
 assert.throws(()=>images.acquire({...prepared(),width:3}),/identity/);
});

test('native construction, decode and dimension failures cannot become reusable images',async t=>{
 for(const failure of ['construction','decode','dimensions']){
   let bad=true,requests=0;const native=[];
   const store=owner(t,{fetchImage:async()=>{requests++;return new Response(bytes);},createImage:()=>{
     if(bad&&failure==='construction')throw Error('construction');
     const image={src:'',naturalWidth:bad&&failure==='dimensions'?1:2,naturalHeight:2,async decode(){if(bad&&failure==='decode')throw TypeError('decode');}};
     native.push(image);return image;
   }}),images=scope(store);
   const a=images.acquire(prepared());await assert.rejects(a.ready,new RegExp(failure));a.release();
   assert.equal(store.stats().residentImages,0);assert.ok(native.every(image=>image.src===''));assert.equal(requests,1);
   bad=false;const b=images.acquire(prepared());await b.ready;assert.equal(store.stats().nativeImages,1);b.release();
 }
});

test('canceling a pending native decode clears it without waiting for the decoder',async t=>{
 let decoding;const started=new Promise(resolve=>{decoding=resolve;}),native=[];
 const store=owner(t,{fetchImage:async()=>new Response(bytes),createImage:()=>{
   const image={src:'',decode(){decoding();return new Promise(()=>{});}};native.push(image);return image;
 }}),images=scope(store);
 const a=images.acquire(prepared());const rejected=assert.rejects(a.ready,{name:'AbortError'});
 await started;assert.equal(store.stats().activeRequests,1);a.release();await rejected;
 assert.equal(native[0].src,'');assert.equal(store.stats().nativeImages,0);assert.equal(store.stats().activeRequests,0);
});

test('teardown continues through a failing native cleanup and revokes every blob',async t=>{
 const native=[],store=owner(t,{fetchImage:async()=>new Response(bytes),createImage:()=>{
   const image={src:'',naturalWidth:2,naturalHeight:2,async decode(){}};native.push(image);return image;
 }}),images=scope(store);
 const a=images.acquire(prepared('a')),b=images.acquire(prepared('b'));const urls=await Promise.all([a.ready,b.ready]);
 Object.defineProperty(native[0],'src',{set(){throw Error('native cleanup');}});
 assert.throws(()=>store.destroy(),AggregateError);assert.equal(native[1].src,'');
 assert.equal(store.stats().residentImages,0);assert.deepEqual(store.stats().scopes,[]);
 for(const url of urls)await assert.rejects(fetch(url));
});
