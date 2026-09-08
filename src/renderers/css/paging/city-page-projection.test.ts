import assert from 'node:assert/strict';
import { test } from 'vitest';
import { projectCityPage, selectCityPages } from './city-page-selection.js';
import { selectPageFallbacks, selectPagePublication } from './page-publication.js';
import type { PreparedBounds, PreparedPage, PreparedPagePlan, PageViewport } from './types.js';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translate=(x:number,y:number,z:number)=>[...identity.slice(0,12),x,y,z,1];
const square:PreparedBounds={corners:[[-10,-10,0],[10,-10,0],[10,10,0],[-10,10,0]],normal:[0,0,1]};

test('known WMTS children publish while a sibling directory remains unavailable',()=>{
  const image=(key:string,level:number):PreparedPage=>({...square,key,level,children:[],url:key,width:256,height:256,
    maximumCssSpan:1,sha256:'a'.repeat(64),coarseKey:'root',frameMatrix:identity.join(','),textureMatrix:identity.join(',')});
  const parentImage=image('parent-image',5),childImage=image('child-image',6);
  const parent={...parentImage,key:'parent',url:'',pages:[parentImage.key],children:['known','pending']};
  const known={...childImage,key:'known',url:'',pages:[childImage.key]};
  const directory={url:'/pending.pack',bytes:100,sha256:'b'.repeat(64)};
  const pending={...childImage,key:'pending',url:'',pages:[],stub:true,directory};
  const nodes=new Map([parentImage,childImage,parent,known,pending].map(n=>[n.key,n]));
  const plan={topology:'wmts-quadtree@1',roots:[parent],poolSize:8,maximumDecodedBytes:8*256*256*4} as PreparedPagePlan;
  const view={width:800,height:600,projection:{focalPixels:800,principalOffsetPixels:[0,0] as const}};
  const selection=selectCityPages(plan,nodes,translate(0,0,-100),1,view);
  assert.deepEqual(selection.keys,['child-image'],'An unrelated unavailable directory must not discard known detail');
  assert.ok(selection.groups!.some(g=>g.key==='pending'&&g.pending&&g.lineage.includes('parent')));
  assert.deepEqual(selection.directories,[directory]);
  const limits={pages:8,bytes:8*256*256*4};
  const fallbacks=selectPageFallbacks(selection.groups!,nodes,[],limits,()=>true);
  assert.deepEqual(fallbacks.map(g=>g.key),['parent'],'A cold partial cut still requests covering imagery');
  const slots=[{key:'parent-image',ready:true,published:true,decodedBytes:256*256*4,group:fallbacks[0]},
    {key:'child-image',ready:true,published:false,decodedBytes:256*256*4,group:selection.groups!.find(g=>g.key==='known')!}];
  const publication=selectPagePublication(selection.groups!,slots,limits,fallbacks);
  assert.ok(publication.publish.includes('child-image'));
  assert.ok(!publication.release.includes('parent-image'),'Pending coverage retains its ancestor');
});
const viewport:PageViewport={width:800,height:600,projection:{focalPixels:800,principalOffsetPixels:[-70,30]}};

test('page bounds use physical focal/depth and principal point instead of affine million-pixel perspective',()=>{
  const projected=projectCityPage(square,translate(20,-5,-100),99,viewport);
  assert.equal(projected.visible,true);assert.equal(projected.span,160);assert.deepEqual(projected.center,[90,-10]);
  assert.equal(projectCityPage(square,translate(20,-5,-200),1,viewport).span,80);
  assert.equal(projectCityPage(square,translate(20,-5,-100),1,{...viewport,projection:{...viewport.projection!,focalPixels:400}}).span,80);
  assert.equal(projectCityPage(square,identity,1,{width:800,height:600}).span,20,'legacy projection stays unchanged');
  assert.notEqual(projectCityPage(square,translate(20,-5,-100),1,{width:800,height:600}).span,160,'deleting physical data fails the focal/depth guarantee');
});

test('off-axis physical eye chooses the visible face independently of the old positive-Z normal test',()=>{
  const side:PreparedBounds={corners:[[0,-10,-10],[0,10,-10],[0,10,10],[0,-10,10]],normal:[1,0,0]};
  const physical={...viewport,projection:{focalPixels:800,principalOffsetPixels:[200,0] as const}};
  assert.equal(projectCityPage(side,translate(-40,0,-100),1,physical).visible,true);
  assert.equal(projectCityPage({...side,normal:[-1,0,0]},translate(-40,0,-100),1,physical).visible,false);
  assert.equal(projectCityPage(side,translate(-40,0,-100),1,{width:800,height:600}).visible,false);
  const behind=projectCityPage({...square,normal:[0,0,-1]},translate(0,0,100),1,viewport);
  assert.equal(behind.visible,false);assert.equal(behind.span,0);assert.ok(behind.center.every(Number.isFinite));
});

test('physical page refinement keeps complete parents until every visible prepared child is available',()=>{
  const page=(key:string,extra:Partial<PreparedPage>={}):PreparedPage=>({...square,key,children:[],url:key,width:256,height:256,level:0,
    maximumCssSpan:100,sha256:'a'.repeat(64),coarseKey:'root',frameMatrix:identity.join(','),textureMatrix:identity.join(','),...extra});
  const root=page('root',{children:['a','b','c','d']}),leaves=['a','b','c','d'].map(key=>page(key));
  const plan={roots:[root],poolSize:8,maximumDecodedBytes:8*256*256*4,decodedPageBytes:256*256*4,targetCssPixels:100} as PreparedPagePlan;
  const pages=new Map([root,...leaves].map(page=>[page.key,page]));
  const select=(z:number)=>selectCityPages(plan,pages,translate(0,0,z),1,viewport).keys;
  assert.deepEqual(select(-400),['root']);
  pages.set('d',{...leaves[3],stub:true});assert.deepEqual(select(-100),['root']);
  pages.set('d',leaves[3]);assert.deepEqual(select(-100),['a','b','c','d']);
  assert.deepEqual(selectCityPages(plan,pages,translate(0,0,-100),1,{width:800,height:600}).keys,['root']);
});

