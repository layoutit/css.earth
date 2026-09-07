import test from "node:test";
import assert from "node:assert/strict";
import {PREPARED_EARTH_SCENE as scene} from "./prepared-fixture.mjs";
import {prepareCityPageGeometry,createCityGeographicSampler} from "../../../../tools/objects/geographic-pages/page-geometry.mjs";
import {prepareCoarsePageGeometry,coarsePageFootprint,sampleCoarsePage,coarsePageSourceLevel,trimCoarsePageRgba} from "../../../../tools/objects/geographic-pages/operations/coarse-page.mjs";
import {resampleMappedPageRgba} from "../../../../tools/objects/geographic-pages/operations/resample-page.mjs";
import {prepareCoarseReplacements} from "../../../../tools/objects/geographic-pages/operations/coarse-replacements.mjs";
import {wmtsAddress} from "../../../../tools/objects/geographic-pages/wmts-page-geometry.mjs";

const point=(p,u,v)=>{
  const a=p.frameMatrix.split(',').map(Number),b=p.textureMatrix.split(',').map(Number),q=[u*256,v*256,0,1];
  const apply=(m,v)=>[0,1,2,3].map(row=>v.reduce((s,n,col)=>s+m[col*4+row]*n,0));
  const result=apply(a,apply(b,q));return result.slice(0,3).map(n=>n/result[3]);
};

test("coarse and fine keep the accepted face with backing strictly between their planes",()=>{
  for(const address of [{level:0,x:10,y:10},{level:3,x:2,y:122},{level:3,x:2,y:2}]){
    const base=prepareCityPageGeometry(address,scene,{normalOffset:0,rasterScale:8});
    const fine=prepareCityPageGeometry(address,scene,{rasterScale:8}),backing=prepareCoarsePageGeometry(address,scene);
    for(const uv of [[0,0],[1,0],[1,1],[0,1],[.5,.5]]){
      const a=point(base,...uv),b=point(backing,...uv),c=point(fine,...uv);
      for(let i=0;i<3;i++)assert.ok(Math.abs(b[i]-(a[i]+c[i])/2)<1e-9);
    }
    assert.deepEqual(backing.sourceBounds,fine.sourceBounds);assert.deepEqual(backing.normal,fine.normal);
  }
});

test("regular coarse sampling agrees with existing area-weighted premultiplied source sampling",()=>{
  const page={...prepareCoarsePageGeometry({level:0,x:10,y:10},scene),width:24,height:24},rgba=Buffer.alloc(256*256*4);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const at=(y*256+x)*4;rgba.set([x,y,(x+y)%256,(x+y)%3?255:80],at);
  }
  const geographic=createCityGeographicSampler(page);
  const expected=resampleMappedPageRgba(rgba,256,256,(u,v)=>{
    const [lon,lat]=geographic(u,1-v);return [(lon+180)/360*256,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*256];
  },page.width,page.height);
  assert.deepEqual(sampleCoarsePage(page,0,(x,y)=>rgba.subarray((y*256+x)*4,(y*256+x+1)*4)),expected);
});

test("dateline footprints use adjacent wrapped source columns",()=>{
  const page={...prepareCoarsePageGeometry({level:0,x:16,y:6},scene),width:32,height:32};
  let wrapped=0;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const b=coarsePageFootprint(page,0,x,y);assert.ok(b.x1-b.x0<2);
    if(b.x0<256&&b.x1>256)wrapped++;
  }
  assert.ok(wrapped>0);
  const result=sampleCoarsePage(page,0,(x,y)=>{assert.ok(x>=0&&x<256&&y>=0&&y<256);return [12,34,56,255];});
  for(let i=0;i<result.length;i+=4)assert.deepEqual([...result.subarray(i,i+4)],[12,34,56,255]);
});

test("both unserved pole centres and the exterior of the prepared cap stay transparent",()=>{
  for(const y of [0,15]){
    const page={...prepareCoarsePageGeometry({level:0,x:0,y},scene),width:32,height:32};
    assert.equal(coarsePageFootprint(page,0,16,16),null);
    assert.equal(coarsePageFootprint(page,0,0,0),null);
    const result=sampleCoarsePage(page,0,()=>[25,50,75,128]);
    assert.equal(result[(16*32+16)*4+3],0);assert.equal(result[3],0);
    assert.ok(result.some((n,i)=>i%4===3&&n>0));
    for(let i=0;i<result.length;i+=4)if(result[i+3])assert.deepEqual([...result.subarray(i,i+3)],[25,50,75]);
  }
});

