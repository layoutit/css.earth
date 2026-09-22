import {required} from "../../../../tools/contract/test-values.mts";
import {pagePlanFixture,pageNodesFixture} from "./page-plan-fixture.mts";
import {parseCityFixtureBounds} from "./city-fixture-schema.mts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PREPARED_EARTH_SCENE } from "./prepared-fixture.mts";
import { pageBounds, childAddresses, prepareCityPageGeometry, createCityGeographicSampler,
  createCityCoverageSampler, cityPageRasterDensity, cityGeographicFrame } from "../../../../tools/objects/geographic-pages/page-geometry.mts";
import { resamplePageRgba, resampleMappedPageRgba } from "../../../../tools/objects/geographic-pages/operations/resample-page.mts";
import { projectCityPage, selectCityPages, createCityIndex } from "../../../../src/renderers/css/dist/testing.js";
import { isPreparedCityAssetUrl, normalizeCityAssetOrigin,
  preparedCityAssetUrl } from "../../../../src/renderers/css/dist/testing.js";
import { readCityFixture } from "./city-fixture.mts";
import { assembleParentCore, copyCoreIntoGutter, prepareCityParentPages, writeCityCore } from "../../../../tools/objects/geographic-pages/operations/prepare-parent-pages.mts";
import type { PageGeometry } from "../../../../tools/objects/geographic-pages/contracts.mts";

const fixture = await readCityFixture();
const plan = fixture.plan;

test("geographic city longitudes use Blue Marble's antimeridian atlas origin", () => {
  // Independent landmarks, not an assertion against generated city metadata.
  for (const [x,y,expectedLeaf] of [[345,345,26],[857,157,10],[70,427,18]]) {
    const page = prepareCityPageGeometry({level:5,x,y},PREPARED_EARTH_SCENE);
    const leaf = required(PREPARED_EARTH_SCENE.body.bands.find(b=>b.latitudeIndex===Math.floor(y/32))).leaves[expectedLeaf];
    const matrix = cityGeographicFrame(leaf).split(",").map(Number);
    assert.deepEqual(page.normal,matrix.slice(8,11));
    const midpoint = page.corners[0].map((_,axis)=>page.corners.reduce((sum,p)=>sum+p[axis],0)/4);
    // The prepared CSS basis maps mesh longitude to [sin(lon), cos(lon)].
    const meshLongitude = (Math.atan2(midpoint[0],midpoint[1])*180/Math.PI+360)%360;
    const expectedLongitude = ((x+.5)*11.25/32+180)%360;
    // The accepted planar face mapping is not a continuous spherical projection.
    assert.ok(Math.abs(meshLongitude-expectedLongitude)<.25);
  }
});

test("city page geometry is prepared against the accepted face mapping", () => {
  for (const page of fixture.pages) {
    const prepared = prepareCityPageGeometry(page, PREPARED_EARTH_SCENE);
    for (const field of ["frameMatrix", "textureMatrix", "corners", "bounds", "outer"] as const) {
      assert.deepEqual(page[field], prepared[field], `${page.key}: ${field}`);
    }
    const frame = page.frameMatrix.split(",").map(Number);
    const texture = page.textureMatrix.split(",").map(Number);
    const side = 32 * plan.rasterScale;
    [[0, 0], [side, 0], [side, side], [0, side]].forEach(([x, y], i) => {
      const w = texture[3] * x + texture[7] * y + texture[15];
      assert.ok(w > 0);
      const position = [0, 1, 2].map(row => frame[row] * x / w +
        frame[row + 4] * y / w + frame[row + 12]);
      position.forEach((v, j) => assert.ok(Math.abs(v - page.corners[i][j]) < 1e-8));
    });
  }
});

