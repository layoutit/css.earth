import {required} from "../../../../tools/contract/test-values.mts";
import {pagePlanFixture,pageNodesFixture} from "./page-plan-fixture.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { PREPARED_EARTH_SCENE as scene } from "../../unit/earth/prepared-fixture.mts";
import { prepareLocationPoint } from "../../../../tools/objects/geographic-pages/prepare-location.mts";
import { polarGeographicUv } from "../../../../tools/objects/geographic-pages/wmts-polar-geometry.mts";
import { prepareCityPageGeometry, createCityGeographicSampler } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { prepareGeographicTextureQuad } from "../../../../tools/objects/geographic-pages/wms-page-geometry.mts";
import { prepareWmtsTile, wmtsAddress, wmtsLatitude, wmtsRow, mercatorStripErrorBound, WMTS_PIXEL_ERROR } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { isPreparedWmtsImage } from "../../../../src/renderers/css/dist/testing.js";
import { createApiImageTransport } from "../../../../src/renderers/css/dist/testing.js";
import { selectCityPages } from "../../../../src/renderers/css/dist/testing.js";
import type { WmtsPage } from "../../../../tools/objects/geographic-pages/contracts.mts";

function point(page: Pick<WmtsPage,"frameMatrix"|"textureMatrix"> & {imageMatrix?:string},u: number,v: number){
  let p=[u*256,v*256,0,1];
  for(const serialized of [page.imageMatrix,page.textureMatrix,page.frameMatrix].filter((value):value is string=>typeof value==="string")){
    const m=serialized.split(",").map(Number);
    p=[0,1,2,3].map(row=>p.reduce((sum,value,col)=>sum+m[col*4+row]*value,0));
  }
  return p.slice(0,3).map(v=>v/p[3]);
}

test("prepared WMTS strips bound Mercator distortion and crop complete provider tiles",()=>{
  for(const zoom of [5,8,11,14])for(const latitude of [-70,-34.6,0,33.75,60,74]){
    const address=wmtsAddress(-58.38,latitude,zoom);
    const pieces=prepareWmtsTile(address,scene);
    const crops=[...new Map(pieces.map(p=>[`${p.sourceCrop.v0}-${p.sourceCrop.v1}`,p.sourceCrop])).values()];
    assert.equal(crops[0].v0,0);assert.equal(required(crops.at(-1)).v1,1);
    for(let i=1;i<crops.length;i++)assert.equal(crops[i].v0,crops[i-1].v1);
    for(let i=0;i<pieces.length;i++){
      const p=pieces[i],{v0,v1}=p.sourceCrop;
      assert.equal(isPreparedWmtsImage(p),true);
      assert.ok(p.projectionErrorPixels<=WMTS_PIXEL_ERROR);
      const north=wmtsLatitude(address.y+v0,zoom),south=wmtsLatitude(address.y+v1,zoom);
      for(let sample=0;sample<=64;sample++){
        const v=sample/64;
        const observed=Math.abs(wmtsRow(north+(south-north)*v,zoom)-(address.y+v0+(v1-v0)*v))*256;
        assert.ok(observed<=p.projectionErrorPixels+1e-8);
      }
    }
  }
  assert.ok(mercatorStripErrorBound(5,3,4)>1);
});

test("WMTS positions agree with the existing geographic placement on both sides of seams",()=>{
  for(const longitude of [-180,-179.999,-58.38,0,112.499,112.5,179.999]){
    for(const latitude of [-34.6,33.749,33.751,60.17]){
      const pieces=prepareWmtsTile(wmtsAddress(longitude,latitude,12),scene);
      for(const page of pieces){
        const b=page.bounds;
        const [level,x,y]=page.coarseKey.split("-").map(Number);
        const coarse=prepareCityPageGeometry({level,x,y},scene);assert.ok("west" in coarse.bounds);
        const direct=prepareGeographicTextureQuad(coarse,b,8);
        for(const u of [0,.5,1])for(const v of [0,.5,1]){
          const lon=b.west+(b.east-b.west)*u,lat=b.north+(b.south-b.north)*v;
          const result=point(page,u,v);
          assert.ok(Math.hypot(...result.map((n,i)=>n-point(direct,u,v)[i]))<1e-7);
          if(lon>=coarse.bounds.west&&lon<=coarse.bounds.east&&lat>=coarse.bounds.south&&lat<=coarse.bounds.north){
            const reference=prepareLocationPoint(scene,((lon+180)%360+360)%360-180,lat);
            assert.ok(Math.hypot(...result.map((n,i)=>n-reference[i]))<.0011);
          }
        }
      }
    }
  }
});

test("WMTS rejects unsupported geometry and unexpected provider addresses",()=>{
  assert.ok(prepareWmtsTile(wmtsAddress(10,82,12),scene).some(p=>p.coarseKey === "0-0-15"));
  assert.throws(()=>prepareWmtsTile({zoom:12,x:-1,y:12},scene),/Invalid/);
  const p=prepareWmtsTile(wmtsAddress(-58,-34,12),scene)[0];
  for(const url of [p.url+"?token=x",p.url.replace("terrascope.be","example.com"),p.url.replace("webmercator/12","webmercator/20")])assert.equal(isPreparedWmtsImage({...p,url}),false);
});

