import { required } from '../../contract/test-values.mts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleFootprint} from '../surface-observations/footprint.mts';
import {castSourceRays} from '../surface-observations/geometry.mts';
import {validateEncounterImageReference} from '../surface-observations/formats/encounter.mts';
import type {PixelGeometry} from '../surface-observations/contract.mts';
import {validateEncounterControls} from './encounter-controls.mts';
import {encounterCamera} from './encounter-camera.mts';
const sample=()=>{
 const accepted=new Uint8Array([1,1,1,1]),xyz=new Float64Array([0,0,0,1,0,0,0,1,0,1,1,0]),emissions=[0,10,20,30];
 const geometry: PixelGeometry={source:'source-mesh-rays',report:{},reject:i=>accepted[i]?null:'no-geometry',
  distanceMeters:(i,p)=>Math.hypot(xyz[i*3]-p[0],xyz[i*3+1]-p[1],xyz[i*3+2]-p[2]),rangeMeters:()=>10,incidence:()=>0,emission:i=>emissions[i]*Math.PI/180,phase:()=>0};
 const image={width:2,height:2,values:[0,-1,2,3],reject:()=>null,startTime:'',filter:'',report:{}};
 return {source:{image,camera:{project:()=>[.5,.5,10]},geometry,photometry:{gain:()=>1,retainsIllumination:true}},accepted,xyz};
};
const limits={maximumSeparationMeters:2,maximumEmissionDegrees:75};
test('a bilinear footprint retains calibrated darkness and interpolates only the contributors that count',()=>{
 const {source,accepted,xyz}=sample(),point=[.5,.5,0];
 const result=sampleFootprint(source,point,limits);
 // Each contributor is normalized before interpolation, and the report keeps the steepest emission it used.
 assert.equal(result.radiance,1);assert.ok(Math.abs(required(result.maximumEmissionDegrees)-30)<1e-12);
 // A contributor without a surface point is left out while the others carry at least half the weight.
 accepted[0]=0;assert.ok(Math.abs(required(sampleFootprint(source,point,limits).radiance)-4/3)<1e-12);
 accepted[1]=0;assert.equal(sampleFootprint(source,point,limits).radiance,2.5);
 accepted[2]=0;assert.equal(sampleFootprint(source,point,limits).reason,'no-geometry');
 accepted.fill(1);
 // A contributor on another surface is left out rather than mixed in.
 xyz[11]=50;assert.ok(Math.abs(required(sampleFootprint(source,point,limits).radiance)-1/3)<1e-12);
 xyz[2]=50;xyz[5]=50;assert.equal(sampleFootprint(source,point,limits).reason,'geometry-mismatch');
});
test('detector edges never interpolate missing contributors',()=>{
 const {source}=sample();
 for(const p of [[-.1,.5,10],[1,.5,10],[.5,1,10]])assert.equal(sampleFootprint({...source,camera:{project:()=>p}},[0,0,0],limits).reason,'outside-detector');
 assert.equal(sampleFootprint({...source,camera:{project:()=>null}},[0,0,0],limits).reason,'behind-camera');
});
test('registration recomputes holdouts and cannot be approved by changing declared RMS',()=>{
 const camera={project:(p: readonly number[])=>[p[0],p[1],10],report:{nominalPixelScaleMeters:1}};
 const controls=Array.from({length:12},(_,i)=>({id:String(i),partition:i<6?'fit':'holdout',sourcePointMeters:[i,i%3,0],sourcePixel:[i,i%3]}));
 const r={method:'source-topography-feature-translation',sourceShapeSha256:'a'.repeat(64),controls,maximumRmsMeters:1,maximumResidualMeters:2,nominalPixelScaleMeters:1,limitations:'Image feature residuals; no absolute geodetic accuracy claim.'};
 assert.equal(required(validateEncounterControls(camera,r,r.sourceShapeSha256).holdout).rmsPixels,0);
 Object.assign(r,{holdout:{rmsPixels:0,maximumPixels:0}});r.controls[11].sourcePixel[0]+=20;
 assert.throws(()=>Reflect.apply(validateEncounterControls, undefined, [camera, r, r.sourceShapeSha256]),/budget/);
 assert.throws(()=>Reflect.apply(validateEncounterControls, undefined, [camera, r, 'b'.repeat(64)]),/source-bound/);
});
test('image overlap controls require the pinned earlier reference and visible source points',()=>{
 const sha='a'.repeat(64),reference={id:'reference',imageSha256:sha,controlSha256:sha,camera:{positionMeters:[0,0,10],project:(p: readonly number[])=>[p[0],p[1],10]},sample:()=>({})};
 const control={registration:{method:'registered-image-feature-translation',reference:{id:'reference',imageSha256:sha,controlSha256:sha},controls:[{referencePixel:[0,0],sourcePointMeters:[0,0,0]}]}};
 const mesh={intersect:()=>({radius:10})};
 validateEncounterImageReference(control,reference,mesh);
 assert.throws(()=>Reflect.apply(validateEncounterImageReference, undefined, [control, undefined, mesh]),/earlier qualified/);
 assert.throws(()=>Reflect.apply(validateEncounterImageReference, undefined, [control, {...reference,controlSha256:'b'.repeat(64)}, mesh]),/source hashes/);
 assert.throws(()=>Reflect.apply(validateEncounterImageReference, undefined, [control, {...reference,sample:()=>({reason:'bad-source-pixel'})}, mesh]),/qualified reference pixel/);
 assert.throws(()=>Reflect.apply(validateEncounterImageReference, undefined, [control, reference, {intersect:()=>({radius:5})}]),/occluded/);
 control.registration.controls[0].referencePixel=[3,4];
 assert.throws(()=>Reflect.apply(validateEncounterImageReference, undefined, [control, reference, mesh]),/qualified reference pixel/);
});
test('EPOXI north and east map to the documented detector axes',()=>{
 const h={GEOMSTAT:'OK',GEOMQUAL:'RECONSTRUCTED',DNAXIS1:'RIGHT, +Xinstr',DNAXIS2:'UP, -Yinstr',TARSCRX:-10,TARSCRY:0,TARSCRZ:0,TARSUNRX:100,TARSUNRY:0,TARSUNRZ:0,BORERA:0,BOREDEC:0,CELESTN:0,TARSCR:10,PXLSCALE:100,NAXIS1:8,NAXIS2:8};
 const c=encounterCamera(h,{bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[0,0],maximumOffsetPixels:0});
 const actual=c.project([0,100,200]);assert.ok(Math.abs(required(actual)[0]-2.5)<1e-10);assert.ok(Math.abs(required(actual)[1]-5.5)<1e-10);
 assert.equal(c.report.nominalPixelScaleMeters,100);
});
test('observed shadowed terrain keeps its geometry when the source camera can see it',()=>{
 const camera={kind:'control-network' as const,positionMeters:[0,0,10],positionKm:[0,0,.01],sunDirection:[0,0,-1],pinhole:true,report:{},project:()=>[.5,.5,10],ray:()=>[0,0,-1]};
 const mesh={positions:[[-1,-1,0],[1,-1,0],[0,1,0]],indices:[[0,1,2]],intersect:()=>({faceId:0,radius:10})};
 const geometry=castSourceRays(camera,mesh,2,2);
 assert.deepEqual([0,1,2,3].map(i=>geometry.reject(i)),[null,null,null,null]);assert.equal(geometry.report.geometryPixels,4);
 const unconstrained=castSourceRays(camera,{...mesh,faceProvenance:[1]},2,2);
 assert.deepEqual([0,1,2,3].map(i=>unconstrained.reject(i)),Array(4).fill('unconstrained-source-shape'));
});
