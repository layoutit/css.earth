import { required } from '../../contract/test-values.mts';
import { fixtureSource } from '../test-source-fixture.mts';
import type { RadialMaterialSurface } from './solid-contract.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareRadialMaterials } from './radial-materials.mts';
const test = sourceTest();

// The flat source has one real science color and one explicit unknown-cell
// color on opposite sides of0E. Source-point science is intentionally absent:
// this exercises the numeric ISIS/GeoTIFF fallback used by native Phoebe.
const valid=[210,30,10],unknown=[136,142,153];
function radialFixture(){
 const faces=[1,-1].map(sign=>({vertices:[[5,0,0],[5,sign,0],[5,0,1]],normal:[1,0,0],vertexNormals:[[1,0,0],[1,0,0],[1,0,0]]}));
 const plans=faces.map((face,i)=>({face,rect:{x:i*2,y:0,width:2,height:2},geometry:{leafWidth:2,leafHeight:2},
  matrix:[(i?-1:1)*BASE_TILE/2,0,0,0,0,0,BASE_TILE/2,0,0,0,1,0,0,5*BASE_TILE,0,1]}));
 return {faces,plans,width:4,height:2};
}
test('native radial fallback preserves numeric/missing cells through actual lossless flood and shadow encoding',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-radial-grid-footprint-'));
 try{
  const rgb=Buffer.from([valid,valid,unknown,unknown,valid,valid,unknown,unknown].flat());
  await sharp(rgb,{raw:{width:4,height:2,channels:3}}).webp({lossless:true}).toFile(join(root,'source.webp'));
  const outputs: Record<'numeric'|'photographic',Buffer[]>={numeric:[],photographic:[]};
  for(const nearest of [true,false]){
   const id=nearest?'numeric':'photographic';
   const surface: RadialMaterialSurface={id,map:{url:'/scenes/fixture/source.webp'},...(nearest?{displaySampling:'nearest'}:{})};
   const config={namespace:'fixture',publicBase:'/scenes/fixture/',geometry:{radius:1,radiusKm:.001,radialTerrain:{}},raster:{width:4,scientific:[]}};
   await prepareRadialMaterials({radial:radialFixture(),surfaces:[surface],config,source:await fixtureSource(root,[{path:'source.webp',consumers:['texture']}]),publicDirectory:root,outputDirectory:root,sunDirection:[1,0,0]});
   outputs[id]=[];
   for(const asset of [surface.surface,surface.shadowSurface]){
    const path=join(root,required(required(asset).url.split('/').at(-1)));
    const decoded=await sharp(await readFile(path)).removeAlpha().raw().toBuffer();
    outputs[id].push(decoded);
    if(nearest){
     // The real transported samples have longitudes±2.86..8.53degrees.
     // Nearest cell0 is valid; wrapped cell3 is unknown, with no blend.
     for(let y=0;y<2;y++)for(let x=0;x<4;x++)
      assert.deepEqual([...decoded.subarray((y*4+x)*3,(y*4+x+1)*3)],x<2?valid:unknown,required(asset).url+' must preserve the exact selected source cell');
    }
   }
  }
  assert.deepEqual(outputs.numeric[0],outputs.numeric[1],'Full incidence retains the same exact flood/shadow colors');
  assert.notDeepEqual(outputs.photographic[0],outputs.numeric[0],'Omitted policy retains continuous photographic sampling');
  assert.ok(Array.from({length:8},(_,i)=>[...outputs.photographic[0].subarray(i*3,i*3+3)])
   .some(c=>![valid,unknown].some(p=>p.every((v,i)=>v===c[i]))),'Default photographic output still includes interpolated colors');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a smaller baked atlas preserves original face plans and normalized CSS addresses',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-radial-scaled-atlas-'));
 try{
  await sharp(Buffer.from([valid,valid,unknown,unknown,valid,valid,unknown,unknown].flat()),
    {raw:{width:4,height:2,channels:3}}).webp({lossless:true}).toFile(join(root,'source.webp'));
  const radial=radialFixture(),before=structuredClone(radial);
  const surface: RadialMaterialSurface={id:'scaled',textureScale:.5,displaySampling:'nearest',map:{url:'/scenes/fixture/source.webp'}};
  const config={namespace:'fixture',publicBase:'/scenes/fixture/',geometry:{radius:1,radiusKm:.001,radialTerrain:{}},raster:{width:4,scientific:[]}};
  await prepareRadialMaterials({radial,surfaces:[surface],config,source:await fixtureSource(root,[{path:'source.webp',consumers:['texture']}]),publicDirectory:root,outputDirectory:root,sunDirection:[1,0,0]});
  assert.deepEqual(radial,before,'Existing geometry and CSS atlas addresses must not change');
  for(const asset of [surface.surface,surface.shadowSurface]){
    assert.equal(required(asset).width,2);assert.equal(required(asset).height,1);
    const pixels=await sharp(join(root,required(required(asset).url.split('/').at(-1)))).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixels],[...valid,...unknown],'Both original face owners survive scaling');
  }
  for(const {rect} of radial.plans)assert.equal(rect.x/radial.width,(rect.x*.5)/required(surface.surface).width);
 }finally{await rm(root,{recursive:true,force:true});}
});