test("adjacent accepted faces agree on geographic edges after prepared reprojection", () => {
  let worst=0;
  const point=(page: PageGeometry,lon: number,lat: number)=>{
    const m=required(page.geographicMatrix),a=m[0]-lon*m[6],b=m[1]-lon*m[7],c=lon*m[8]-m[2];
    const d=m[3]-lat*m[6],e=m[4]-lat*m[7],f=lat*m[8]-m[5],det=a*e-b*d;
    const x=1024*(c*e-b*f)/det,y=1024*(a*f-c*d)/det;
    const F=page.frameMatrix.split(',').map(Number),T=page.textureMatrix.split(',').map(Number),w=T[3]*x+T[7]*y+T[15];
    return [0,1,2].map(i=>F[i]*x/w+F[i+4]*y/w+F[i+12]);
  };
  for(let band=1;band<=14;band++)for(let x=0;x<32;x++)for(const fraction of [.1,.5,.9]) {
    const page=prepareCityPageGeometry({level:0,x,y:band},PREPARED_EARTH_SCENE);
    const next=prepareCityPageGeometry({level:0,x:(x+1)%32,y:band},PREPARED_EARTH_SCENE);
    const lat=(band+fraction)*11.25-90,p=point(page,(x+1)*11.25,lat),q=point(next,(x+1)%32*11.25,lat);
    worst=Math.max(worst,Math.hypot(...p.map((v,i)=>v-q[i])));
    if(band<14) {
      const north=prepareCityPageGeometry({level:0,x,y:band+1},PREPARED_EARTH_SCENE),lon=(x+fraction)*11.25;
      const p=point(page,lon,(band+1)*11.25-90),q=point(north,lon,(band+1)*11.25-90);
      worst=Math.max(worst,Math.hypot(...p.map((v,i)=>v-q[i])));
    }
    if(band===1||band===14) {
      const cap=required(PREPARED_EARTH_SCENE.body.bands.find(b=>b.latitudeIndex===(band===1?0:15))).leaves[0];
      const capMatrix=required(cap.style.match(/matrix3d\(([^)]+)\)/))[1].split(',').map(Number);
      const edge=point(page,(x+fraction)*11.25,band===1?-78.75:78.75);
      assert.ok(Math.abs(edge[2]-capMatrix[14])<.001,
        'The geographic transition must lie on the accepted polar cap plane');
    }
  }
  // The rounded southern transition matrices contribute up to 0.0011 scene
  // units before the depth bias (under one metre on Earth). Keep the bound
  // below 0.002 units, rather than silently changing the accepted base mesh.
  assert.ok(worst<.002,`Accepted-matrix rounding plus 0.001 normal bias: ${worst} scene units`);
});

test("page hierarchy covers its parent and addresses wrap without overlap", () => {
  const pages = fixture.nodes;
  for (const page of fixture.pages.filter(p => p.children.length)) {
    if (page.childrenCoverImage) {
      const coverageCorners=required(page.coverageCorners);assert.ok(coverageCorners.length === 8);
      for(const key of page.children) {
        const child=pages.get(key);
        assert.ok(child);
        for(const point of child.coverageCorners??child.corners)point.forEach((value: number,axis: number)=>{
          assert.ok(value>=Math.min(...coverageCorners.map(p=>p[axis]))-1e-9);
          assert.ok(value<=Math.max(...coverageCorners.map(p=>p[axis]))+1e-9);
        });
      }
      continue;
    }
    const children = childAddresses(page).map(pageBounds);
    if (page.bounds.projection === 'polar') {
      assert.equal(Math.min(...children.map(p=>{assert.ok("u0" in p);return p.u0;})),page.bounds.u0);
      assert.equal(Math.max(...children.map(p=>{assert.ok("u1" in p);return p.u1;})),page.bounds.u1);
      assert.equal(Math.min(...children.map(p=>{assert.ok("v0" in p);return p.v0;})),page.bounds.v0);
      assert.equal(Math.max(...children.map(p=>{assert.ok("v1" in p);return p.v1;})),page.bounds.v1);
      for(const key of page.children)assert.ok(pages.has(key));
      continue;
    }
    assert.equal(Math.min(...children.map(p => {assert.ok("west" in p);return p.west;})), page.bounds.west);
    assert.equal(Math.max(...children.map(p => {assert.ok("east" in p);return p.east;})), page.bounds.east);
    assert.equal(Math.min(...children.map(p => {assert.ok("south" in p);return p.south;})), page.bounds.south);
    assert.equal(Math.max(...children.map(p => {assert.ok("north" in p);return p.north;})), page.bounds.north);
    for (const key of page.children) assert.ok(pages.has(key));
  }
  const east=pageBounds({level:7,x:4095,y:1024});assert.ok("east" in east);assert.equal(east.east,360);
  const west=pageBounds({level:7,x:0,y:1024});assert.ok("west" in west);assert.equal(west.west,0);
  assert.throws(() => pageBounds({ level: 7, x: 4096, y: 1024 }));
});

