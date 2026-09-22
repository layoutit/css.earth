import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import {readPreparedFixture} from '../../fixtures.mts';
import {initialObjectSelection,reduceObjectSelection} from '../../../../src/platform/object-runtime-contract.mts';
import {resolvePreparedPresentation} from '../../../../src/renderers/css/dist/testing.js';
import {viewSunDirectionToPreparedLightDirection} from '../../../../src/platform/directional-sun-coordinate.mts';
const [lenses,scene,definition]=await Promise.all([readPreparedFixture('saturn','material-lenses'),readPreparedFixture('saturn','scene'),readPreparedFixture('saturn','runtime')]);
const publicPath=(url: string)=>new URL('../../../../public'+url,import.meta.url);
test('ships five prepared retained-DOM Saturn lenses',async()=>{
 assert.equal(lenses.schema,'csssaturn-prepared-lenses@1');assert.equal(lenses.defaultLens,'normal');
 assert.equal(lenses.runtimeFilters,false);assert.equal(lenses.runtimeRasterization,false);
 assert.deepEqual(lenses.controls.map(lens=>lens.id),['normal','ultraviolet','methane','thermal','cross-section']);
 assert.deepEqual(lenses.controls.map(lens=>lens.materialLens),['normal','ultraviolet','methane','thermal','normal']);
 for(const lens of lenses.controls){
  const expected: [string,number,number][]=lens.view==='interior'?[[lens.thumbnailUrl,112,64]]:[
   [lens.surface2xUrl||lens.surfaceUrl,lens.surface2xUrl?4160:2080,lens.surface2xUrl?3072:1536],
   [lens.polesUrl,4096,512],[lens.ring2xUrl,4096,4096],[lens.thumbnailUrl,112,64]];
  for(const[url,width,height]of expected){const meta=await sharp(await readFile(publicPath(url))).metadata();assert.equal(meta.width,width,url);assert.equal(meta.height,height,url);}
 }
 const interior=required(lenses.controls.find(lens=>lens.view==='interior'));
 const meta=await sharp(await readFile(publicPath(required(interior.interiorMaterialUrl)))).metadata();
 assert.equal(meta.width,5188);assert.equal(meta.height,2080);
});
test('ships optional material lenses as exact single-atlas variants',async()=>{
 const runtime=scene.preparedLighting.orbitAtlas.runtimeShards;
 const expected=['normal','ultraviolet','methane','thermal'].flatMap(id=>[id,id+'-no-shadows',id+'-ringless',id+'-ringless-no-shadows']);
 assert.equal(runtime.defaultVariant,'normal');assert.deepEqual(Object.keys(runtime.variants),expected);
 for(const[id,variant]of Object.entries(runtime.variants)){
  assert.equal(variant.rows.length,16);assert.equal(variant.presentations.length,256);
  const meta=await sharp(await readFile(publicPath(variant.runtimeAtlas.assetUrl))).metadata();
  assert.equal(meta.width,5188);assert.equal(meta.height,4160);
  assert.match(variant.runtimeAtlas.assetUrl,id==='normal'?/saturn-orbit-material\.webp$/:new RegExp('saturn-orbit-material-'+id+'\\.webp$'));
 }
 for(const lens of lenses.controls.filter(lens=>lens.falseColor===true)){
  assert.equal(lens.materialVariant,lens.id);
  assert.equal(lens.materialPreparationFile,'saturn-orbit-material-'+lens.id+'.webp');
  assert.equal(lens.materialUrl,undefined);
  assert.equal(runtime.variants[lens.id].runtimeAtlas.assetUrl,'/scenes/saturn/'+lens.materialPreparationFile);
 }
});
test('distinguishes observational surfaces from the schematic thermal illustration',()=>{
 for(const lens of lenses.controls.filter(lens=>lens.falseColor===true)){
  assert.match(lens.surface2xUrl,/@2x\.webp$/);assert.equal(lens.detailCarrierUrl,'/scenes/saturn/saturn-surface.jpg');
  assert.equal(lens.falseColorPalette.length,3);assert.ok(lens.materialGain>0&&lens.materialGain<=1);
  if(lens.id==='thermal'){
   assert.equal(lens.sourceModel,'schematic-morphology-illustration');
   assert.match(lens.detailPreparation,/Visible-light luminance and authored spatial patterns/);
   assert.equal(lens.maximumDetailScale,1);assert.equal(lens.sourceFiles.length,0);assert.equal(lens.sourceUrls.length,2);
   assert.match(lens.qualification,/Schematic/);assert.match(lens.qualification,/no measured infrared/);assert.equal(lens.filter,'Schematic');assert.equal(lens.label,'Thermal illustration');
  }else{
   assert.equal(lens.sourceModel,'hubble-global-map');
   assert.equal(lens.detailPreparation,'intact rotation A, lossless DPR surfaces, bounded visible-detail pansharpening');
   assert.equal(lens.maximumDetailScale,1.12);assert.equal(lens.sourceFiles.length,1);assert.match(lens.sourceFiles[0],/2025a_/);
  }
 }
});
test('keeps every canonical prepared ring alpha texel unchanged across lenses',async()=>{
 const alpha=async (url: string)=>sharp(await readFile(publicPath(url))).ensureAlpha().extractChannel(3).raw().toBuffer();
 const normal=await alpha('/scenes/saturn/saturn-rings@2x.webp');
 for(const lens of lenses.controls.filter(lens=>lens.falseColor===true))assert.equal(Buffer.compare(await alpha(lens.ring2xUrl),normal),0,lens.id);
});
test('declares canonical prepared lens resources and exclusive cross-section selection',()=>{
 const initial=initialObjectSelection(definition.controls);
 const view: import("../../../../src/renderers/css/rendering/prepared-material.ts").PreparedMaterialView & {controlPitch:number;controlYaw:number}={sceneMatrix:"matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",controlPitch:required(definition.camera.defaultControlPitchDegrees),controlYaw:required(definition.camera.defaultControlYawDegrees),sunViewDirection:viewSunDirectionToPreparedLightDirection(required(required(definition.sun).referenceViewDirection))};view.reference=view;
 for(const lens of lenses.controls.filter(lens=>lens.view!=='interior')){
  const selected=reduceObjectSelection(initial,{kind:'lens',id:lens.id});
  const plan=resolvePreparedPresentation(definition,{selection:selected,view});
  const resources=plan.required.map(key=>required(definition.assets.entries.find(entry=>entry.key===key)));assert.ok(resources.every(Boolean));
  for(const url of[lens.surface2xUrl||lens.surfaceUrl,lens.polesUrl,lens.ring2xUrl||lens.ringUrl])assert.ok(resources.some(entry=>entry.url===url),lens.id+': '+url);
  const cutaway=reduceObjectSelection(selected,{kind:'lens',id:'cross-section'});
  assert.equal(cutaway.lensId,'cross-section');assert.equal(Object.hasOwn(cutaway,'interior'),false);
  const cutawayPlan=resolvePreparedPresentation(definition,{selection:cutaway,view});
  assert.deepEqual(cutawayPlan.pressedLenses,['cross-section']);assert.ok(cutawayPlan.required.includes('surface:normal'));assert.ok(cutawayPlan.required.some(key=>/^interior-material:normal-no-shadows(?::row:\d+)?$/.test(key)));
 }
});
