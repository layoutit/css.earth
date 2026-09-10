import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleEncounterFootprint} from './encounter-surface.mts';
import {validateEncounterRegistration} from './encounter-registration.mts';
import {encounterCamera} from './encounter-camera.mts';
const sample=()=>({frame:{width:2,height:2,values:[0,-1,2,3]},camera:{project:()=>[.5,.5,10]},plane:{accepted:new Uint8Array([1,1,1,1]),xyz:new Float64Array([0,0,0,1,0,0,0,1,0,1,1,0]),gains:[1,1,1,1],emissions:[0,10,20,30],reasons:[]}});
test('a bilinear footprint retains calibrated darkness and checks every contributor',()=>{
 const {frame,camera,plane}=sample(),point=[.5,.5,0],policy={maximumSeparationMeters:2};
 const result=sampleEncounterFootprint(frame,camera,plane,point,policy);
 assert.equal(result.radiance,1);assert.equal(result.maximumEmissionDegrees,30);
 for(let i=0;i<4;i++){plane.accepted[i]=0;assert.equal(sampleEncounterFootprint(frame,camera,plane,point,policy).reason,'unqualified-source-pixel');plane.accepted[i]=1;}
 plane.xyz[11]=50;assert.equal(sampleEncounterFootprint(frame,camera,plane,point,policy).reason,'discontinuous-footprint');
});
test('detector edges never interpolate missing contributors',()=>{
 const {frame,plane}=sample();
 for(const p of [[-.1,.5,10],[1,.5,10],[.5,1,10]])assert.equal(sampleEncounterFootprint(frame,{project:()=>p},plane,[0,0,0],{maximumSeparationMeters:2}).reason,'outside-detector');
 assert.equal(sampleEncounterFootprint(frame,{project:()=>null},plane,[0,0,0],{}).reason,'behind-camera');
});
test('registration recomputes holdouts and cannot be approved by changing declared RMS',()=>{
 const camera={project:p=>[p[0],p[1],10],report:{nominalPixelScaleMeters:1}};
 const controls=Array.from({length:12},(_,i)=>({id:String(i),partition:i<6?'fit':'holdout',sourcePointMeters:[i,i%3,0],sourcePixel:[i,i%3]}));
 const r={method:'source-topography-feature-translation',sourceShapeSha256:'a'.repeat(64),controls,maximumRmsMeters:1,maximumResidualMeters:2,nominalPixelScaleMeters:1,limitations:'Image feature residuals; no absolute geodetic accuracy claim.'};
 assert.equal(validateEncounterRegistration(camera,r,r.sourceShapeSha256).holdout.rmsPixels,0);
 r.holdout={rmsPixels:0,maximumPixels:0};r.controls[11].sourcePixel[0]+=20;
 assert.throws(()=>validateEncounterRegistration(camera,r,r.sourceShapeSha256),/budget/);
 assert.throws(()=>validateEncounterRegistration(camera,r,'b'.repeat(64)),/source-bound/);
});
test('EPOXI north and east map to the documented detector axes',()=>{
 const h={GEOMSTAT:'OK',GEOMQUAL:'RECONSTRUCTED',DNAXIS1:'RIGHT, +Xinstr',DNAXIS2:'UP, -Yinstr',TARSCRX:-10,TARSCRY:0,TARSCRZ:0,TARSUNRX:100,TARSUNRY:0,TARSUNRZ:0,BORERA:0,BOREDEC:0,CELESTN:0,TARSCR:10,PXLSCALE:100,NAXIS1:8,NAXIS2:8};
 const c=encounterCamera(h,{bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[0,0],maximumOffsetPixels:0});
 const actual=c.project([0,100,200]);assert.ok(Math.abs(actual[0]-2.5)<1e-10);assert.ok(Math.abs(actual[1]-5.5)<1e-10);
 assert.equal(c.report.nominalPixelScaleMeters,100);
});
test('observed shadowed terrain remains eligible when the source camera can see it',async()=>{
 const {buildEncounterBackplane}=await import('./encounter-surface.mts');
 const frame={width:2,height:2,reason:()=>null};
 const camera={positionMeters:[0,0,10],sunDirection:[0,0,-1],project:()=>[.5,.5,10],ray:()=>[0,0,-1]};
 const mesh={positions:[[-1,-1,0],[1,-1,0],[0,1,0]],indices:[[0,1,2]],intersect:()=>({faceId:0,radius:10})};
 const recipe={photometry:{model:'observed',maximumGain:1},transfer:{maximumEmissionDegrees:75}};
 const plane=buildEncounterBackplane(frame,camera,mesh,recipe);
 assert.deepEqual([...plane.accepted],[1,1,1,1]);assert.equal(plane.report.acceptedPixels,4);
 mesh.faceProvenance=[1];
 assert.equal(buildEncounterBackplane(frame,camera,mesh,recipe).report.acceptedPixels,0);
});