const apiPage=()=>prepareWmtsTile(wmtsAddress(-58,-34,12),scene)[0];
test("a visible image below the metadata discovery cutoff still covers a small viewport",()=>{
  const node={key:"small",url:"prepared.png",normal:[0,0,1],corners:[[-20,-20,0],[20,-20,0],[20,20,0],[-20,20,0]],children:[],width:256,height:256};
  const plan=pagePlanFixture({roots:[node],poolSize:8,maximumDecodedBytes:8*256*256*4,decodedPageBytes:256*256*4});
  const selected=selectCityPages(plan,pageNodesFixture([node]),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],1,{width:390,height:844});
  assert.deepEqual(selected.keys,[node.key]);
});
const png=()=>new Response(new Uint8Array(10),{headers:{"Content-Type":"image/png"}});
test("split leaves share a request and release the blob only after the final consumer",async()=>{
  let complete:((response:Response)=>void)|undefined,calls=0;
  const transport=createApiImageTransport({fetchImage:()=>{calls++;return new Promise(r=>{complete=r;});}});
  const a=transport.acquire(apiPage()),b=transport.acquire(apiPage());
  a.release();required(complete)(png());
  const url=await b.ready;
  assert.match(url,/^blob:/);assert.equal(calls,1);assert.equal(transport.stats().residentImages,1);
  b.release();assert.equal(transport.stats().residentImages,0);assert.equal(transport.stats().residentEncodedBytes,0);
  transport.destroy();
});

test("transient errors use bounded retries and honor Retry-After without a request loop",async()=>{
  let calls=0;const waits:number[]=[];
  const transport=createApiImageTransport({fetchImage:async()=>{
    calls++;return calls===1?new Response("Busy",{status:429,headers:{"retry-after":"2"}}):png();
  },wait:async(ms)=>{waits.push(ms);}});
  const a=transport.acquire(apiPage());await a.ready;
  assert.equal(calls,2);assert.deepEqual(waits,[2000]);assert.equal(transport.stats().retries,1);a.release();
  const broken=createApiImageTransport({fetchImage:async()=>{throw new TypeError("Network");},wait:async()=>{}});
  const b=broken.acquire(apiPage());await assert.rejects(b.ready,/Network/);
  assert.equal(broken.stats().requests,3);b.release();
  const slow=createApiImageTransport({fetchImage:async()=>new Response("Busy",{status:429,headers:{"retry-after":"120"}}),wait:async()=>assert.fail("Must not retry before server permits")});
  const c=slow.acquire(apiPage());await assert.rejects(c.ready,/429/);assert.equal(slow.stats().requests,1);c.release();
});

test("last-consumer release cancels a retry wait and teardown leaves no resident image",async()=>{
  let waiting:()=>void=()=>{throw new Error("Retry gate not initialized");};
  const started=new Promise<void>(resolve=>{waiting=resolve;});
  const transport=createApiImageTransport({fetchImage:async()=>new Response("Busy",{status:503}),
    wait:(_,signal)=>new Promise((resolve,reject)=>{waiting();signal.addEventListener("abort",()=>reject(signal.reason),{once:true});})});
  const handle=transport.acquire(apiPage());const outcome=assert.rejects(handle.ready);
  await started;handle.release();await outcome;
  assert.equal(transport.stats().requests,1);assert.equal(transport.stats().residentImages,0);
  transport.destroy();assert.throws(()=>transport.acquire(apiPage()),/Invalid/);
});


test("polar inverse preserves the accepted cap sampler at all sectors and apron edges",()=>{
  for(const sign of [-1,1]){
    const cap=prepareCityPageGeometry({level:0,x:0,y:sign===1?15:0},scene),sample=createCityGeographicSampler(cap);
    for(let lon=-180;lon<180;lon+=2.25)for(const latitude of [76,78.749,78.75,78.751,82,85]){
      const uv=polarGeographicUv(cap,lon,sign*latitude),actual=sample(uv[0],uv[1]);
      const delta=((actual[0]-lon+540)%360)-180;
      assert.ok(Math.abs(delta)<1e-7,`longitude ${lon}: ${delta}`);
      assert.ok(Math.abs(actual[1]-sign*latitude)<1e-7);
    }
  }
});

test("polar prepared matrices meet the source-pixel tolerance inside each patch",()=>{
  for(const zoom of [5,8,11,14])for(const longitude of [-180,-90,0,15,90,179.99])for(const latitude of [-82,78.75,82]){
    const address=wmtsAddress(longitude,latitude,zoom);
    const pieces=prepareWmtsTile(address,scene).filter(p=>["0-0-0","0-0-15"].includes(p.coarseKey));
    const cap=prepareCityPageGeometry({level:0,x:0,y:latitude>0?15:0},scene),sample=createCityGeographicSampler(cap),proj=required(cap.geographicProjection),m=proj.matrix;
    for(const page of pieces)for(let j=0;j<=8;j++)for(let i=0;i<=8;i++){
      const [wx,wy]=point(page,i/8,j/8),dx=wx-m[12],dy=wy-m[13],det=m[0]*m[5]-m[4]*m[1];
      const u=((dx*m[5]-m[4]*dy)/det-proj.x0)/(proj.x1-proj.x0),v=((m[0]*dy-dx*m[1])/det-proj.y0)/(proj.y1-proj.y0);
      const [lon,lat]=sample(u,v),crop=page.sourceCrop;
      const expectedLon=-180+(address.x+crop.u0+(crop.u1-crop.u0)*i/8)/2**zoom*360;
      const expectedRow=address.y+crop.v0+(crop.v1-crop.v0)*j/8;
      const dxpx=(((lon-expectedLon+540)%360)-180)/360*2**zoom*256;
      const dypx=(wmtsRow(lat,zoom)-expectedRow)*256;
      assert.ok(Math.hypot(dxpx,dypx)<.125+1e-6,`${zoom} ${longitude} ${latitude}: ${dxpx},${dypx}`);
    }
  }
});
