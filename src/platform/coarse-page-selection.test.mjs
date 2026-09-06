import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectCityPages} from './prepared-map/city-page-selection.mjs';
import {selectPagePublication} from './prepared-map/page-publication.mjs';
import {createCityIndex} from './prepared-map/city-index.mjs';

const corners=[[-50,-50,0],[50,-50,0],[50,50,0],[-50,50,0]],normal=[0,0,1];
const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],viewport={width:800,height:600,zoom:16};
const backing={key:'0-0-0',level:0,corners,normal,width:260,height:260,url:'/backing.webp',children:[],maximumCssSpan:384};
const piece={key:'fine-piece',level:5,corners,normal,width:256,height:256,url:'/fine.png',children:[]};
const tile={key:'fine-tile',level:5,corners,normal,pages:[piece.key],children:[],maximumCssSpan:384};
const plan={topology:'wmts-quadtree@1',roots:[tile],minimumZoom:8,poolSize:8,maximumDecodedBytes:4*1024**2,backing:{roots:[backing],minimumZoom:4}};
const nodes=()=>new Map([backing,piece,tile].map(p=>[p.key,p]));

test('one selection reserves retained backing plus fine imagery within the original combined limits',()=>{
 const result=selectCityPages(plan,nodes(),matrix,1,viewport);
 assert.deepEqual(result.keys,[backing.key,piece.key]);assert.equal(result.backing.decodedBytes,260*260*4);
 assert.deepEqual(result.groups.map(g=>g.lineage),[[backing.key],[tile.key]]);
 const nearGlobe=selectCityPages(plan,nodes(),matrix,1,{...viewport,zoom:6});assert.deepEqual(nearGlobe.keys,[backing.key]);
 const full=selectCityPages({...plan,poolSize:2},nodes(),matrix,1,viewport);
 assert.deepEqual(full.keys,[backing.key]);assert.equal(full.baseSurfaceFallback,'retained-budget');
});

test('fine imagery publishes while an unrelated backing directory is pending',()=>{
 const stub={...backing,url:undefined,stub:true,directory:{url:'/pending.json',bytes:10,sha256:'0'.repeat(64)}};
 const pages=nodes();pages.set(stub.key,stub);
 const result=selectCityPages({...plan,backing:{...plan.backing,roots:[stub]}},pages,matrix,1,viewport);
 const old={key:backing.key,group:{key:backing.key,lineage:[backing.key]},published:true,ready:true,decodedBytes:260*260*4};
 const fresh={key:piece.key,group:result.groups.find(g=>g.key===tile.key),published:false,ready:true,decodedBytes:256*256*4};
 const publication=selectPagePublication(result.groups,[old,fresh],{pages:4,bytes:2*1024**2});
 assert.deepEqual(publication.publish,[piece.key]);assert.deepEqual(publication.release,[]);
});

test('backing children replace their own parent independently and keep fine imagery alive',()=>{
 const children=Array.from({length:4},(_,i)=>({...backing,key:`1-${i%2}-${Math.floor(i/2)}`,level:1,corners:corners.map(([x,y,z])=>[x/4,y/4,z])}));
 const parent={...backing,maximumCssSpan:1,children:children.map(c=>c.key)},pages=nodes();pages.set(parent.key,parent);for(const child of children)pages.set(child.key,child);
 const result=selectCityPages({...plan,poolSize:12,backing:{...plan.backing,roots:[parent]}},pages,matrix,1,viewport);
 const old=[{key:parent.key,group:{key:parent.key,lineage:[parent.key]},published:true,ready:true,decodedBytes:260*260*4},
 {key:piece.key,group:{key:tile.key,lineage:[tile.key]},published:true,ready:true,decodedBytes:256*256*4}];
 const pending=children.map(child=>({key:child.key,group:result.groups.find(g=>g.key===child.key),published:false,ready:child!==children[3],decodedBytes:260*260*4}));
 assert.deepEqual(selectPagePublication(result.groups,[...old,...pending],{pages:6,bytes:2*1024**2}).release,[]);
 pending[3].ready=true;
 const done=selectPagePublication(result.groups,[...old,...pending],{pages:6,bytes:2*1024**2});
 assert.deepEqual(done.release,[parent.key]);assert.ok(children.every(c=>done.publish.includes(c.key)));assert.ok(!done.release.includes(piece.key));
});

test('backing root headers consume the existing metadata allowance',()=>{
 const bytes=Buffer.from(JSON.stringify({schema:'cssearth-city-index@1',dataset:'test',nodes:[backing],external:[]})),sha256=createHash('sha256').update(bytes).digest('hex');
 const ref={url:`https://earth-assets.lowpoly.cc/scenes/earth/city-index-test-0-0-0-${sha256.slice(0,16)}.json`,bytes:bytes.length,sha256};
 const stub={...backing,url:undefined,stub:true,directory:ref};let calls=0;
 const index=createCityIndex({roots:[],backing:{roots:[stub],rootDecodedBytes:100},index:{maximumDirectories:2,maximumBytes:bytes.length+99,maximumConcurrentLoads:1,maximumDirectoryBytes:1024}},()=>{},async()=>{calls++;return new Response(bytes);});
 try{assert.equal(index.nodes().get(stub.key),stub);index.update([ref]);assert.equal(calls,0);assert.equal(index.stats().budgetBlocked,1);assert.equal(index.stats().reservedDecodedBytes,100);}finally{index.destroy();}
});

test('certified backing yields display capacity without coarsening the selected fine cut',()=>{
 const pages=nodes();pages.set(backing.key,{...backing,replacement:{branches:[[tile.key]]}});
 const result=selectCityPages({...plan,poolSize:2},pages,matrix,1,viewport);
 assert.deepEqual(result.keys,[backing.key,piece.key]);
 assert.deepEqual(result.groups.find(g=>g.key===backing.key).replacements,[tile.key]);
 assert.equal(result.backing.retiring,1);
 assert.equal(result.baseSurfaceFallback,undefined);
});