test("source mip preserves the short sampling axis even when a sheared footprint has a large bounding box",()=>{
  const page={width:16,height:16,geographicMatrix:[20,19,0,20,19.2,0,0,0,1]};
  const source=coarsePageSourceLevel(page);assert.ok(source.minimumSourceSpan>=1);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.ok(coarsePageFootprint(page,source.zoom,x,y).minimumScale>=1-1e-9);
  const b=coarsePageFootprint(page,0,8,8),boxZoom=Math.ceil(Math.log2(1/Math.min(b.x1-b.x0,b.y1-b.y0)));
  assert.ok(source.zoom>boxZoom+4);
});

test('regular replacement roots enclose the whole prepared apron, including wrapped source columns',()=>{
  const roots=Array.from({length:1024},(_,i)=>({key:`wmts-tile-5-${i%32}-${Math.floor(i/32)}`}));
  for(const address of [{level:2,x:40,y:44},{level:0,x:16,y:6},{level:1,x:2,y:29}]){
    const page=prepareCityPageGeometry(address,scene),sample=createCityGeographicSampler(page);
    const replacement=prepareCoarseReplacements(address,scene,roots);
    assert.ok(replacement.branches.length>0&&replacement.branches.length<=160);
    for(let y=0;y<=16;y++)for(let x=0;x<=16;x++){
      const [longitude,latitude]=sample(x/16,y/16),tile=wmtsAddress(longitude,latitude,5);
      assert.ok(replacement.branches.some(branch=>branch[0]===`wmts-tile-5-${tile.x}-${tile.y}`));
    }
    // A single omitted source root invalidates the certificate. An intersecting
    // tile or a bounding-box match alone does not authorize retirement.
    assert.equal(prepareCoarseReplacements(address,scene,roots.filter(root=>root.key!==replacement.branches[0][0])),undefined);
  }
  for(const y of [0,15])assert.equal(prepareCoarseReplacements({level:0,x:0,y},scene,roots),undefined);
});

test('transparent storage is trimmed without moving or changing visible texels',()=>{
  const width=260,height=260,rgba=new Uint8Array(width*height*4);
  for(let y=40;y<88;y++)for(let x=50;x<103;x++)rgba.set([x,y,91,(x+y)%2?255:43],(y*width+x)*4);
  const result=trimCoarsePageRgba(rgba,width,height),{left,top}=result.crop;
  assert.ok(result.width*result.height<width*height/3);
  assert.equal(left,0);assert.equal(top,0);
  const size=result.textureBackgroundSize.split(' ').map(parseFloat),position=result.textureBackgroundPosition.split(' ').map(parseFloat);
  assert.ok([...size,...position].every(Number.isInteger));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const localX=x-left,localY=y-top;
    const actual=localX>=0&&localX<result.width&&localY>=0&&localY<result.height?result.rgba.subarray((localY*result.width+localX)*4,(localY*result.width+localX+1)*4):new Uint8Array(4);
    assert.deepEqual(actual,rgba.subarray((y*width+x)*4,(y*width+x+1)*4));
    if(actual[3]){
      assert.ok(Math.abs(position[0]+(localX+.5)*size[0]/result.width-(x+.5)*256/width)<1e-10);
      assert.ok(Math.abs(position[1]+(localY+.5)*size[1]/result.height-(y+.5)*256/height)<1e-10);
    }
  }
});

test('an empty polar page can be omitted without asserting fine coverage over the cap',()=>{
  const image={rgba:new Uint8Array(260*260*4),width:260,height:260};
  assert.equal(trimCoarsePageRgba(image.rgba,260,260).rgba.length,4);
  for(const y of [0,15]){
    assert.deepEqual(prepareCoarseReplacements({level:0,x:0,y},scene,[],image),{empty:true,branches:[]});
    image.rgba[3]=1;
    assert.equal(prepareCoarseReplacements({level:0,x:0,y},scene,[],image),undefined);
    image.rgba[3]=0;
  }
});
