import { sha256 } from '../../../src/platform/sha256.mts';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {array,number,optional,shape,text,parseEncounterPolicy,parseEncounterSourceControl,parseMeshProfile} from '../terrestrial-layers/source-records.mts';
import {decodeEncounterFits} from '../terrestrial-layers/encounter-fits.mts';
import {encounterCamera} from '../terrestrial-layers/encounter-camera.mts';
import {validateEncounterControls} from '../terrestrial-layers/encounter-controls.mts';
import {loadPdsPlanetocentricShape} from '../terrestrial-layers/obj-shape.mts';
import {castSourceRays} from '../surface-observations/geometry.mts';
import {sampleFootprint} from '../surface-observations/footprint.mts';
import {matchImageFeatures} from '../terrestrial-layers/image-feature-matching.mts';

const matching=shape({patchRadius:number,searchRadius:number,gridStride:number,gridOrigin:number,targetSmoothingSigma:number,minimumCorrelation:number,minimumPeakMargin:number,minimumJointValidFraction:number});
const parseRecipe=shape({schema:text,shapeSha256:text,margin:number,matching,maximumRmsPixels:number,maximumResidualPixels:number,frames:array(shape({id:text,referenceId:text,observation:parseEncounterPolicy}))});
const parseManifest=shape({inputs:array(shape({path:text,expectedBytes:optional(number),expectedSha256:optional(text)}))});
const parseGeometry=shape({geometry:shape({radialTerrain:shape({path:text,grid:parseMeshProfile})})});

const json=async(p:string):Promise<unknown>=>JSON.parse(await readFile(p,'utf8'));

/** Reproduce the three cropped ITS cameras from pinned native image overlap.
 * Camera attitude/intrinsics and the full 2012 mesh stay fixed; fit translation
 * from one checkerboard partition and evaluate every remaining control. */