test('grazing near-surface views select the real forward patch while clipping an eye-plane crossing',()=>{
  const patch:PreparedBounds={corners:[[-.001,-.001,0],[.001,-.001,0],[.001,.001,0],[-.001,.001,0]],normal:[0,0,1]};
  const close=projectCityPage(patch,translate(.002,0,-.01),1,{...viewport,projection:{focalPixels:800,principalOffsetPixels:[-170,0]}});
  assert.equal(close.visible,true);assert.equal(close.span,160);assert.deepEqual(close.center,[-10,0]);
  const crossing:PreparedBounds={corners:[[-1,-1,-2],[1,-1,1],[1,1,1],[-1,1,-2]],normal:[0,0,1]};
  const clipped=projectCityPage(crossing,identity,1,viewport);
  assert.equal(clipped.visible,true);assert.ok(Number.isFinite(clipped.span));assert.ok(clipped.center.every(Number.isFinite));
});

test('ordinary loaded WMTS tiles retain invisible-image proof while their conservative stub remains visible',()=>{
  const directory={url:'/scenes/earth/ordinary.pack',bytes:100,sha256:'b'.repeat(64)};
  const base:PreparedPage={...square,key:'tile',level:11,children:[],pages:['image'],directory,
    url:'',width:256,height:256,maximumCssSpan:256,sha256:'a'.repeat(64),coarseKey:'root',
    frameMatrix:identity.join(','),textureMatrix:identity.join(',')};
  const image:PreparedPage={...base,key:'image',pages:undefined,directory:undefined,
    corners:square.corners.map(([x,y,z])=>[x+200,y,z] as const),url:'/scenes/earth/image.webp'};
  const root={...base,key:'root',level:10,children:['tile'],pages:[],directory:undefined,maximumCssSpan:1};
  const plan={topology:'wmts-quadtree@1',roots:[root],poolSize:8,
    maximumDecodedBytes:8*256*256*4} as PreparedPagePlan;
  const pages=new Map([root,base,image].map(page=>[page.key,page]));
  assert.equal(base.coverageParts,undefined,'Exercise ordinary tile metadata, not the old polar-only guard');
  assert.equal(projectCityPage(root,translate(0,0,-100),1,viewport).visible,true);
  assert.equal(projectCityPage(image,translate(0,0,-100),1,viewport).visible,false);
  const loaded=selectCityPages(plan,pages,translate(0,0,-100),1,viewport);
  assert.deepEqual(loaded.keys,[],'The exact prepared image is outside the viewport');
  assert.deepEqual(loaded.directories,[directory],'Keep the loaded proof instead of evicting and requesting its visible stub forever');
  assert.deepEqual(selectCityPages(plan,pages,translate(1000,0,-100),1,viewport).directories,[],
    'Release the proof once its conservative bounds also leave the viewport');
});

test('detail images and pending directories follow the view centre across tree branches',()=>{
  const page=(key:string,x:number,extra:Partial<PreparedPage>={}):PreparedPage=>({...square,key,children:[],url:key,width:256,height:256,level:9,
    corners:square.corners.map(([px,y,z])=>[px/5+x,y/5,z] as const),maximumCssSpan:1,
    sha256:'a'.repeat(64),coarseKey:'root',frameMatrix:identity.join(','),textureMatrix:identity.join(','),...extra});
  const leaves=[page('west-edge',-35),page('west-centre',-5),page('east-centre',5),page('east-edge',35)];
  const pieces=leaves.map(leaf=>({...leaf,key:leaf.key+'-image'}));
  const tiles=leaves.map((leaf,i)=>({...leaf,url:'',pages:[pieces[i].key],
    directory:{url:`/${leaf.key}.json`,bytes:100,sha256:'b'.repeat(64)}}));
  const root=(key:string,x:number,children:string[])=>page(key,x,{url:'',children,
    corners:square.corners.map(([px,y,z])=>[px*2+x,y,z] as const)});
  const roots=[root('west',-20,tiles.slice(0,2).map(p=>p.key)),root('east',20,tiles.slice(2).map(p=>p.key))];
  const plan={topology:'wmts-quadtree@1',roots,poolSize:16,maximumDecodedBytes:16*256*256*4} as PreparedPagePlan;
  const pages=new Map([...roots,...tiles,...pieces].map(p=>[p.key,p]));
  const view={width:1200,height:600,projection:{focalPixels:800,principalOffsetPixels:[0,0] as const}};
  const select=()=>selectCityPages(plan,pages,translate(0,0,-100),1,view);
  const result=select();
  assert.deepEqual(result.groups!.map(group=>group.key),['west-centre','east-centre','west-edge','east-edge']);
  assert.deepEqual(result.keys,result.groups!.flatMap(group=>group.pages));
  assert.deepEqual(result.directories,[tiles[1].directory,tiles[2].directory,tiles[0].directory,tiles[3].directory]);
  const shifted=selectCityPages(plan,pages,translate(-30,0,-100),1,view);
  assert.equal(shifted.groups![0].key,'east-edge');
  assert.deepEqual(new Set(shifted.keys),new Set(result.keys),'Priority changes preserve the visible cut');
  for(const tile of tiles)pages.set(tile.key,{...tile,pages:[],stub:true});
  assert.deepEqual(select().directories,result.directories,'Undiscovered detail has the same centre priority');
});
