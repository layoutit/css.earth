import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAtmosphereModel, deriveAtmosphereMaterial } from '@cssearth/objects';
import { prepareGeometryScene, parseGeometryProfile } from './index.js';
import type { GeometryProfile, GeometrySceneAssets, SolarSceneSource } from './index.js';
import { prepareLeafSeamOutset, prepareSeamOutsetSteps } from './seam-outset.js';
import { parseRasterRecipe } from '../../../../preparation/raster/index.js';
import { outputName } from '../../../../preparation/raster/io.js';
import { RASTER_DENSITY } from '../../../../preparation/raster/config.js';
const fixtureRoot=process.cwd();
const readJson=async(path:string):Promise<unknown>=>JSON.parse(await readFile(join(fixtureRoot,path),'utf8')) as unknown;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function prepareAuthored(id:string,direction:[number,number,number],edit:(profile:GeometryProfile)=>GeometryProfile=profile=>profile,extra:Partial<GeometrySceneAssets>={}){
 const root=`src/objects/${id}/source`, profile=edit(parseGeometryProfile(await readJson(`${root}/preparation/geometry.json`))),raster=parseRasterRecipe(await readJson(`${root}/preparation/raster.json`));
 const assets:GeometrySceneAssets={...extra};
 if(raster.lighting)assets.lighting={frameCount:raster.lighting.frameCount,defaultFrame:raster.lighting.defaultFrame};
 if(raster.interior){
  const source=await readJson(`${root}/${raster.interior.source}`) as {metallicCoreRadiusFraction:number;presentation:{cutaway:{centerLongitudeDegrees:number;widthDegrees:number}}};
  const url=(template:string)=>raster.publicBase+outputName(template,RASTER_DENSITY);
  assets.interior={cutaway:source.presentation.cutaway,metallicCoreRadiusFraction:source.metallicCoreRadiusFraction,coreUrl:url(raster.interior.coreOutput),corePolesUrl:url(raster.interior.corePolesOutput),sectionUrl:url(raster.interior.sectionOutput),outerPolesUrl:url(raster.interior.outerPolesOutput)};
 }
 if(raster.atmosphere){const source=readAtmosphereModel(JSON.parse(await readFile(join(fixtureRoot,root,raster.atmosphere.source),'utf8')));assets.atmosphere={source,model:deriveAtmosphereMaterial(source)};}
 const outputDirectory=await mkdtemp(join(tmpdir(),'geometry-parity-'));
 try{
  const result=await prepareGeometryScene({profile,raster,assets,solarSource:await readJson(`${root}/presentation/solar-system.json`) as SolarSceneSource,starfield:{faces:[]},sun:{},outputDirectory,
   adapters:{bodyFixedSunDirection:()=>direction,sunReferenceViewDirection:()=>direction,preparePhysicalScene:async()=>({camera:null,systemTransform:null,presentationFrame:null,worldFrame:null,starfield:null})}});
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory,'scene.json'),'utf8')),JSON.parse(JSON.stringify(result)));
  return result;
 } finally {await rm(outputDirectory,{recursive:true,force:true});}
}
const fixtures:[string,[number,number,number],number,string,string?][]=[
 ['mercury',[0.9590465723427557,-0.28324830064510237,0.00026881085002734145],0.005,'1db776d01547b5bb38f448be21e69ca10c567bc0b4f5286b5317ba050574e26d','62b92897c455bc6734f2ba45f90a8abf477fd78c229447e1f63b978b7b1999b7'],
 ['venus',[0.9978458208272254,-0.04897654126493434,0.043646491993803105],0.008,'52c1a1286be1648205e12257163550b38c79c8d8cadd005d21af6b293db672d7']];
