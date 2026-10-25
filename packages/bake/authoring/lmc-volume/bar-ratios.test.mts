import test from 'node:test';import assert from 'node:assert/strict';
import {ratios,colorPass,rmsPass,displayRgb,fitBarRatios,barAperture} from './bar-ratios.mts';
import {gradedPrediction,type Grade} from './grade.mts';
import {loadObservation} from './observation.mts';
import {measuredBar} from './bar-geometry.mts';
import {BAR_SIGMA_Z} from './depth-model.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
import type {CatalogueRow} from './catalogue-data.mts';
import {projectCatalogue} from './catalogue-render.mts';
import {outsideCamera} from './render.mts';
import {makeRaster} from './inputs.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
test('bar colors use ratios of summed channels and disregard excluded blue contamination',()=>{
 const rgb=Float64Array.from([.8,.4,.2,.2,.1,.05,0,.1,10]),mask=Uint8Array.from([1,1,0]),p=ratios(rgb,mask);assert.equal(p.rg,2);assert.equal(p.bg,.5);assert.equal(p.pixels,2);assert.ok(colorPass({...p,rg:2.03,bg:.505},p));assert.ok(!colorPass({...p,rg:2.05},p));
 assert.ok(rmsPass([.242*1.005,.304*1.005],[.242,.304]));assert.ok(!rmsPass([.242*1.011,.304],[.242,.304]));
});
test('gas and cluster catalogue footprints are excluded from a fixed geometric bar aperture',async()=>{
 const o=await loadObservation(1),bar=measuredBar(BAR_SIGMA_Z),[ra,dec]=skyOf(bodyToIcrs(bar.center)),row:CatalogueRow={id:'test',kind:'nebula',ra,dec,majorArcmin:30,minorArcmin:15,pa:121.26,logAge:null,aliases:[],ageStatus:'',weight:1,source:'test',notes:''},plain=barAperture(o,bar,[]),gas=barAperture(o,bar,[row]),cluster=barAperture(o,bar,[{...row,kind:'cluster'}]);assert.ok(gas.pixels<plain.pixels);assert.deepEqual(gas.mask,cluster.mask);assert.ok(gas.mask.every((v,i)=>!v||plain.mask[i]&&!gas.excluded[i]));
});
test('bar-ratio fitting recovers a yellow grade while freezing other populations and the tone curve',()=>{
 const basis={width:8,height:8,dustGain:1,planes:Array.from({length:5},()=>new Float64Array(64*3))};basis.planes[1].fill(.15);basis.planes[0].fill(.02);const grade:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],stretch:2,saturation:1.5,dustStrength:1,dustTint:[1,1,1],score:0},truth=structuredClone(grade);truth.coefficients[1]=[1.2,1.1,.7];const data=gradedPrediction(basis,truth),mask=new Uint8Array(64).fill(1),aperture={mask,bar:mask,excluded:new Uint8Array(64),pixels:64,barPixels:64},photo=ratios(displayRgb(data,[.01,.01,.01]),mask),target={data,train:mask,holdout:mask},fit=fitBarRatios(basis,grade,target,aperture,photo,[.01,.01,.01],gradedPrediction(basis,grade));assert.ok(fit.diagnostics.colorPassed);assert.ok(fit.diagnostics.rmsPassed);assert.ok(fit.grade.coefficients[1][2]<fit.grade.coefficients[1][0]);for(const k of [0,2,3])assert.deepEqual(fit.grade.coefficients[k],grade.coefficients[k]);assert.equal(fit.grade.stretch,grade.stretch);assert.equal(fit.grade.saturation,grade.saturation);assert.deepEqual(grade.coefficients[1],[1,1,1]);
});
test('an inner-disc population color reaches only that partition and never recolors the outskirts',()=>{
 const z=makeRaster(4,20);z.mask.fill(1);const scene:CatalogueScene={objects:[],dust:[],owners:[],sources:{warp:z,dust:z,gas:z,young:[z,z,z],youngCoverage:z,youngFraction:0,oldColor:[1,1,1],metadata:{}},colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,separateOutskirts:true,outskirtsTransitionKpc:[3,5],metadata:{}},camera=outsideCamera(0,8),before=projectCatalogue(scene,camera,.12);scene.innerDiscColor=[1.2,1,.8];const after=projectCatalogue(scene,camera,.12);assert.ok(after.smooth.planes[0].some((v,i)=>Math.abs(v-before.smooth.planes[0][i])>1e-8));for(const k of [1,2,3,4])assert.deepEqual(after.smooth.planes[k],before.smooth.planes[k]);
});
