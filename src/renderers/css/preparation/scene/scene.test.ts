import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAtmosphereSource, deriveAtmosphereMaterial } from '@cssearth/objects';
import { prepareGeometryScene, parseGeometryProfile } from './index.js';
import type { GeometryProfile, GeometrySceneAssets, SolarSceneSource } from './index.js';
import { prepareLeafSeamOutset, prepareSeamOutsetSteps } from './seam-outset.js';
import { parseRasterRecipe } from '../../../../preparation/raster/index.js';
import { outputName } from '../../../../preparation/raster/io.js';
const fixtureRoot=process.cwd();
const readJson=async(path:string):Promise<unknown>=>JSON.parse(await readFile(join(fixtureRoot,path),'utf8')) as unknown;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function prepareAuthored(id:string,direction:[number,number,number],edit:(profile:GeometryProfile)=>GeometryProfile=profile=>profile){
 const root=`src/objects/${id}/source`, profile=edit(parseGeometryProfile(await readJson(`${root}/preparation/geometry.json`))),raster=parseRasterRecipe(await readJson(`${root}/preparation/raster.json`));
 const assets:GeometrySceneAssets={};
 if(raster.lighting)assets.lighting={frameCount:raster.lighting.frameCount,defaultFrame:raster.lighting.defaultFrame};
 if(raster.interior){
  const source=await readJson(`${root}/${raster.interior.source}`) as {metallicCoreRadiusFraction:number;presentation:{cutaway:{centerLongitudeDegrees:number;widthDegrees:number}}};
  const url=(template:string)=>raster.publicBase+outputName(template);
  assets.interior={cutaway:source.presentation.cutaway,metallicCoreRadiusFraction:source.metallicCoreRadiusFraction,coreUrl:url(raster.interior.coreOutput),corePolesUrl:url(raster.interior.corePolesOutput),sectionUrl:url(raster.interior.sectionOutput),outerPolesUrl:url(raster.interior.outerPolesOutput)};
 }
 if(raster.atmosphere){const source=parseAtmosphereSource(await readFile(join(fixtureRoot,root,raster.atmosphere.source),'utf8'));assets.atmosphere={source,model:deriveAtmosphereMaterial(source)};}
 const outputDirectory=await mkdtemp(join(tmpdir(),'geometry-parity-'));
 try{
  const result=await prepareGeometryScene({profile,raster,assets,solarSource:await readJson(`${root}/presentation/solar-system.json`) as SolarSceneSource,starfield:{faces:[]},sun:{},outputDirectory,
   adapters:{bodyFixedSunDirection:()=>direction,sunReferenceViewDirection:()=>direction,preparePhysicalScene:async()=>({camera:null,systemTransform:null,presentationFrame:null,heliocentricView:null,worldFrame:null,starfield:null})}});
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory,'scene.json'),'utf8')),JSON.parse(JSON.stringify(result)));
  return result;
 } finally {await rm(outputDirectory,{recursive:true,force:true});}
}
const fixtures:[string,[number,number,number],number,string,string?][]=[
 ['mercury',[0.9590465723427557,-0.28324830064510237,0.00026881085002734145],0.005,'369dc1263bd3587a15aa80f32581dcbfa4906aa622d83e4482907f7c1f74da15','8457ddb0c43ba5f4263267a25cb9bdb4178bbe0605fc16301c8bf2fa00595688'],
 ['venus',[0.9978458208272254,-0.04897654126493434,0.043646491993803105],0.008,'c868963aa383bfcd2b5947e0835743a27fa6a7b63d70d62697114e32c131a2d7']];
for(const [id,direction,fixedOverlap,bodyHash,interiorHash] of fixtures){
 test(`authored ${id} geometry preserves independent pre-migration leaf oracle`,async()=>{
  // The oracle predates the stepped seam outset. Restoring the fixed overlap it was taken
  // with must reproduce it exactly, so the outset changes nothing else about the leaves.
  const result=await prepareAuthored(id,direction,profile=>{const {seamOutset:_stepped,...projection}=profile.projection;return {...profile,projection:{...projection,overlap:fixedOverlap,rasterOverscan:0}};});
  assert.equal(hash('bodyLeaves' in result?result.bodyLeaves:result.body.leaves),bodyHash);
  if(interiorHash){assert.ok('interior' in result&&result.interior);const interior=result.interior;assert.equal(hash({outerBodyLeaves:interior.outerBodyLeaves,coreLeaves:interior.coreLeaves,sectionLeaves:interior.sectionLeaves}),interiorHash);}
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
