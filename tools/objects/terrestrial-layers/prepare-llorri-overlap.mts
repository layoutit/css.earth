/** Reuse the registered-image overlap method for native Lucy TAN-SIP cameras. */
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { array, number, optional, shape, text, parseMeshProfile, parseGeoCameraClosure } from './source-records.mts';
import { loadKernelSet } from '../../spice/kernel-set.mts';
import { llorriHeaderCamera } from './llorri-header-camera.mts';
import { loadObjShape } from './obj-shape.mts';
import { decodeLlorri, bindSipCamera } from './llorri-geo.mts';
import { matrixCamera } from '../surface-observations/cameras.mts';
import { castSourceRays } from '../surface-observations/geometry.mts';
import { sampleFootprint } from '../surface-observations/footprint.mts';
import { matchImageFeatures } from './image-feature-matching.mts';

const matching = shape({patchRadius:number,searchRadius:number,gridStride:number,gridOrigin:number,targetSmoothingSigma:number,minimumCorrelation:number,minimumPeakMargin:number,minimumJointValidFraction:number});
const transfer = shape({maximumSourceDistanceMeters:number,maximumSeparationMeters:number,visibilityToleranceMeters:number,maximumEmissionDegrees:number});
const parseRecipe = shape({schema:text,bodyId:number,target:optional(text),kernels:array(text),margin:number,maximumRmsPixels:number,maximumResidualPixels:number,transfer,
  frames:array(shape({image:text,label:text,referenceImage:text,referenceCamera:text,output:text,matching}))});
const parseGeometry = shape({geometry:shape({radialTerrain:shape({path:text,grid:parseMeshProfile})})});

const json = async(path:string):Promise<unknown> => JSON.parse(await readFile(path,'utf8'));

/** Fixed camera intrinsics, attitude and full source mesh; only detector translation
 * is fitted. Grid membership precedes matching and no residuals are discarded. */
