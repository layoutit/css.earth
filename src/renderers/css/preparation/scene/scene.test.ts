import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAtmosphereSource, deriveAtmosphereMaterial } from '@cssearth/objects';
import { prepareGeometryScene, parseGeometryProfile } from './index.js';
import type { GeometrySceneAssets, SolarSceneSource } from './index.js';
import { parseRasterRecipe } from '../../../../preparation/raster/index.js';
import { outputName } from '../../../../preparation/raster/io.js';
const fixtureRoot=process.cwd();
const readJson=async(path:string):Promise<unknown>=>JSON.parse(await readFile(join(fixtureRoot,path),'utf8')) as unknown;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtures:[string,[number,number,number],string,string?][]=[
 ['mercury',[0.9590465723427557,-0.28324830064510237,0.00026881085002734145],'369dc1263bd3587a15aa80f32581dcbfa4906aa622d83e4482907f7c1f74da15','8457ddb0c43ba5f4263267a25cb9bdb4178bbe0605fc16301c8bf2fa00595688'],
 ['venus',[0.9978458208272254,-0.04897654126493434,0.043646491993803105],'c868963aa383bfcd2b5947e0835743a27fa6a7b63d70d62697114e32c131a2d7']];
for(const [id,direction,bodyHash,interiorHash] of fixtures)test(`authored ${id} geometry preserves independent pre-migration leaf oracle`,async()=>{
 const root=`src/planets/${id}/source`, profile=parseGeometryProfile(await readJson(`${root}/preparation/geometry.json`)),raster=parseRasterRecipe(await readJson(`${root}/preparation/raster.json`));
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
  assert.equal(hash('bodyLeaves' in result?result.bodyLeaves:result.body.leaves),bodyHash);
  if(interiorHash){assert.ok('interior' in result&&result.interior);const interior=result.interior;assert.equal(hash({outerBodyLeaves:interior.outerBodyLeaves,coreLeaves:interior.coreLeaves,sectionLeaves:interior.sectionLeaves}),interiorHash);}
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory,'scene.json'),'utf8')),JSON.parse(JSON.stringify(result)));
 } finally {await rm(outputDirectory,{recursive:true,force:true});}
});
