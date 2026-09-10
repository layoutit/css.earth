import type { SourceMesh, SurfaceOptions, SurfaceColorSample, GeoSample } from './contracts.mts';
import {parseEncounterRecipe,parseSurfaceGeometry,parseEncounterSourceControl,decodeProfile} from './source-records.mts';
type Vector = readonly number[] | Float64Array;
type Camera = ReturnType<typeof encounterCamera>;
type EncounterFrame = ReturnType<typeof decodeEncounterFits>;
type EncounterRecipe = ReturnType<typeof parseEncounterRecipe>;
interface EncounterBackplane {accepted:Uint8Array;xyz:Float64Array;gains:Float32Array;emissions:Float32Array;reasons:string[];
 report:{projectedBounds:number[];acceptedPixels:number;rejectedPixels:Record<string,number>}}
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { decodeEncounterFits } from './encounter-fits.mts';
import { encounterCamera } from './encounter-camera.mts';
import { validateEncounterRegistration } from './encounter-registration.mts';
import { sampleTrianglePoints, fitObservationLevels, selectObservation } from './observation-mosaic.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';

const dot = (a: Vector,b: Vector) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub = (a: Vector,b: Vector) => a.map((n,i)=>n-b[i]);
const unit = (a: Vector) => { const l=Math.hypot(...a); return a.map(n=>n/l); };
const cross = (a: Vector,b: Vector) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const safePath = (p: unknown) => typeof p==='string' && p.length>0 && !p.startsWith('/') && !p.split(/[\\/]/).includes('..');
const positive = (n: number) => Number.isFinite(n) && n>0;
export function validateEncounterRecipe(value: unknown, sourceGeometry: unknown) {
  const recipe=decodeProfile(parseEncounterRecipe,value,'Invalid source-bound encounter photography recipe.'),geometry=parseSurfaceGeometry(sourceGeometry);
  const t=recipe.transfer;
  if (recipe.format!=='encounter-fits' || !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      !Array.isArray(recipe.frames) || recipe.frames.length<1 || recipe.frames.length>8 ||
      recipe.frames.some(f=>!f || !/^[a-z][a-z0-9-]*$/.test(f.id) || ![f.path,f.labelPath,f.controlPath].every(safePath)) ||
      new Set(recipe.frames.map(f=>f.id)).size!==recipe.frames.length || !recipe.metadata?.label || !recipe.metadata?.coverage ||
      geometry?.simplification?.method!=='source-meshoptimizer' ||
      !positive(t?.maximumSourceDistanceMeters) || t.maximumSourceDistanceMeters>geometry.simplification.maximumErrorMeters ||
      !positive(t?.maximumSeparationMeters) || t.maximumSeparationMeters>400 ||
      !positive(t?.visibilityToleranceMeters) || t.visibilityToleranceMeters>1 ||
      !positive(t?.maximumEmissionDegrees) || t.maximumEmissionDegrees>80 ||
      recipe.photometry?.model!=='observed' ||
      recipe.photometry.maximumGain!==1 ||
      !['lowest-emission','finest-resolution'].includes(recipe.selection) || !Array.isArray(recipe.displayPercentiles) || recipe.displayPercentiles.length!==2 ||
      !recipe.displayPercentiles.every(Number.isFinite) || recipe.displayPercentiles[0]<0 || recipe.displayPercentiles[1]>100 || recipe.displayPercentiles[0]>=recipe.displayPercentiles[1]) {
    throw new TypeError('Invalid source-bound encounter photography recipe.');
  }
}

/** All four pixel centers must describe the same physical surface patch. Dark
 * calibrated pixels remain eligible; no brightness threshold defines coverage. */
export function sampleEncounterFootprint(frame: EncounterFrame, camera: Camera, plane: EncounterBackplane, point: readonly number[], policy: {maximumSeparationMeters:number}): GeoSample {
  const p=camera.project(point);
  if (!p) return {reason:'behind-camera'};
  const x=Math.floor(p[0]),y=Math.floor(p[1]);
  if (x<0 || y<0 || x+1>=frame.width || y+1>=frame.height) return {reason:'outside-detector'};
  const fx=p[0]-x,fy=p[1]-y,ids=[y*frame.width+x,y*frame.width+x+1,(y+1)*frame.width+x,(y+1)*frame.width+x+1];
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  let radiance=0,gain=0,separationMeters=0,maximumEmissionDegrees=0;
  for(let j=0;j<4;j++) {
    const i=ids[j];
    if (!plane.accepted[i]) return {reason:plane.reasons[i]??'unqualified-source-pixel'};
    const distance=Math.hypot(...sub(plane.xyz.subarray(i*3,i*3+3),point));
    if (distance>policy.maximumSeparationMeters) return {reason:'discontinuous-footprint'};
    separationMeters=Math.max(separationMeters,distance);
    radiance+=frame.values[i]*plane.gains[i]*weights[j];gain+=plane.gains[i]*weights[j];
    maximumEmissionDegrees=Math.max(maximumEmissionDegrees,plane.emissions[i]);
  }
  return {radiance,gain,separationMeters,maximumEmissionDegrees};
}