test("polar pages retain the cap plane and meet all 32 accepted band edges", () => {
  for (const north of [false, true]) {
    const cap = prepareCityPageGeometry({level:0,x:0,y:north?15:0},PREPARED_EARTH_SCENE);
    const sampler = createCityGeographicSampler(cap);
    const projection = required(cap.geographicProjection), m = projection.matrix;
    const det = m[0]*m[5]-m[4]*m[1];
    const uv = ([wx,wy]:readonly number[]) => {
      const x=((wx-m[12])*m[5]-m[4]*(wy-m[13]))/det;
      const y=(m[0]*(wy-m[13])-m[1]*(wx-m[12]))/det;
      return [(x-projection.x0)/(projection.x1-projection.x0),
        (y-projection.y0)/(projection.y1-projection.y0)] as const;
    };
    assert.ok(cap.corners.every(p=>Math.abs(p[2]-m[14]-(north?.001:-.001))<1e-9));
    for(let x=0;x<32;x++)for(const fraction of [.01,.1,.5,.9,.99]) {
      const page=prepareCityPageGeometry({level:0,x,y:north?14:1},PREPARED_EARTH_SCENE);
      const lon=(x+fraction)*11.25,lat=north?78.75:-78.75;
      const g=required(page.geographicMatrix),a=g[0]-lon*g[6],b=g[1]-lon*g[7],c=lon*g[8]-g[2];
      const d=g[3]-lat*g[6],e=g[4]-lat*g[7],f=lat*g[8]-g[5],D=a*e-b*d;
      const px=1024*(c*e-b*f)/D,py=1024*(a*f-c*d)/D;
      const F=page.frameMatrix.split(',').map(Number),T=page.textureMatrix.split(',').map(Number);
      const w=T[3]*px+T[7]*py+T[15];
      const world=[0,1,2].map(i=>F[i]*px/w+F[i+4]*py/w+F[i+12]-.001*page.normal[i]);
      const [actualLon,actualLat]=sampler(...uv(world));
      const lonError=Math.abs((actualLon-lon+540)%360-180);
      assert.ok(lonError<.000001,`Polar longitude ${x}: ${lonError}`);
      assert.ok(Math.abs(actualLat-lat)<.000001,`Polar latitude ${x}: ${actualLat-lat}`);
    }
    const covered=createCityCoverageSampler(cap);
    assert.equal(covered(.5,.5),true);
    assert.equal(covered(0,0),false);
    assert.throws(()=>pageBounds({level:0,x:1,y:north?15:0}));
    const children=childAddresses(cap).map(pageBounds);
    assert.equal(Math.min(...children.map(p=>{assert.ok("u0" in p);return p.u0;})),0);
    assert.equal(Math.max(...children.map(p=>{assert.ok("u1" in p);return p.u1;})),1);
    assert.equal(Math.min(...children.map(p=>{assert.ok("v0" in p);return p.v0;})),0);
    assert.equal(Math.max(...children.map(p=>{assert.ok("v1" in p);return p.v1;})),1);
  }
});

