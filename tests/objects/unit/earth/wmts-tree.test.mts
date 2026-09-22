import {required} from "../../../../tools/contract/test-values.mts";
import {pagePlanFixture,pageNodesFixture} from "./page-plan-fixture.mts";
import {parseBlockReference} from "../../../../tools/objects/geographic-pages/source-records.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { PREPARED_EARTH_SCENE as scene } from "../../unit/earth/prepared-fixture.mts";
import { prepareRegionPack,coverageLookup } from "../../../../tools/objects/geographic-pages/prepare-wmts-tree.mts";
import { prepareWmtsCoverage } from "../../../../tools/objects/geographic-pages/wmts-coverage.mts";
import { wmtsAddress } from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mts";
import { readPreparedWmtsBlock,preparedReferenceKey } from "../../../../src/renderers/css/dist/testing.js";
import { createCityIndex } from "../../../../src/renderers/css/dist/testing.js";
import { selectCityPages } from "../../../../src/renderers/css/dist/testing.js";

const dataset="esa-worldcover-rgbnir-2021-v200",version="1111111111111111";
const pack=prepareRegionPack(wmtsAddress(-58.38,-34.6,8),scene,()=>true,dataset,version,{assetPath:'/scenes/earth/'});
const response=(input: unknown)=>{const ref=parseBlockReference(input);return new Response(pack.bytes.subarray(ref.offset,ref.offset+ref.bytes),{status:206,headers:{"Content-Range":`bytes ${ref.offset}-${ref.offset+ref.bytes-1}/${pack.bytes.length}`}});};
const plan=pagePlanFixture({assetPath:"/scenes/earth/",dataset,geometryVersion:version,assetOrigin:"https://earth-assets.lowpoly.cc",roots:[pack.root],index:{maximumDirectories:48,maximumBytes:3*1024*1024,maximumDirectoryBytes:2*1024*1024,maximumConcurrentLoads:3}});
test("regional ranges decode independently and preserve separate resident sections",async()=>{
  const root=await readPreparedWmtsBlock(response(pack.root.directory),pack.root.directory);
  assert.equal(root.external.length,64);
  const a=parseBlockReference(root.external[0].directory),b=parseBlockReference(root.external[1].directory);
  assert.equal(a.url,b.url);assert.notEqual(preparedReferenceKey(a),preparedReferenceKey(b));
  const wanted=[parseBlockReference(pack.root.directory),a,b];let changed=0;
  const index=createCityIndex(plan,()=>changed++,async(url,options)=>{
    const ref=wanted.find(ref=>new Headers(options?.headers).get("Range")===`bytes=${ref.offset}-${ref.offset+ref.bytes-1}`);
    assert.ok(ref);assert.equal(url,ref.url);return response(ref);
  });
  try{
    index.update(wanted);
    for(let i=0;i<100&&index.stats().activeLoads;i++)await new Promise(r=>setTimeout(r,20));
    assert.equal(changed,3);assert.equal(index.stats().residentDirectories,3);assert.deepEqual(index.stats().errors,[]);
    assert.equal(required(index.nodes().get(root.external[0].key)).stub,undefined);assert.equal(required(index.nodes().get(root.external[1].key)).stub,undefined);
    const retained=index.nodes().get(root.external[1].key);
    index.update([pack.root.directory,b]);assert.equal(required(index.nodes().get(root.external[0].key)).stub,true);
    assert.equal(required(index.nodes().get(root.external[1].key)).stub,undefined);
    assert.equal(index.nodes().get(root.external[1].key),retained,"unrelated section eviction preserves decoded node identity");
  }finally{index.destroy();}
});
test("range transport rejects a full-file response, shifted range, and corrupt bytes",async()=>{
  const ref=pack.root.directory;
  await assert.rejects(readPreparedWmtsBlock(new Response(pack.bytes),ref),/exact byte range/);
  const wrong=new Response(pack.bytes.subarray(ref.offset),{status:206,headers:{"Content-Range":`bytes 0-${ref.bytes-1}/${pack.bytes.length}`}});
  await assert.rejects(readPreparedWmtsBlock(wrong,ref),/exact byte range/);
  const bytes=Buffer.from(pack.bytes.subarray(ref.offset));bytes[20]^=1;
  await assert.rejects(readPreparedWmtsBlock(new Response(bytes,{status:206,headers:{"Content-Range":`bytes ${ref.offset}-${ref.offset+ref.bytes-1}/${pack.bytes.length}`}}),ref),/hash/);
});
test("a tile group retains every parent piece until all visible children are available",()=>{
  const corners=[[-100,-100,0],[100,-100,0],[100,100,0],[-100,100,0]],normal=[0,0,1];
  const parent={key:"root",level:5,corners,normal,pages:["apron","strip"],children:["child"],maximumCssSpan:1};
  const a={key:"apron",url:"a",corners,normal,width:256,height:256,children:[]},b={...a,key:"strip"};
  const ref=pack.root.directory,child={key:"child",level:6,corners,normal,stub:true,directory:ref};
  const localPlan=pagePlanFixture({...plan,roots:[parent],topology:"wmts-quadtree@1",poolSize:8,maximumDecodedBytes:8*256*256*4});
  const nodes=pageNodesFixture([parent,a,b,child]),matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],viewport={width:800,height:600};
  const first=selectCityPages(localPlan,nodes,matrix,1,viewport);assert.deepEqual(first.keys,["apron","strip"]);assert.equal(first.directories.length,1);
  for(const [key,node] of pageNodesFixture([{...child,stub:false,pages:["detail"],children:[]},{...a,key:"detail"}]))nodes.set(key,node);
  assert.deepEqual(selectCityPages(localPlan,nodes,matrix,1,viewport).keys,["detail"]);
});
test("worldwide source coverage includes polar footprints and stops at actual source gaps",()=>{
  const levels=[8,9].map(zoom=>prepareWmtsCoverage([{tile:"N82E015"},{tile:"S35W059"}],zoom,{includePolar:true})),has=coverageLookup(levels);
  assert.equal(has(wmtsAddress(15.5,82.5,8)),true);assert.equal(has(wmtsAddress(-58.5,-34.5,9)),true);assert.equal(has(wmtsAddress(100,0,8)),false);
});