function qualifiedFace(mesh: SourceMesh,id: number) {
  if (mesh.faceProvenance && mesh.faceProvenance[id]!==0) return false;
  if (mesh.constraintFlags && mesh.indices[id].some(v=>mesh.constraintFlags?.[v]===3)) return false;
  return true;
}

/** Reconstructed pixel backplanes use the original source mesh and camera,
 * never the simplified display mesh. They are preparation-only working data. */
export function buildEncounterBackplane(frame: EncounterFrame,camera: Camera,mesh: SourceMesh,recipe: Pick<EncounterRecipe,"transfer">) {
  const count=frame.width*frame.height;
  const plane={accepted:new Uint8Array(count),xyz:new Float64Array(count*3),gains:new Float32Array(count),emissions:new Float32Array(count),reasons:new Array<string>()};
  const tally:Record<string,number>={};const reject=(i:number,reason:string)=>{plane.reasons[i]=reason;tally[reason]=(tally[reason]??0)+1;};
  const projected=mesh.positions.map(p=>camera.project(p)).filter(p => p !== null);
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  const bounds=[Math.max(0,Math.floor(Math.min(...xs))-2),Math.max(0,Math.floor(Math.min(...ys))-2),Math.min(frame.width-1,Math.ceil(Math.max(...xs))+2),Math.min(frame.height-1,Math.ceil(Math.max(...ys))+2)];
  const normals=mesh.indices.map(f=>unit(cross(sub(mesh.positions[f[1]],mesh.positions[f[0]]),sub(mesh.positions[f[2]],mesh.positions[f[0]]))));
  const emissionLimit=Math.cos(recipe.transfer.maximumEmissionDegrees*Math.PI/180);
  let accepted=0;
  for(let y=bounds[1];y<=bounds[3];y++) for(let x=bounds[0];x<=bounds[2];x++) {
    const i=y*frame.width+x,reason=frame.reason(i);
    if(reason){reject(i,reason);continue;}
    const direction=camera.ray(x,y),hit=mesh.intersect(camera.positionMeters,direction);
    if(!hit){reject(i,'off-nucleus');continue;}
    if(!qualifiedFace(mesh,hit.faceId)){reject(i,'unconstrained-source-shape');continue;}
    const point=camera.positionMeters.map((v,j)=>v+direction[j]*hit.radius),normal=normals[hit.faceId];
    const mu=-dot(normal,direction);
    // A photograph can record shadowed or night-facing terrain. Sun incidence
    // cannot invalidate a detector pixel when no reflectance division is used.
    if(mu<emissionLimit){reject(i,'acquisition-angle');continue;}
    const gain=1;
    plane.accepted[i]=1;plane.xyz.set(point,i*3);plane.gains[i]=gain;plane.emissions[i]=Math.acos(Math.min(1,mu))*180/Math.PI;accepted++;
  }
  return {...plane,report:{projectedBounds:bounds,acceptedPixels:accepted,rejectedPixels:tally}};
}

interface BoundEncounter {
  id:string;imageSha256:string;controlSha256:string;frame:EncounterFrame;camera:Camera;plane:EncounterBackplane;
  sampleSource(point:readonly number[]):GeoSample;control:ReturnType<typeof parseEncounterSourceControl>;registration:ReturnType<typeof validateEncounterRegistration>;
}

/** A close-up must inherit an already-qualified, byte-pinned photograph in this
 * mosaic. Recheck its actual reference pixels against the original mesh. */
