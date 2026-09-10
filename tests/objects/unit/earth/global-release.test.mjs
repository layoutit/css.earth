import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PREPARED_EARTH_CITY_PAGES as plan } from "./prepared-fixture.mjs";
import { PREPARED_EARTH_SCENE as scene } from "./prepared-fixture.mjs";
import { readWorldCoverCatalog } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mts";
import { prepareWmtsCoverage } from "../../../../tools/objects/geographic-pages/wmts-coverage.mts";
import { prepareWmtsTile,wmtsAddress } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { readPreparedWmtsBlock,isPreparedBlockReference } from "../../../../src/renderers/css/dist/testing.js";

const pinBytes=await readFile(new URL("../../../../src/planets/earth/source/city/wmts-release.json",import.meta.url));
const pin=JSON.parse(pinBytes),hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const files=new Map(pin.files.map(file=>[file.filename,file]));
const root=new URL(`../../../../.local/wmts-global/${pin.version}/`,import.meta.url);

test("the global release closes over every published source footprint and pins each pack",async()=>{
  const {pin:catalog,entries}=await readWorldCoverCatalog({directory:new URL("../../../../src/planets/earth/source/city/",import.meta.url)});
  const source=JSON.parse(await readFile(new URL("../../../../src/planets/earth/source/manifest.json",import.meta.url)));
  const document=source.inputs.find(d=>d.path==="city/wmts-release.json");
  assert.equal(hash(pinBytes),document.expectedSha256);assert.equal(pinBytes.length,document.expectedBytes);
  assert.equal(pin.sourceSha256,catalog.expectedSha256);assert.equal(plan.geometryVersion,pin.version);
  assert.equal(plan.topology,"wmts-quadtree@1");assert.equal(plan.canonicalDprIndependent,true);
  const levels=Array.from({length:10},(_,i)=>prepareWmtsCoverage([...entries.values()],i+5,{includePolar:true}));
  assert.equal(pin.tiles,levels.reduce((sum,l)=>sum+l.tileCount,0));
  assert.equal(pin.regions,levels[3].tileCount);assert.equal(plan.roots.length,levels[0].tileCount);
  assert.equal(files.size,pin.regions+plan.roots.length);
  assert.equal(pin.bytes,pin.files.reduce((sum,f)=>sum+f.bytes,0));
  assert.equal(pin.leaves,pin.files.reduce((sum,f)=>sum+f.leaves,0));
  for(const file of pin.files){
    assert.match(file.filename,/^(?:5|8)-\d+-\d+\.pack$/);assert.match(file.sha256,/^[a-f0-9]{64}$/);
    assert.ok(file.bytes>0&&file.bytes<=32*1024*1024);
  }
  for(const node of plan.roots){
    assert.equal(node.level,5);assert.equal(node.stub,true);assert.equal(node.pages,undefined);
    assert.ok(isPreparedBlockReference(node.directory));assert.ok(node.coverageParts.length);
    assert.ok(files.has(node.directory.url.split("/").at(-1)));
  }
  assert.equal(plan.poolSize,512);assert.ok(plan.maximumDecodedBytes<=128*1024*1024);
  assert.ok(plan.index.maximumBytes<=12*1024*1024);assert.ok(plan.index.maximumConcurrentLoads<=3);
});

test("actual global pack ranges reproduce preparation through city, dateline and polar paths",async()=>{
  const decode=async ref=>{
    const name=ref.url.split("/").at(-1),bytes=await readFile(new URL(name,root)),file=files.get(name);
    assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
    return readPreparedWmtsBlock(new Response(bytes.subarray(ref.offset,ref.offset+ref.bytes),{
      status:206,headers:{"Content-Range":`bytes ${ref.offset}-${ref.offset+ref.bytes-1}/${bytes.length}`}}),ref);
  };
  for(const [lon,lat] of [[-58.3816,-34.6037],[139.6917,35.6895],[179.99,-16.78],[15.6469,78.2232]]){
    const key=zoom=>{const a=wmtsAddress(lon,lat,zoom);return `wmts-tile-${zoom}-${a.x}-${a.y}`;};
    let current=await decode(plan.roots.find(n=>n.key===key(5)).directory);
    for(const zoom of [8,11]){
      const stub=current.external.find(n=>n.key===key(zoom));assert.ok(stub.coverageParts.length);
      current=await decode(stub.directory);
    }
    const tile=current.nodes.find(n=>n.key===key(14));assert.ok(tile.pages.length);
    const expected=prepareWmtsTile(wmtsAddress(lon,lat,14),scene);
    assert.deepEqual(tile.pages,expected.map(p=>p.key));
    for(const page of expected){
      const actual=current.nodes.find(n=>n.key===page.key);
      for(const field of ["frameMatrix","textureMatrix","imageMatrix","corners","sourceCrop","url"])
        assert.deepEqual(actual[field],page[field],`${page.key}: ${field}`);
      assert.equal(actual.geographicMatrix,undefined);
    }
  }
});