for(const [id,direction,fixedOverlap,bodyHash,interiorHash] of fixtures){
 test(`authored ${id} geometry preserves independent pre-migration leaf oracle`,async()=>{
  // The oracle predates the stepped seam outset. Restoring the fixed overlap it was taken
  // with must reproduce it exactly, so the outset changes nothing else about the leaves.
  const result=await prepareAuthored(id,direction,profile=>{const {seamOutset:_stepped,...projection}=profile.projection;return {...profile,projection:{...projection,overlap:fixedOverlap,rasterOverscan:0}};});
  // Two changes since this oracle was taken touched these leaves, each by name: d10c041091 draws every polar cap from
  // both sides, and 36198077d3 moved raster images to the canonical 2x density. Undoing exactly those two reproduces
  // the oracle, and every cap must carry the both-sided suffix. A third change was taken into the hashes rather than
  // undone: #712 grows each band leaf's texture with this fixed overlap instead of stretching the cell across it, and
  // stops rounding background sizes to the decimals Array.map handed formatCssLength as its index.
  const both=';backface-visibility:visible',isCap=(leaf:object)=>Boolean((leaf as {polar?:unknown;polarCap?:unknown}).polar||(leaf as {polarCap?:unknown}).polarCap);
  const undo=(set:readonly {style:string}[])=>JSON.parse(JSON.stringify(set.map(leaf=>isCap(leaf)?{...leaf,style:leaf.style.replace(both,'')}:leaf)).replaceAll('@2x.webp','.webp')) as unknown;
  const leaves='bodyLeaves' in result?result.bodyLeaves:result.body.leaves,caps=leaves.filter(isCap);
  assert.ok(caps.length>=2&&caps.every(leaf=>leaf.style.endsWith(both)),'every polar cap is drawn from both sides');
  assert.equal(hash(undo(leaves)),bodyHash);
  if(interiorHash){assert.ok('interior' in result&&result.interior);const interior=result.interior;
   assert.equal(hash({outerBodyLeaves:undo(interior.outerBodyLeaves),coreLeaves:undo(interior.coreLeaves),sectionLeaves:undo(interior.sectionLeaves)}),interiorHash);}
 });
 test(`authored ${id} geometry overlaps by its raster overscan and gives every surface leaf a seam outset`,async()=>{
  const result=await prepareAuthored(id,direction);
  const seamRepair='bodyLeaves' in result?result.preparedSurface.seamRepair:result.body.seamRepair;
  assert.equal(seamRepair.model,'prepared-matched-raster-overscan-with-silhouette-stepped-outset');
  // Half a canonical texel: one displayed @2x texel of real neighbouring imagery past each edge.
  assert.equal(seamRepair.rasterOverscan,0.5);
  assert.ok(seamRepair.presentationOverlap>0);
  const projective=('bodyLeaves' in result?result.bodyLeaves:result.body.leaves).filter(leaf=>leaf.projectiveTextureLayer);
  // Mercury also projects its polar caps; only the 14 × 32 band leaves carry the outset.
  const polar=(leaf:typeof projective[number])=>Boolean(('polar' in leaf&&leaf.polar)||('polarCap' in leaf&&leaf.polarCap));
  assert.ok(projective.filter(polar).every(leaf=>leaf.projectiveTextureLayer?.seamOutset===undefined),`${id} polar caps carry no outset`);
  const leaves=projective.filter(leaf=>!polar(leaf));
  assert.equal(leaves.length,448,'the 14 × 32 band leaves');
  for(const leaf of leaves){
   const outset=leaf.projectiveTextureLayer?.seamOutset;
   assert.equal(outset?.property,'--surface-seam-outset');
   // A 16 × 32 cell spans 11.25° of latitude, a chord of 2R·sin(π/32): about 20.4 leaf
   // scales per body diameter. Longitude cells narrow toward the poles, never below that.
   const [a,b]=outset.scale;
   assert.ok(Math.min(a,b)>19.5&&Math.min(a,b)<21.5&&Math.max(a,b)<110,`${id} leaf scale ${a} × ${b}`);
  }
 });
 test(`authored ${id} band leaves sample exactly their own map cell`,async()=>{
  // Array.map once handed formatCssLength its index as the decimals, rounding every background width to whole pixels
  // and height to tenths: Venus' leaves sampled up to half a map unit, Triton's two and a half, away from their cells.
  const {surface,projection}=parseGeometryProfile(await readJson(`src/objects/${id}/source/preparation/geometry.json`));
  const result=await prepareAuthored(id,direction),gutter=projection.rasterGutter;
  const cellWidth=surface.surface.width/surface.longitudeSegments,cellHeight=surface.surfaceLatitudeHeight/surface.latitudeSegments;
  const packedWidth=surface.surface.width+2*gutter,packedHeight=surface.latitudeSegments*(cellHeight+2*gutter);
  const polar=(leaf:object)=>Boolean(('polar' in leaf&&leaf.polar)||('polarCap' in leaf&&leaf.polarCap));
  const bands=('bodyLeaves' in result?result.bodyLeaves:result.body.leaves).filter(leaf=>!polar(leaf));
  bands.forEach((leaf,index)=>{
   const style=new Map(leaf.style.split(';').map(entry=>[entry.slice(0,entry.indexOf(':')),entry.slice(entry.indexOf(':')+1)]));
   const position=[...style].find(([name])=>name.endsWith('-surface-position'))?.[1]??style.get('background-position')??'';
   const [x=NaN,y=NaN]=position.split(' ').map(parseFloat),[width=NaN,height=NaN]=(style.get('background-size')??'').split(' ').map(parseFloat);
   // The matched overscan is drawn around the exact cell, which starts one gutter into its packed band.
   const cellX=gutter+index%surface.longitudeSegments*cellWidth;
   const cellY=(surface.latitudeSegments-2-Math.floor(index/surface.longitudeSegments))*(cellHeight+2*gutter)+gutter;
   const sampledX=-x/width*packedWidth+projection.rasterOverscan,sampledY=-y/height*packedHeight+projection.rasterOverscan;
   assert.ok(Math.abs(sampledX-cellX)<0.01&&Math.abs(sampledY-cellY)<0.01,`${id} band leaf ${index} samples (${sampledX}, ${sampledY}), its cell starts at (${cellX}, ${cellY})`);
  });
 });
}
test('seam outset steps hold the target within their silhouette steps',()=>{
 const steps=prepareSeamOutsetSteps({targetPixels:0.5,stepRatio:Math.SQRT2,hysteresis:0.1,firstDiameter:16,lastDiameter:32768});
 assert.equal(steps.levels[0].minimumDiameter,0);
 for(let index=1;index<steps.levels.length-1;index++){
  const level=steps.levels[index],next=steps.levels[index+1],value=Number(level.value);
  assert.ok(next.minimumDiameter>level.minimumDiameter);
  const smallest=level.minimumDiameter*(1-steps.hysteresis)*value,largest=next.minimumDiameter*value;
  // Values keep six significant digits: allow that rounding around 0.5 × 0.9 / 2^¼ and 0.5 × 2^¼.
  assert.ok(smallest>=0.378&&largest<=0.595,`step ${index}: ${smallest}–${largest}`);
 }
 assert.throws(()=>prepareSeamOutsetSteps({targetPixels:0.5,stepRatio:1,hysteresis:0.1,firstDiameter:16,lastDiameter:32768}));
});
test('a leaf seam outset moves each edge by the same share of the body diameter',()=>{
 // An axis-aligned 32 × 16 box mapped onto 200 × 50 units of a body 1000 units across:
 // an outset of 0.001 scales x by 1.01 and y by 1.04, one unit on every edge.
 const matrix=[200/32,0,0,0,0,50/16,0,0,0,0,1,0,10,20,30,1].join(',');
 assert.deepEqual(prepareLeafSeamOutset(matrix,32,16,1000),{property:'--surface-seam-outset',scale:[10,40]});
});
test('a stepped seam outset requires an overlap matched to its raster overscan',async()=>{
 const profile=await readJson('src/objects/venus/source/preparation/geometry.json') as {projection:Record<string,unknown>};
 assert.doesNotThrow(()=>parseGeometryProfile(profile));
 assert.throws(()=>parseGeometryProfile({...profile,projection:{...profile.projection,overlap:0.008}}),/matched to the raster overscan/);
 assert.doesNotThrow(()=>parseGeometryProfile({...profile,projection:{...profile.projection,overlap:0,rasterOverscan:0}}));
});