export function validateEncounterImageReference(control:ReturnType<typeof parseEncounterSourceControl>,reference:Pick<BoundEncounter,'id'|'imageSha256'|'controlSha256'|'camera'|'sampleSource'>|undefined,mesh:SourceMesh) {
  const r=control.registration;if(r.method!=='registered-image-feature-translation')return;
  if(!r.reference||!reference||reference.id!==r.reference.id||reference.imageSha256!==r.reference.imageSha256||reference.controlSha256!==r.reference.controlSha256)throw new Error('Close-up reference must be an earlier qualified image with matching source hashes.');
  for(const p of r.controls){
    const projected=reference.camera.project(p.sourcePointMeters);
    if(!p.referencePixel||!projected||Math.hypot(projected[0]-p.referencePixel[0],projected[1]-p.referencePixel[1])>1e-6||reference.sampleSource(p.sourcePointMeters).reason)throw new Error('Close-up control is not bound to a qualified reference pixel.');
    const delta=sub(p.sourcePointMeters,reference.camera.positionMeters),distance=Math.hypot(...delta),hit=mesh.intersect(reference.camera.positionMeters,Array.from(delta,n=>n/distance),distance+.5);
    if(!hit||Math.abs(hit.radius-distance)>.5)throw new Error('Close-up reference control is occluded or off the source mesh.');
  }
}

