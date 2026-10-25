import test from 'node:test';import assert from 'node:assert/strict';
import {denseGate,lowerBound,selectedFraction} from './geometry.mts';
import {fractionAtHeight,inferHeight,DUST_SIGMA} from '../dust-geometry/depth.mts';
import {decode} from './measure.mts';import {encodeDisplay} from '../bar-ratios.mts';
import {makeRaster,type Sources} from '../inputs.mts';import {volumeObject,planarBasis} from '../catalogue-volume.mts';
import {outsideCamera} from '../render.mts';import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';import type {CatalogueScene} from '../catalogue-scene.mts';
import {escapeRatio,cloudCoefficients,applyOpacity,nativeCloudColumns} from './opacity.mts';
test('The accepted l25 fraction is the default and low-column bar light is untouched',()=>{
 for(const av of [.02,.1,.2,1,5])assert.equal(selectedFraction(.7,av,1,0),.7);
 assert.equal(denseGate(.1),0);assert.equal(denseGate(1),1);assert.equal(selectedFraction(.7,.1,.05,0),.7);
});
test('Dense foreground selection brightens lanes by moving dust behind more stars, without erasing its column',()=>{
 const fraction=selectedFraction(.7,1,.2,0);assert.ok(Math.abs(fraction-.14)<1e-12);
 const before=inferHeight(.7,1),after=inferHeight(fraction,1);assert.ok(after.height<before.height);
 assert.ok(Math.abs(fractionAtHeight(after.height)-fraction)<1e-8);assert.equal(DUST_SIGMA,.25);
 assert.equal(selectedFraction(.02,10,.05,0),.02);assert.throws(()=>selectedFraction(.7,1,0,0));
});
test('The complete-aperture RC distribution limits the foreground reduction',()=>{
 const derivative=.8,spread=.12,bound=lowerBound(derivative,spread),fraction=selectedFraction(.7,1,.05,bound);
 assert.ok(Math.abs(bound-.85)<1e-12);assert.ok(Math.abs(fraction-.7*.85)<1e-12);
 assert.ok((1-bound)*derivative<=spread+1e-12);assert.equal(lowerBound(.05,.1),0);
});
test('Lane-depth measurements decode displayed light before taking attenuation ratios',()=>{
 for(const v of [.01,.1,.3,.8])assert.ok(Math.abs(decode(encodeDisplay(v))-v)<1e-12);
 const clear=encodeDisplay(.5),lane=encodeDisplay(.4);assert.ok(Math.abs((1-decode(lane)/decode(clear))-.2)<1e-12);
});
test('Poisson attenuation retains mean dust mass and approaches the Gordon law for thin clumps',()=>{
 assert.equal(escapeRatio(0),1);assert.ok(Math.abs(escapeRatio(1)-(1-Math.exp(-1)))<1e-12);
 const thin=cloudCoefficients(Float64Array.of(.01),0),thick=cloudCoefficients(Float64Array.of(3),6);assert.equal(thin[0],.75);assert.equal(thin[1],1);assert.ok(thick[1]<.1);assert.ok(thick[2]/thick[1]<thin[2]/thin[1]);
 const tauMean=2,tauClump=1;assert.ok(Math.abs(Math.exp(-tauMean*escapeRatio(tauClump))-Math.exp(-2*(1-Math.exp(-1))))<1e-12);
});
test('A bar-only calibration reproduces unmasked photons exactly, including extended objects and Gaia grain',()=>{
 const empty=makeRaster(8,4),light=makeRaster(8,4);empty.mask.fill(1);light.mask.fill(1);light.values.fill(.4);
 const sources:Sources={warp:empty,dust:empty,gas:empty,young:[empty,empty,empty],youngCoverage:empty,youngFraction:0,oldColor:[1,1,1],metadata:{}},scene:CatalogueScene={sources,objects:[volumeObject({id:'region',owner:'region',kind:'ball',component:3,center:[0,0,0],basis:planarBasis(0),axes:[.7,.5,.2],inner:0,color:[.5,.7,1],weight:1,source:'Extended finite source fixture'})],dust:[],owners:[{id:'region',kind:'cluster',component:3,prior:1,maximum:1,measuredAge:false,logAge:null,aliases:[]}],colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,metadata:{},dustLayer:{column:empty,strength:1.2,retainMolecular:false,clouds:[volumeObject({id:'dust',owner:'dust',kind:'dust-tent',component:0,center:[0,0,.2],basis:planarBasis(0),axes:[.4,.4,.4],inner:0,color:[1,1,1],weight:.2,source:'Finite dust fixture'})]},oldPopulation:{disc:light,bar:light,points:{count:2,positions:Float64Array.from([.1,.1,-.1,-.2,.1,.3]),rgb:Float32Array.from([1,.8,.6,.6,.8,1]),components:Uint8Array.from([0,1])},oldFraction:.3,youngFraction:.02}};
 const camera=outsideCamera(0,24,2),mask=Uint8Array.from({length:24*24},(_,i)=>Number(i%3===0||i%5===0)),full=catalogueBasis(projectCatalogue(scene,camera,.06),scene,Float64Array.of(1)),selected=catalogueBasis(projectCatalogue(scene,camera,.06,mask),scene,Float64Array.of(1));
 for(let k=0;k<5;k++)for(let i=0;i<mask.length;i++)for(let c=0;c<3;c++)assert.equal(selected.planes[k][i*3+c],mask[i]?full.planes[k][i*3+c]:0);
 const oldWeight=scene.dustLayer!.clouds![0].weight;applyOpacity(scene,Float64Array.of(3),8);const porous=catalogueBasis(projectCatalogue(scene,camera,.06),scene,Float64Array.of(1)),sum=(v:Float64Array)=>v.reduce((s,x,i)=>s+(i%3===1?x:0),0);assert.ok(sum(porous.planes[3])>sum(full.planes[3])*1.1);assert.equal(scene.dustLayer!.clouds![0].weight,oldWeight);applyOpacity(scene,Float64Array.of(3),0);const restored=catalogueBasis(projectCatalogue(scene,camera,.06),scene,Float64Array.of(1));assert.deepEqual(restored.planes,full.planes);
 assert.throws(()=>projectCatalogue(scene,camera,.06,new Uint8Array(2)),/wrong dimensions/u);
 const native=scene.dustLayer!.clouds![0];scene.dustLayer!.clouds=[.1,.2,.4,.2,.1].map((w,i)=>({...native,id:'depth-'+i,weight:w*native.weight}));const columns=nativeCloudColumns(scene),total=native.weight/native.axes[0]**2;for(const tau of columns)assert.ok(Math.abs(tau-total)<1e-12);const coefficients=cloudCoefficients(columns,4);for(let i=1;i<5;i++)assert.deepEqual(coefficients.slice(i*3,i*3+3),coefficients.slice(0,3));
});