test("cap and regular pieces do not turn the empty space between them into visible coverage",()=>{
  const normal=[0,0,1],quad=(x: number)=>[[x,-10,0],[x+10,-10,0],[x+10,10,0],[x,10,0]];
  const leaves=[{key:"left",corners:quad(-1000),normal,width:256,height:256,children:[]},{key:"right",corners:quad(1000),normal,width:256,height:256,children:[]}];
  const root={key:"two-faces",level:10,corners:[[-1000,-10,0],[1010,-10,0],[1010,10,0],[-1000,10,0]],normal,pages:leaves.map(p=>p.key),children:[],maximumCssSpan:384};
  const selected=selectCityPages(pagePlanFixture({topology:"wmts-quadtree@1",roots:[root],poolSize:8,maximumDecodedBytes:8*256*256*4}),pageNodesFixture([root,...leaves]),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],1,{width:800,height:600});
  assert.deepEqual(selected.keys,[]);assert.deepEqual(selected.directories,[]);
});

test("loaded metadata that proves an empty view remains resident until its stub leaves the view",()=>{
  const normal=[0,0,1],quad=(x: number)=>[[x,-10,0],[x+10,-10,0],[x+10,10,0],[x,10,0]];
  const ref=pack.root.directory;
  const root={key:"wide-stub",level:11,corners:quad(0),coverageParts:[{normal,corners:quad(0)}],normal,
    pages:["offscreen"],children:[],maximumCssSpan:384,directory:ref};
  const image={key:"offscreen",corners:quad(1000),normal,width:256,height:256,children:[]};
  const parent={key:"parent",level:5,corners:quad(0),normal,pages:[],children:[root.key],maximumCssSpan:1};
  const nodes=pageNodesFixture([parent,root,image]),matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const localPlan=pagePlanFixture({topology:"wmts-quadtree@1",roots:[parent],poolSize:8,maximumDecodedBytes:8*256*256*4});
  const selected=selectCityPages(localPlan,nodes,matrix,1,{width:800,height:600});
  assert.deepEqual(selected.keys,[]);assert.deepEqual(selected.directories,[ref]);
  matrix[12]=2000;
  assert.deepEqual(selectCityPages(localPlan,nodes,matrix,1,{width:800,height:600}).directories,[]);
});

test("wide views reveal the base surface when complete root groups exceed either budget, then recover",()=>{
  const normal=[0,0,1],nodes=new Map<string,ReturnType<typeof pagePlanFixture>["roots"][number]>(),roots=[];
  for(const [i,x] of [-200,0,200].entries()){
    const corners=[[x,-10,0],[x+10,-10,0],[x+10,10,0],[x,10,0]];
    const pieces=["apron","strip"].map(part=>({key:`${i}-${part}`,corners,normal,width:256,height:256,children:[]}));
    const root={key:`root-${i}`,level:5,corners,normal,pages:pieces.map(p=>p.key),children:[],maximumCssSpan:384};
    roots.push(root);for(const [key,node] of pageNodesFixture([root,...pieces]))nodes.set(key,node);
  }
  const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  // First constrain slots, then independently constrain decoded bytes.
  for(const limits of [{poolSize:8,maximumDecodedBytes:16*256*256*4},{poolSize:16,maximumDecodedBytes:8*256*256*4}]){
    const localPlan=pagePlanFixture({topology:"wmts-quadtree@1",roots,...limits});
    const wide=selectCityPages(localPlan,nodes,matrix,1,{width:800,height:600});
    assert.deepEqual(wide.keys,[]);
    assert.equal(wide.baseSurfaceFallback,"retained-budget");
    const close=selectCityPages(localPlan,nodes,matrix,1,{width:400,height:600});
    assert.deepEqual(new Set(close.keys),new Set(["0-apron","0-strip","1-apron","1-strip"]));
    assert.equal(close.baseSurfaceFallback,undefined);
  }
});