test("polar source bounds include sector crossings, wrapping longitudes and the pole", () => {
  for(const north of [false,true])for(const level of [0,3]) {
    const factor=2**level;
    for(let x=0;x<factor;x++)for(let y=0;y<factor;y++) {
      const page=prepareCityPageGeometry({level,x,y:y+(north?15*factor:0)},PREPARED_EARTH_SCENE);
      const sample=createCityGeographicSampler(page),b=page.sourceBounds;
      for(let u=0;u<=16;u++)for(let v=0;v<=16;v++) {
        const [lon,lat]=sample(u/16,v/16);
        assert.ok(lon>=b.west-1e-8&&lon<=b.east+1e-8&&lat>=b.south-1e-8&&lat<=b.north+1e-8,
          `${page.key}: ${[lon,lat]} outside ${JSON.stringify(b)}`);
      }
    }
  }
});

test("parent pixels preserve geographic quadrants, alpha and neighbor gutters", () => {
  const solid=(color: number[])=>Buffer.from(Array.from({length:16},()=>color).flat());
  const red=solid([200,40,20,255]),green=solid([20,180,40,128]);
  const parent=assembleParentCore([{x:0,y:0,pixels:red},{x:1,y:1,pixels:green}],4);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)assert.deepEqual([...parent.subarray((y*4+x)*4,(y*4+x+1)*4)],
    y>=2&&x<2?[200,40,20,255]:y<2&&x>=2?[20,180,40,128]:[0,0,0,0]);
  const output=Buffer.alloc(6*6*4);
  copyCoreIntoGutter(output,red,0,0,4,1);
  copyCoreIntoGutter(output,green,0,1,4,1);
  assert.deepEqual([...output.subarray(4,8)],[20,180,40,128],"north neighbor supplies the top gutter");
  assert.deepEqual([...output.subarray(28,32)],[200,40,20,255],"the interior remains unchanged");
  assert.deepEqual([...output.subarray(0,4)],[0,0,0,0],"unsourced corners remain transparent");
});

test("mixed source levels share same-face gutters and reject ancestor overlap", async () => {
  const directory=await mkdtemp(resolve(tmpdir(),'earth-city-parent-test-'));
  try {
    const seeds=[];
    for(const [address,color] of [[{level:2,x:0,y:8},[200,40,20,255]],
      [{level:1,x:1,y:4},[20,180,40,255]]] as const) {
      const page=prepareCityPageGeometry(address,PREPARED_EARTH_SCENE);
      const pixels=Buffer.alloc(page.width*page.height*4);
      for(let offset=0;offset<pixels.length;offset+=4)pixels.set(color,offset);
      const corePath=resolve(directory,`${page.key}.png`);
      await writeCityCore(corePath,pixels,page);
      seeds.push({...page,corePath});
    }
    const published:string[]=[];
    await prepareCityParentPages(seeds,directory,PREPARED_EARTH_SCENE,async(page,pixels)=>{
      published.push(page.key);
      if(page.key==='1-0-4')assert.deepEqual([...pixels.subarray((512*1040+1032)*4,(512*1040+1033)*4)],
        [20,180,40,255],'A same-level source seed must supply its generated neighbor gutter');
    });
    assert.deepEqual(published,['1-0-4','0-0-2']);
    await assert.rejects(prepareCityParentPages([seeds[0],
      {...prepareCityPageGeometry({level:1,x:0,y:4},PREPARED_EARTH_SCENE),corePath:seeds[1].corePath}],
      directory,PREPARED_EARTH_SCENE,async()=>{}),/must not overlap/);
  } finally { await rm(directory,{recursive:true}); }
});