export async function prepareLlorriOverlap(sourceDirectory:string, write=false) {
  const source=resolve(sourceDirectory), sources=await createSourceManifest({objectId:basename(resolve(source,'..')),objectName:basename(resolve(source,'..')),sourceRoot:source});
  const pinned=(path:string)=>sources.readSource(path);
  const recipePath='preparation/llorri-overlap.json',recipe=parseRecipe(JSON.parse((await pinned(recipePath)).toString('utf8')));
  assert.equal(recipe.schema,'cssearth-llorri-overlap@1');
  assert.ok(recipe.maximumRmsPixels>0&&recipe.maximumRmsPixels<=1&&recipe.maximumResidualPixels>=recipe.maximumRmsPixels&&recipe.maximumResidualPixels<=3);
  const geometry=parseGeometry(await json(resolve(source,'preparation/terrestrial.json'))).geometry.radialTerrain;
  await pinned(geometry.path);
  for(const path of recipe.kernels) await pinned(path);
  const kernels=await loadKernelSet(recipe.kernels.map(path=>resolve(source,path))),mesh=await loadObjShape(resolve(source,geometry.path),geometry.grid),reports=[];
  for(const entry of recipe.frames) {
    const refBytes=await pinned(entry.referenceImage),refClosure=parseGeoCameraClosure(JSON.parse((await pinned(entry.referenceCamera)).toString('utf8')));
    for(const pin of refClosure.provenance) if(pin.path!==undefined) await pinned(pin.path);
    const reference=decodeLlorri(refBytes,refClosure),refCamera=matrixCamera('archived-closure',refClosure,bindSipCamera(refClosure));
    const footprint={image:{width:1024,height:1024,values:reference.planes.IMAGE,startTime:reference.startTime,filter:reference.filter,reject:(i:number)=>reference.acceptPixel(i)?null:'quality',report:reference.qualityReport},
      camera:refCamera,geometry:castSourceRays(refCamera,mesh,1024,1024),photometry:{gain:()=>1,retainsIllumination:true}};
    const targetBytes=await pinned(entry.image); await pinned(entry.label);
    const seed=llorriHeaderCamera(targetBytes,kernels,recipe.bodyId,recipe.target),target=decodeLlorri(targetBytes,seed),camera=matrixCamera('archived-closure',seed,bindSipCamera(seed));
    const width=1024+2*recipe.margin,height=width,values=new Float32Array(width*height),valid=new Uint8Array(width*height),xyz=new Float64Array(width*height*3),uv=new Float64Array(width*height*2);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const i=y*width+x,ray=camera.ray(x-recipe.margin,y-recipe.margin),hit=mesh.intersect(camera.positionMeters,ray); if(!hit)continue;
      const point=camera.positionMeters.map((n,j)=>n+ray[j]*hit.radius),pixel=refCamera.project(point),sample=sampleFootprint(footprint,point,recipe.transfer);
      if(sample.reason||sample.radiance===undefined||!pixel)continue;
      const delta=point.map((n,j)=>n-refCamera.positionMeters[j]),distance=Math.hypot(...delta),visible=mesh.intersect(refCamera.positionMeters,delta.map(n=>n/distance),distance+recipe.transfer.visibilityToleranceMeters);
      if(!visible||Math.abs(visible.radius-distance)>recipe.transfer.visibilityToleranceMeters)continue;
      values[i]=sample.radiance; valid[i]=1; xyz.set(point,i*3); uv.set(pixel.slice(0,2),i*2);
    }
    const match=matchImageFeatures({width:1024,height:1024,values:target.planes.IMAGE,valid:Uint8Array.from(target.planes.IMAGE,(_,i)=>target.acceptPixel(i)?1:0)},
      {width,height,values,valid},recipe.margin,entry.matching);
    seed.sip.offsetPixels=match.offsetPixels;
    const registered=matrixCamera('archived-closure',seed,bindSipCamera(seed));
    const controls=match.matches.map(m=>{
      const i=(m.seedPixel[1]+recipe.margin)*width+m.seedPixel[0]+recipe.margin,pointMeters=Array.from(xyz.subarray(i*3,i*3+3)),projected=registered.project(pointMeters);
      assert.ok(projected);
      return {...m,pointMeters,referencePixel:Array.from(uv.subarray(i*2,i*2+2)),residualPixels:Math.hypot(projected[0]-m.sourcePixel[0],projected[1]-m.sourcePixel[1])};
    });
    const stats=Object.fromEntries(['fit','holdout'].map(partition=>{
      const selected=controls.filter(c=>c.partition===partition);
      return [partition,{count:selected.length,rms:Math.sqrt(selected.reduce((s,c)=>s+c.residualPixels**2,0)/selected.length),maximum:Math.max(...selected.map(c=>c.residualPixels))}];
    }));
    assert.ok(stats.holdout.rms<=recipe.maximumRmsPixels&&stats.holdout.maximum<=recipe.maximumResidualPixels,`Registration failed: ${entry.image} ${JSON.stringify(stats)}`);
    const paths=[...new Set([entry.image,entry.label,entry.referenceImage,entry.referenceCamera,geometry.path,...recipe.kernels,recipePath,...refClosure.provenance.flatMap(p=>p.path===undefined?[]:[p.path])])];
    const provenance=paths.map(path=>({path}));
    const result={...seed,provenance,checks:{status:'registered-image-overlap',
      pointing:'Original FITS WCS plus detector translation from registered-image overlap; disjoint fit and holdout grids.',
      imageRegistration:{method:'registered-image-feature-translation',referenceImage:entry.referenceImage,referenceCamera:entry.referenceCamera,
        policy:entry.matching,offsetPixels:match.offsetPixels,maximumRmsPixels:recipe.maximumRmsPixels,maximumResidualPixels:recipe.maximumResidualPixels,stats,controls,excluded:match.excluded,
        limitations:'Relative overlap registration inherits the published-landmark reference and preliminary source-shape uncertainty. Relative residuals do not establish absolute surface accuracy.'}}};
    const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');
    if(write) {
      await writeFile(resolve(source,entry.output),bytes);
    } else assert.equal((await pinned(entry.output)).toString('utf8'),bytes.toString('utf8'),`Camera not reproducible: ${entry.output}`);
    reports.push({image:entry.image,offsetPixels:match.offsetPixels,stats});
  }
  return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2),sources=args.filter(a=>a!=='--write');
  assert.ok(sources.length===1,'Usage: prepare-llorri-overlap.mts src/objects/<id>/source [--write]');
  console.log(JSON.stringify(await prepareLlorriOverlap(sources[0],args.includes('--write')),null,2));
}