export async function prepareCloseups(sourceDirectory:string,write=false) {
  const source=resolve(sourceDirectory),manifest=parseManifest(await json(resolve(source,'manifest.json'))),recipe=parseRecipe(await json(resolve(source,'preparation/closeups.json'))),geometry=parseGeometry(await json(resolve(source,'preparation/terrestrial.json'))).geometry.radialTerrain;
  assert.equal(recipe.schema,'cssearth-tempel-closeup-registration@1');
  assert.ok(recipe.maximumRmsPixels>0&&recipe.maximumRmsPixels<=1&&recipe.maximumResidualPixels>=recipe.maximumRmsPixels&&recipe.maximumResidualPixels<=2);
  const pinned=async(path:string)=>{
    const pin=manifest.inputs.find(e=>e.path===path);assert.ok(pin,`Missing source pin: ${path}`);
    const bytes=await readFile(resolve(source,path));if(pin.expectedSha256!==undefined){assert.equal(bytes.length,pin.expectedBytes);assert.equal(sha256(bytes),pin.expectedSha256);}return bytes;
  };
  await pinned('preparation/closeups.json');
  assert.equal(sha256(await pinned(geometry.path)),recipe.shapeSha256);
  const mesh=await loadPdsPlanetocentricShape(resolve(source,geometry.path),geometry.grid);
  const transfer={maximumSeparationMeters:200,visibilityToleranceMeters:.5,maximumEmissionDegrees:75};
  const reports=[];
  for(const entry of recipe.frames){
    assert.match(entry.id,/^iv05070405_9000\d{3}_001_r$/);assert.match(entry.referenceId,/^iv05070405_9000\d{3}_001_r$/);
    const directory='photography/deep-impact',refBytes=await pinned(`${directory}/${entry.referenceId}.fit`),refControlBytes=await pinned(`${directory}/${entry.referenceId}.json`),refControl=parseEncounterSourceControl(JSON.parse(refControlBytes.toString('utf8')));
    const reference=decodeEncounterFits(refBytes,refControl.observation),refCamera=encounterCamera(reference.header,refControl.camera);
    validateEncounterControls(refCamera,refControl.registration,recipe.shapeSha256);
    const referenceCamera={kind:'control-network' as const,project:refCamera.project,ray:refCamera.ray,positionMeters:refCamera.positionMeters,positionKm:refCamera.positionKm,sunDirection:refCamera.sunDirection,pinhole:true,report:refCamera.report};
    const footprint={image:{width:reference.width,height:reference.height,values:reference.values,reject:reference.reason,startTime:String(reference.startTime),filter:String(reference.filter),report:reference.report},camera:referenceCamera,geometry:castSourceRays(referenceCamera,mesh,reference.width,reference.height),photometry:{gain:()=>1,retainsIllumination:true}},targetBytes=await pinned(`${directory}/${entry.id}.fit`),target=decodeEncounterFits(targetBytes,entry.observation);
    const seed={bodyToJ2000:refControl.camera.bodyToJ2000,offsetPixels:[0,0],maximumOffsetPixels:256},camera=encounterCamera(target.header,seed);
    const width=target.width+2*recipe.margin,height=target.height+2*recipe.margin,values=new Float32Array(width*height),valid=new Uint8Array(width*height),xyz=new Float64Array(width*height*3),uv=new Float64Array(width*height*2);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,ray=camera.ray(x-recipe.margin,y-recipe.margin),hit=mesh.intersect(camera.positionMeters,ray);if(!hit)continue;
      const point=camera.positionMeters.map((n,j)=>n+ray[j]*hit.radius),pixel=refCamera.project(point),sample=sampleFootprint(footprint,point,transfer);
      if(sample.reason||sample.radiance===undefined||!pixel)continue;
      const delta=point.map((n,j)=>n-refCamera.positionMeters[j]),distance=Math.hypot(...delta),visible=mesh.intersect(refCamera.positionMeters,delta.map(n=>n/distance),distance+.5);
      if(!visible||Math.abs(visible.radius-distance)>.5)continue;
      values[i]=sample.radiance;valid[i]=1;xyz.set(point,i*3);uv.set(pixel.slice(0,2),i*2);
    }
    const match=matchImageFeatures({width:target.width,height:target.height,values:target.values,valid:Uint8Array.from(target.values,(_,i)=>target.reason(i)?0:1)},{width,height,values,valid},recipe.margin,recipe.matching);
    const controls=match.matches.map(m=>{const i=(m.seedPixel[1]+recipe.margin)*width+m.seedPixel[0]+recipe.margin;return {...m,sourcePointMeters:Array.from(xyz.subarray(i*3,i*3+3)),referencePixel:Array.from(uv.subarray(i*2,i*2+2))};});
    const control={schema:'cssearth-encounter-control@1',observation:entry.observation,camera:{...seed,offsetPixels:match.offsetPixels},registration:{method:'registered-image-feature-translation',sourceShapeSha256:recipe.shapeSha256,reference:{id:entry.referenceId.replaceAll('_','-'),imageSha256:sha256(refBytes),controlSha256:sha256(refControlBytes)},nominalPixelScaleMeters:camera.report.nominalPixelScaleMeters,maximumRmsMeters:Math.min(100,recipe.maximumRmsPixels*camera.report.nominalPixelScaleMeters),maximumResidualMeters:Math.min(200,recipe.maximumResidualPixels*camera.report.nominalPixelScaleMeters),limitations:'Relative overlap registration inherits the reference photograph and 2012 shape placement uncertainty. Subpixel relative residuals do not establish subpixel absolute surface coordinates.',controls},matching:{...recipe.matching,excluded:match.excluded},frameBinding:refControl.camera.bodyToJ2000};
    const registered=encounterCamera(target.header,control.camera),report=validateEncounterControls(registered,control.registration,recipe.shapeSha256);
    const path=`${directory}/${entry.id}.json`,bytes=Buffer.from(JSON.stringify(control,null,2)+'\n');
    if(write){await writeFile(resolve(source,path),bytes);const pin=manifest.inputs.find(p=>p.path===path);assert.ok(pin);if(pin.expectedSha256!==undefined){pin.expectedBytes=bytes.length;pin.expectedSha256=sha256(bytes);}}
    else assert.equal((await pinned(path)).toString('utf8'),bytes.toString('utf8'),`Registration is not reproducible: ${entry.id}`);
    reports.push({id:entry.id,...report});
  }
  if(write)await writeFile(resolve(source,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  assert.ok(process.argv.slice(2).every(a=>a==='--write'));
  console.log(JSON.stringify(await prepareCloseups(resolve('src/objects/comet-9p/source'),process.argv.includes('--write')),null,2));
}