test("adjacent fractional source crops preserve identical gutter pixels and nodata", () => {
  const pixels = Buffer.alloc(32 * 8 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i / 4 * 17) % 256;
    pixels[i + 1] = (i / 4 * 31) % 256;
    pixels[i + 2] = 200;
    pixels[i + 3] = i % 12 ? 255 : 0;
  }
  const left = resamplePageRgba(pixels, 32, 8, { x0: .25, x1: 12.75, y0: .25, y1: 7.75 }, 10, 6);
  const right = resamplePageRgba(pixels, 32, 8, { x0: 10.25, x1: 22.75, y0: .25, y1: 7.75 }, 10, 6);
  for (let y = 0; y < 6; y++) assert.deepEqual(
    left.subarray((y * 10 + 8) * 4, (y * 10 + 10) * 4),
    right.subarray(y * 10 * 4, (y * 10 + 2) * 4));
  const missing = resamplePageRgba(Buffer.alloc(16), 2, 2,
    { x0: 0, y0: 0, x1: 2, y1: 2 }, 1, 1);
  assert.deepEqual([...missing], [0, 0, 0, 0]);
  const mapped=resampleMappedPageRgba(pixels,32,8,(u,v)=>[.25+12.5*u,.25+7.5*v],10,6);
  const explicitlyCovered=resampleMappedPageRgba(pixels,32,8,
    (u,v)=>[.25+12.5*u,.25+7.5*v],10,6,()=>true);
  assert.deepEqual(mapped,explicitlyCovered,'Regular-face coverage fast path is texel-identical');
  // Different normalization order can round an exact half-value either way.
  assert.ok(mapped.every((value,i)=>Math.abs(value-left[i])<=1),
    'Mapped rectangular integration agrees within one 8-bit rounding unit');
  const coverage=resampleMappedPageRgba(Buffer.from([80,120,200,255]),1,1,(u,v)=>[u,v],1,1,
    (u,v)=>u<.5&&v<.5);
  assert.deepEqual([...coverage],[80,120,200,64],'Prepared polar coverage uses four alpha samples');
});

test("view selection rejects off-screen and back-facing pages and respects capacity", () => {
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const page = { key: "test", url: "/test.webp", width:130,height:130,normal: [0,0,1], corners: [[-100,-100,0],[100,-100,0],[100,100,0],[-100,100,0]], children: [] };
  assert.equal(projectCityPage(parseCityFixtureBounds(page), identity, 1, {width: 500, height: 500}).visible, true);
  assert.equal(projectCityPage(parseCityFixtureBounds({...page,normal:[0,0,-1]}), identity, 1, {width:500,height:500}).visible, false);
  const translated = [...identity]; translated[12] = 2000;
  assert.equal(projectCityPage(parseCityFixtureBounds(page), translated, 1, {width:500,height:500}).visible, false);
  const leftEdge=[...identity];leftEdge[12]=-400;
  assert.equal(projectCityPage(parseCityFixtureBounds(page),leftEdge,1,{width:500,height:500}).visible,false);
  assert.equal(projectCityPage(parseCityFixtureBounds(page),leftEdge,1,{width:500,height:500,originX:425,originY:250}).visible,true,
    'A shell-shifted scene must retain pages visible at the real viewport edge');
  const pages = pageNodesFixture(Array.from({length:40}, (_,i)=>({...page,key:String(i)})));
  const { keys } = selectCityPages({...plan,roots:[...pages.values()]},pages,identity,1,{width:500,height:500});
  assert.equal(keys.length, Math.min(40,plan.poolSize / 2));
  assert.equal(new Set(keys).size, keys.length);
});

test("the complete accepted globe's coarse frontier fits without discarding visible roots",()=>{
  const pages:ReturnType<typeof pageNodesFixture>=new Map();
  for(let y=0;y<16;y++)for(let x=0;x<(y===0||y===15?1:32);x++) {
    const geometry=prepareCityPageGeometry({level:0,x,y},PREPARED_EARTH_SCENE),density=cityPageRasterDensity(0);
    pages.set(geometry.key,required(pagePlanFixture({roots:[{...geometry,width:geometry.width*density,height:geometry.height*density,
      url:`/unit-only/${geometry.key}`,children:[]}]}).roots[0]));
  }
  const viewport={width:30000,height:30000};
  for(let pitch=0;pitch<360;pitch+=30)for(let yaw=0;yaw<360;yaw+=30) {
    const p=pitch*Math.PI/180,y=yaw*Math.PI/180,cp=Math.cos(p),sp=Math.sin(p),cy=Math.cos(y),sy=Math.sin(y);
    const matrix=[cy,sp*sy,-cp*sy,0, 0,cp,sp,0, sy,-sp*cy,cp*cy,0, 0,0,0,1];
    const expected=[...pages.values()].filter(page=>{const q=projectCityPage(parseCityFixtureBounds(page),matrix,1,viewport);return q.visible&&q.span>=96;}).map(p=>p.key).sort();
    const selected=selectCityPages({...plan,roots:[...pages.values()]},pages,matrix,1,viewport).keys;
    assert.deepEqual([...selected].sort(),expected,'A root must not disappear merely because the frontier is larger than the regional proof');
    assert.ok(selected.reduce((sum,key)=>sum+required(pages.get(key)).width*required(pages.get(key)).height*4,0)<=plan.maximumDecodedBytes/2);
  }
});

