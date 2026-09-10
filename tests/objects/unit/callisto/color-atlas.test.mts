import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import {missingCoverageColor} from '../../../../src/platform/prepare-missing-coverage.mts';
import {publishedObservation,canonicalPoint,assertDisplayClose} from '../observed-atlas-proof.mts';
const root=new URL('../../../../src/planets/callisto/',import.meta.url);

// A small native-window oracle for the two bilinear geographic sampling stages.
// It reads source RGB, never a public intermediate map or the renderer sampler.
async function sourceColorAtAtlasTexel(image,layout,location){
 const mx=location.longitude/360*layout.width-.5,my=(90-location.latitude)/180*layout.height-.5;
 const x0=Math.floor(mx),y0=Math.floor(my),fx=mx-x0,fy=my-y0,result=[0,0,0];
 const origin=image.getOrigin(),resolution=image.getResolution(),radius=image.getGeoKeys().GeogSemiMajorAxisGeoKey;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const weight=(dx?fx:1-fx)*(dy?fy:1-fy);if(!weight)continue;
  const p=canonicalPoint(x0+dx,y0+dy,layout.width,layout.height);
  const sx=((p.longitude-180)*Math.PI/180*radius-origin[0])/resolution[0]-.5;
  const sy=(p.latitude*Math.PI/180*radius-origin[1])/resolution[1]-.5;
  const x=Math.floor(sx),y=Math.floor(sy),u=sx-x,v=sy-y;
  const cells=await image.readRasters({window:[x,y,x+2,y+2],interleave:true});
  assert.equal(cells.length,16);assert.ok([3,7,11,15].every(i=>cells[i]===255));
  for(let c=0;c<3;c++)result[c]+=Math.round(cells[c]*(1-u)*(1-v)+cells[4+c]*u*(1-v)+cells[8+c]*(1-u)*v+cells[12+c]*u*v)*weight;
 }
 return result.map(Math.round);
}

test('the actual retained Galileo-color atlas preserves original color landmarks and partial coverage',async()=>{
 const surface=await publishedObservation('callisto','enhanced');
 const file=await fromFile(new URL('source/observations/PIA03456-registered-rgba.tif',root).pathname);
 try{
  const source=await file.getImage();
  for(const [longitude,latitude]of [[145.2,0],[154.4,-24.2],[145.7,-3.6],[137.3,-9.9],[113,-1.3],[144.1,32.6]]){
   const actual=surface.sample(longitude,latitude),expected=await sourceColorAtAtlasTexel(source,surface.record.layout,actual);
   assertDisplayClose(actual.rgb,expected,`PIA03456 native color at ${longitude}E ${latitude}N`);
  }
 }finally{await file.close();}
 assert.ok(surface.record.missingPixels>8192*4096*.77&&surface.record.missingPixels<8192*4096*.80);
 for(const [longitude,latitude]of [[300,0],[0,0],[180,85],[180,-85]]){
  const actual=surface.sample(longitude,latitude);
  const grid=missingCoverageColor(actual.longitude,actual.latitude,180/4096);
  assertDisplayClose(actual.rgb,grid,'Unobserved hemisphere/poles retain the prepared cartographic grid');
 }
 const material=JSON.parse(await readFile(new URL('prepared/material.json',root),'utf8'));
 const runtime=JSON.parse(await readFile(new URL('prepared/runtime.json',root),'utf8'));
 assert.equal(material.surfaces.find(s=>s.id==='enhanced').falseColor,true);
 const lens=runtime.controls.lenses.controls.find(l=>l.id==='enhanced');
 assert.equal(lens.label,'Galileo color');
 const lenses=JSON.parse(await readFile(new URL('prepared/lenses.json',root),'utf8'));
 assert.equal(lenses.controls.find(l=>l.id==='enhanced').falseColor,true);
 assert.equal(lens.legend.items.length,2);assert.match(lens.description,/not calibrated I\/F or albedo/);
 const variants=runtime.variants.filter(v=>v.when.lensId==='enhanced');assert.ok(variants.length>0);
 for(const variant of variants){assert.ok(variant.navigation?.camera?.zoom>=1,'The source footprint has a prepared focus');}
});