export async function loadEncounterSurface({sourceDirectory,source,recipe:value,radial,config}: SurfaceOptions) {
  const recipe=parseEncounterRecipe(value);
  validateEncounterRecipe(recipe,config.geometry.radialTerrain);
  const entries=await source.validateGroup(recipe.consumer),paths=recipe.frames.flatMap(f=>[f.path,f.labelPath,f.controlPath]);
  if(entries.length!==paths.length || new Set(paths).size!==paths.length || !paths.every(p=>entries.some(e=>e.path===p))) throw new Error('Encounter surface must consume its exact pinned photographs, labels and controls.');
  if(recipe.frames.length>1 && (!recipe.levelMatching || !Number.isInteger(recipe.levelMatching.minimumPairs) || recipe.levelMatching.minimumPairs<64 || !(recipe.levelMatching.maximumLogMad>0 && recipe.levelMatching.maximumLogMad<=.3) || !(recipe.levelMatching.maximumGain>=1 && recipe.levelMatching.maximumGain<=3))) throw new Error('Invalid encounter level-matching budget.');
  const shape=await source.validatePath(config.geometry.radialTerrain.path);
  const observations: BoundEncounter[]=[];const metersPerUnit=config.geometry.radiusKm*1000/config.geometry.radius;
  for(const f of recipe.frames) {
    const controlBytes=await readFile(resolve(sourceDirectory,f.controlPath)),imageBytes=await readFile(resolve(sourceDirectory,f.path));
    const control=parseEncounterSourceControl(JSON.parse(controlBytes.toString('utf8')));
    const frame=decodeEncounterFits(imageBytes,control.observation);
    const camera=encounterCamera(frame.header,control.camera);
    const registration=validateEncounterRegistration(camera,control.registration,shape.expectedSha256);
    const plane=buildEncounterBackplane(frame,camera,radial.grid,recipe);
    const sampleSource=(point: readonly number[])=>sampleEncounterFootprint(frame,camera,plane,point,recipe.transfer);
    validateEncounterImageReference(control,observations.find(o=>o.id===control.registration.reference?.id),radial.grid);
    observations.push({id:f.id,imageSha256:createHash('sha256').update(imageBytes).digest('hex'),controlSha256:createHash('sha256').update(controlBytes).digest('hex'),frame,camera,plane,sampleSource,control,registration});
  }
  const missing=(point: readonly number[],reason: string)=>({reason,color:missingCoverageColor(Math.atan2(point[1],point[0])*180/Math.PI,Math.atan2(point[2],Math.hypot(point[0],point[1]))*180/Math.PI,180/config.raster.height)});
  const sampleAll=(displayPoint: readonly number[]): Array<GeoSample & {color?:number[];distanceMeters?:number} | {reason:string;color:number[];radiance?:never;maximumEmissionDegrees?:never}>=>{
    const point=displayPoint.map(n=>n*metersPerUnit),hit=radial.grid.closestPoint(point,recipe.transfer.maximumSourceDistanceMeters);
    if(!hit || !qualifiedFace(radial.grid,hit.faceId)) return observations.map(()=>missing(point,'source-distance-or-constraint'));
    return observations.map(o=>{
      const sample=o.sampleSource(hit.point);if(sample.reason)return missing(point,sample.reason);
      const delta=sub(hit.point,o.camera.positionMeters),distance=Math.hypot(...delta),ray=radial.grid.intersect(o.camera.positionMeters,Array.from(delta,n=>n/distance),distance+recipe.transfer.visibilityToleranceMeters);
      if(!ray || Math.abs(ray.radius-distance)>recipe.transfer.visibilityToleranceMeters)return missing(point,'occluded');
      return {...sample,distanceMeters:hit.distanceMeters};
    });
  };
  const choose=(samples: ReturnType<typeof sampleAll>)=>recipe.selection==='finest-resolution' ? samples.reduce((best,sample,i)=>!sample.reason && (best<0 || observations[i].registration.nominalPixelScaleMeters<observations[best].registration.nominalPixelScaleMeters) ? i : best,-1) : selectObservation(samples);
  if (observations.length > 1 && !recipe.levelMatching) throw new Error('Missing encounter level-matching budget.');
  const points=sampleTrianglePoints(radial.faces,recipe.levelMatching?.samplesPerTriangle??8);
  const samples=points.map(sampleAll);
  const levelPolicy=recipe.levelMatching;
  const levels=observations.length===1?{gains:[1],pairs:[]}:fitObservationLevels(observations.map((_,i)=>samples.map(s=>s[i])),levelPolicy ?? (()=>{throw new Error('Missing encounter level-matching budget.');})());
  const values:number[]=[];
  for(const samplesAtPoint of samples){const i=choose(samplesAtPoint);if(i>=0){const sample=samplesAtPoint[i];if(sample.reason===undefined)values.push(sample.radiance*levels.gains[i]);}}
  values.sort((a,b)=>a-b);
  const [low,high]=recipe.displayPercentiles.map(p=>values[Math.min(values.length-1,Math.floor(values.length*p/100))]);
  if(!(high>low))throw new Error('Encounter surface has no qualified radiance range.');
  const samplePoint=(point: readonly number[]): SurfaceColorSample=>{
    const values=sampleAll(point),i=choose(values);
    if(i<0)return missing(point,'no-qualified-observation');
    const value=values[i];if(value.reason!==undefined)return missing(point,value.reason);
    const radiance=value.radiance*levels.gains[i],gray=Math.round(Math.max(0,Math.min(1,(radiance-low)/(high-low)))*255);
    return {...value,radiance,color:[gray,gray,gray],frameIndex:i,frameId:recipe.frames[i].id};
  };
  const sourceSquareMeters: Record<string,number>={};
  const areaCoverage={method:'Deterministic equal-area barycentric samples on every retained triangle; excludes atlas bleed',samplesPerTriangle:recipe.levelMatching?.samplesPerTriangle??8,totalSquareMeters:0,acceptedSquareMeters:0,sourceSquareMeters,acceptedFraction:0};
  let k=0;for(const face of radial.faces){const [a,b,c]=face.vertices,area=Math.hypot(...cross(sub(b,a),sub(c,a)))/2*metersPerUnit**2,weight=area/areaCoverage.samplesPerTriangle;areaCoverage.totalSquareMeters+=area;for(let j=0;j<areaCoverage.samplesPerTriangle;j++){const i=choose(samples[k++]);if(i<0)continue;areaCoverage.acceptedSquareMeters+=weight;const id=recipe.frames[i].id;areaCoverage.sourceSquareMeters[id]=(areaCoverage.sourceSquareMeters[id]??0)+weight;}}
  areaCoverage.acceptedFraction=areaCoverage.acceptedSquareMeters/areaCoverage.totalSquareMeters;
  const report={areaCoverage,camera:observations[0].camera.report,frames:observations.map((o,i)=>({id:recipe.frames[i].id,startTime:o.frame.startTime,filter:o.frame.filter,camera:o.camera.report,quality:o.frame.report,sourceCoverage:o.plane.report,registration:o.registration})),
    sourceIds:entries.map(e=>({id:e.id,sha256:e.expectedSha256})),selection:recipe.selection,levelMatching:levels,
    photometry:{...recipe.photometry,limitations:'Original acquisition shading retained; bounded relative display levels only, not albedo.'},
    display:{percentiles:recipe.displayPercentiles,low,high,units:observations[0].frame.units},
    previewPolicy:'Unique radial intersections only; atlas samples the closest full-source surface point in 3D.'};
  const preview=(width:number,height:number)=>{
    const rgb=Buffer.alloc(width*height*3),missingPixels=new Uint8Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const lon=(x+.5)*360/width,lat=90-(y+.5)*180/height,i=y*width+x,hit=radial.grid.hit(lon,lat,true);
      if(!hit){missingPixels[i]=1;continue;}
      const a=lon*Math.PI/180,d=lat*Math.PI/180,r=hit.radius/metersPerUnit,p=[r*Math.cos(d)*Math.cos(a),r*Math.cos(d)*Math.sin(a),r*Math.sin(d)];
      const value=samplePoint(p);rgb.set(value.color,i*3);missingPixels[i]=value.reason?1:0;
    }
    return {rgb,missing:missingPixels};
  };
  return {samplePoint,preview,report};
}