test("the decoded-pixel budget preserves an ancestor when fine children cannot all fit",()=>{
  const corners=[[-400,-400,0],[400,-400,0],[400,400,0],[-400,400,0]],normal=[0,0,1];
  const root={key:'root',url:'/unit-root',width:130,height:130,maximumCssSpan:64,corners,normal,children:['a','b','c','d']};
  const children=root.children.map(key=>({key,url:`/unit-${key}`,width:1040,height:1040,corners,normal,children:[]}));
  const pages=pageNodesFixture([root,...children]);
  const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],viewport={width:1000,height:1000};
  assert.deepEqual(selectCityPages({...plan,roots:[required(pages.get('root'))],maximumDecodedBytes:3*1040*1040*4*2},pages,matrix,1,viewport).keys,['root']);
  assert.deepEqual(selectCityPages({...plan,roots:[required(pages.get('root'))],maximumDecodedBytes:4*1040*1040*4*2},pages,matrix,1,viewport).keys,['a','b','c','d']);
});

test("a constrained frontier preserves every visible child under a selected ancestor", () => {
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const pages:ReturnType<typeof pageNodesFixture>=new Map();
  function add(key: string, left: number, top: number, side: number, level: number) {
    const children = level < 3 ? [0,1,2,3].map(i => `${key}.${i}`) : [];
    pages.set(key, required(pagePlanFixture({roots:[{ key, url: `/${key}.webp`, normal:[0,0,1], children,
      corners:[[left,top,0],[left+side,top,0],[left+side,top+side,0],[left,top+side,0]] }]}).roots[0]));
    children.forEach((child,i)=>add(child,left+(i%2)*side/2,top+Math.floor(i/2)*side/2,side/2,level+1));
  }
  add("root",-400,-400,800,0);
  for (const poolSize of [2,8,14,24]) {
    const selected = selectCityPages({...plan,roots:[required(pages.get("root"))],poolSize,targetCssPixels:64},pages,
      identity,1,{width:1000,height:1000}).keys;
    assert.ok(selected.length <= poolSize / 2);
    for (const node of pages.values()) if (!node.children.length) {
      assert.equal(selected.filter(key=>node.key===key||node.key.startsWith(`${key}.`)).length,1,
        `${node.key} must have exactly one selected ancestor at capacity ${poolSize / 2}`);
    }
  }
});

test("prepared metadata is bounded, hashed and complete without an inline global page list", () => {
  assert.equal(Reflect.get(plan,"pages"), undefined);
  assert.ok(plan.roots.length <= 32 * 16);
  assert.ok(JSON.stringify(plan).length < 5000 + plan.roots.length * 2000);
  for (const head of plan.roots) {
    assert.equal(head.level, 0);
    assert.equal(head.stub, true);
    assert.equal(Reflect.get(head,"url"), undefined);
    assert.equal(Reflect.get(head,"frameMatrix"), undefined);
  }
  for (const {ref,bytes,data} of fixture.directories.values()) {
    assert.equal(bytes.length,ref.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),ref.sha256);
    assert.ok(bytes.length<=plan.index.maximumDirectoryBytes);
    assert.ok(data.nodes.length<=21);
    assert.ok(data.external.length<=64);
    for(const node of data.nodes)for(const child of node.children)assert.ok(fixture.nodes.has(child));
  }
});