test('a ring drawn as wedges is one leaf per wedge, and every wedge starts outside the body',async()=>{
 const ringWedges={'uranus-rings-wedges@2x.webp':{count:16,contentPixels:213.4}};
 const result=await prepareAuthored('uranus',[1,0,0],profile=>profile,{ringWedges});
 const planes='planes' in result?result.planes??[]:[];
 const rings=planes.find(plane=>plane.id==='rings');
 assert.ok(rings);assert.equal(rings.leaves.length,16);
 const profile=parseGeometryProfile(await readJson('src/objects/uranus/source/preparation/geometry.json'));
 const bodyRadius=profile.surface.radius*profile.projection.tileSize;
 for(const leaf of rings.leaves){
  const values=/matrix3d\(([^)]+)\)/.exec(leaf.style)?.[1]?.split(',').map(Number);
  assert.ok(values&&values.length===16);
  const height=Number(/--polycss-atlas-height:([0-9.]+)px/.exec(leaf.style)?.[1]);
  // The nearest point of a wedge is the middle of its inner edge.
  const x=values[4]*height/2+values[12],y=values[5]*height/2+values[13];
  assert.ok(Math.hypot(x,y)>bodyRadius,`a wedge starts ${Math.hypot(x,y)} from the centre, inside the body's ${bodyRadius}`);
 }
});
test('ring wedges that would reach into the body are refused',async()=>{
 await assert.rejects(prepareAuthored('uranus',[1,0,0],profile=>profile,{ringWedges:{'uranus-rings-wedges@2x.webp':{count:16,contentPixels:120}}}),/reach into the body/);
});
