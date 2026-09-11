import assert from "node:assert/strict";
import test from "node:test";
import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mts";
import { prepareWmsPage } from "../../../../tools/objects/geographic-pages/wms-page-geometry.mts";
import { prepareCityPageGeometry, createCityGeographicSampler } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { isPreparedWmsImage, readWmsImage } from "../../../../src/renderers/css/dist/testing.js";
import type { PageGeometry } from "../../../../tools/objects/geographic-pages/contracts.mts";

function worldPoint(page: Pick<PageGeometry,'textureMatrix'|'frameMatrix'>,u: number,v: number) {
  let p=[u*1024,v*1024,0,1];
  for(const serialized of [page.textureMatrix,page.frameMatrix]) {
    const m=serialized.split(",").map(Number);
    p=[0,1,2,3].map(row=>p.reduce((sum,value,col)=>sum+m[col*4+row]*value,0));
  }
  return p.slice(0,3).map(v=>v/p[3]);
}

test("north-up API coordinates preserve accepted regular-face geographic positions",()=>{
  let checked=0;
  for(let y=1;y<=14;y++) for(const level of [0,3,7]) for(const x of [3,14,27]) {
    const factor=2**level;
    const address={level,x:x*factor+Math.floor(factor/2),y:y*factor+Math.floor(factor/2)};
    const existing=prepareCityPageGeometry(address,PREPARED_EARTH_SCENE);
    const direct=prepareWmsPage(address,PREPARED_EARTH_SCENE);
    assert.equal(isPreparedWmsImage(direct),true);
    const geographic=createCityGeographicSampler(existing);
    const b=direct.sourceBounds;
    for(const u of [0,.25,.5,.75,1])for(const v of [0,.25,.5,.75,1]){
      const [lon,lat]=geographic(u,v);
      const a=worldPoint(existing,u,v);
      const z=worldPoint(direct,(lon-b.west)/(b.east-b.west),(b.north-lat)/(b.north-b.south));
      assert.ok(Math.hypot(...a.map((n,i)=>n-z[i]))<1e-7,`Misregistered ${direct.key} at ${u},${v}`);
      checked++;
    }
  }
  assert.equal(checked,3150);
});

test("unprepared pole and dateline cases fail explicitly",()=>{
  assert.throws(()=>prepareWmsPage({level:0,x:0,y:15},PREPARED_EARTH_SCENE),/polar/);
  assert.throws(()=>prepareWmsPage({level:0,x:15,y:8},PREPARED_EARTH_SCENE),/antimeridian/);
});

test("provider requests are restricted to prepared endpoint, layer, coordinates and dimensions",()=>{
  const page=prepareWmsPage({level:5,x:857,y:157},PREPARED_EARTH_SCENE);
  assert.equal(isPreparedWmsImage(page),true);
  for(const change of [{WIDTH:"8192"},{LAYERS:"other"},{CRS:"EPSG:3857"},{BBOX:"-200,0,1,1"},{REQUEST:"GetCapabilities"}]){
    const url=new URL(page.url);
    for(const [key,value]of Object.entries(change))url.searchParams.set(key,value);
    assert.equal(isPreparedWmsImage({...page,url:url.href}),false);
  }
  assert.equal(isPreparedWmsImage({...page,url:page.url.replace("mapproxy.terrascope.be","example.com")}),false);
});

test("API transport rejects XML errors and excessive compressed bodies",async()=>{
  const page={width:2,height:2};
  await assert.rejects(readWmsImage(new Response("<ServiceException/>",{headers:{"content-type":"text/xml"}}),page),/not a PNG/);
  await assert.rejects(readWmsImage(new Response(new Uint8Array(65553),{headers:{"content-type":"image/png"}}),page),/transfer bound/);
  const blob=await readWmsImage(new Response(new Uint8Array(32),{headers:{"content-type":"image/png"}}),page);
  assert.equal(blob.size,32);
});