test("metadata residency releases, cancels and rejects corrupt directories", async () => {
  const plan = fixture.plan;
  const ref = plan.roots[0].directory;
  const bytes = required(fixture.directories.get(ref.url)).bytes;
  const index = createCityIndex(pagePlanFixture(plan),()=>{},async()=>new Response(Uint8Array.from(bytes)));
  const wait = async (index:ReturnType<typeof createCityIndex>) => { for(let i=0;i<100&&index.stats().activeLoads;i++)await new Promise(r=>setTimeout(r,2));assert.equal(index.stats().activeLoads,0); };
  index.update([ref]);
  await wait(index);
  assert.ok(required(index.nodes().get(plan.roots[0].key)).children.length);
  assert.deepEqual(index.stats().errors,[]);
  assert.equal(index.stats().reservedEncodedBytes,ref.bytes);
  index.update([]);
  assert.equal(index.stats().residentDirectories,0);
  assert.equal(index.nodes().size,plan.roots.length);
  index.destroy();
  const corrupt = createCityIndex(pagePlanFixture(plan),()=>{},async()=>new Response(Buffer.alloc(bytes.length)));
  corrupt.update([ref]);await wait(corrupt);
  assert.match(corrupt.stats().errors[0],/hash mismatch/);
  corrupt.update([ref]);assert.equal(corrupt.stats().requests,1);
  corrupt.destroy();
  const cancelled = createCityIndex(pagePlanFixture(plan),()=>{},(_url,options)=>new Promise((_resolve,reject)=>
    required(options?.signal).addEventListener("abort",()=>reject(new Error("cancelled")),{once:true})));
  cancelled.update([ref]);cancelled.update([]);await wait(cancelled);
  assert.equal(cancelled.stats().aborts,1);
  assert.deepEqual(cancelled.stats().errors,[]);
  assert.equal(cancelled.stats().residentDirectories,0);
  cancelled.destroy();
});

test("canonical page bytes and dimensions match their pinned content addresses", async () => {
  assert.equal(Reflect.get(plan,"canonicalDprIndependent"), true);
  assert.equal(plan.assetOrigin, "https://earth-assets.lowpoly.cc");
  assert.match(required(plan.qualification), /representative paging proof/i);
  for (const page of fixture.pages) {
    assert.equal(Reflect.get(page,"geographicMatrix"),undefined);
    assert.equal(Reflect.get(page,"geographicProjection"),undefined);
    const bytes = await readFile(new URL(
      `../../../../.local/earth-city-publish/${plan.dataset}${new URL(page.url).pathname}`,
      import.meta.url,
    ));
    assert.equal(bytes.length, page.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), page.sha256);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, page.width);
    assert.equal(metadata.height, page.height);
    assert.doesNotMatch(page.url, /@1x|@2x|one|two/);
    assert.equal(new URL(page.url).origin, plan.assetOrigin);
  }
});

test("city delivery URLs stay on the pinned R2 custom domain", () => {
  const hash = "0123456789abcdef".repeat(4);
  const filename = `city-${plan.dataset}-7-1-2-${hash.slice(0, 16)}.webp`;
  const url = preparedCityAssetUrl(plan.assetOrigin, "scenes/earth", filename);
  assert.equal(url, `${plan.assetOrigin}/scenes/earth/${filename}`);
  assert.equal(isPreparedCityAssetUrl(plan, url, "page", hash), true);
  assert.equal(isPreparedCityAssetUrl(plan, url.replace("earth-assets.lowpoly.cc", "css.earth"),
    "page", hash), false);
  assert.equal(isPreparedCityAssetUrl(plan, `${url}?cache=1`, "page", hash), false);
  assert.throws(() => normalizeCityAssetOrigin("http://earth-assets.lowpoly.cc"));
  assert.throws(() => preparedCityAssetUrl(plan.assetOrigin, "../earth", filename));
});
