import test from 'node:test';import assert from 'node:assert/strict';
import {makeRaster,type Sources} from '../inputs.mts';
import {volumeObject,planarBasis} from '../catalogue-volume.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
import {outsideCamera} from '../render.mts';import {projectCatalogue} from '../catalogue-render.mts';
import {scaleDust,colorContrast,checks,calibrationSupport} from './model.mts';import {EXTINCTION_RGB} from '../model.mts';
import {validateGrade,type Grade} from '../grade.mts';
function fixture():CatalogueScene{
 const empty=makeRaster(8,4);empty.mask.fill(1);const sources:Sources={warp:empty,dust:empty,gas:empty,young:[empty,empty,empty],youngCoverage:empty,youngFraction:0,oldColor:[1,1,1],metadata:{}};
 return{sources,objects:[volumeObject({id:'star',owner:'star',kind:'ball',component:3,center:[0,0,-.4],basis:planarBasis(0),axes:[.02,.02,.02],inner:0,color:[1,1,1],weight:1,source:'Finite light behind two unequal dust columns'})],dust:[],owners:[{id:'star',kind:'cluster',component:3,prior:1,maximum:1,measuredAge:false,logAge:null,aliases:[]}],colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,metadata:{},dustLayer:{column:empty,strength:1.2,retainMolecular:false,clouds:[.008,.024].map((w,i)=>volumeObject({id:'dust-'+i,owner:'dust',kind:'dust-tent',component:0,center:[0,0,.1+i*.2],basis:planarBasis(0),axes:[.15,.15,.15],inner:0,color:[1,1,1],weight:w,source:'Fixed finite dust fixture'}))}};
}
test('One global multiplier preserves every l25 dust field value and relative column contrast',()=>{
 const scene=fixture(),before=structuredClone(scene.dustLayer),clouds=scene.dustLayer!.clouds,columns=clouds!.map(v=>v.weight/v.axes[0]**2);assert.equal(scaleDust(scene,1.2,.2),.24);assert.deepEqual(scene.dustLayer!.clouds,before!.clouds);assert.deepEqual(scene.dustLayer!.column,before!.column);assert.equal(clouds![1].weight/clouds![0].weight,3);assert.deepEqual(clouds!.map(v=>v.weight/v.axes[0]**2),columns);
 scaleDust(scene,1.2,.2);assert.equal(scene.dustLayer!.strength,.24);scaleDust(scene,1.2,1);assert.deepEqual(scene.dustLayer,before);
 for(const value of [0,-1,1.01,NaN])assert.throws(()=>scaleDust(scene,1.2,value));
 scene.dustLayer!.cloudExtinctionRgb=Float32Array.of(.5,1,1);assert.throws(()=>scaleDust(scene,1.2,.2),/without clump/u);
});
test('Uniform scaling reaches actual photons, retains Gordon reddening and restores the exact parent',()=>{
 const scene=fixture(),camera=outsideCamera(0,32,1),render=()=>projectCatalogue(scene,camera,.03).objects[0].rgb,old=render();scaleDust(scene,1.2,.2);const lighter=render();scaleDust(scene,1.2,.01);const nearlyClear=render(),sum=(v:Float64Array,c:number)=>v.reduce((s,x,i)=>s+(i%3===c?x:0),0);
 assert.ok(sum(lighter,1)>sum(old,1)*1.1);assert.ok(sum(nearlyClear,1)>sum(lighter,1));assert.ok(sum(old,0)/sum(old,2)>sum(lighter,0)/sum(lighter,2));assert.ok(sum(lighter,0)/sum(lighter,2)>sum(nearlyClear,0)/sum(nearlyClear,2));
 const greenTau=-Math.log(sum(old,1)/sum(nearlyClear,1));for(let c=0;c<3;c++){const tau=-Math.log(sum(old,c)/sum(nearlyClear,c)),other=-Math.log(sum(lighter,c)/sum(nearlyClear,c));assert.ok(Math.abs(tau/other-(1-.01)/(.2-.01))<.001);assert.ok(Math.abs(tau/greenTau-EXTINCTION_RGB[c])<.005);}
 scaleDust(scene,1.2,1);assert.deepEqual(render(),old);
});
test('The owner color metric is the lane R/B ratio relative to adjacent bar light',()=>{
 assert.ok(Math.abs(colorContrast({rg:1.2,bg:.8})-1.5)<1e-12);
 const photo={depth:.056,rg:1.05,bg:.9,bar:{rg:1,bg:1}},good={...photo,depth:.06,rg:1.08};assert.deepEqual(checks(good,photo,.202,.201),{dimming:true,colorContrast:true,overlap:true,barColor:true});
 assert.equal(checks({...good,rg:1.4},photo,.202,.201).colorContrast,false);assert.equal(checks(good,photo,.2009,.201).overlap,false);assert.equal(checks({...good,depth:.09},photo,.202,.201).dimming,false);
});
test('Coarse calibration renders fractional boundary support used by the lane statistic',()=>{assert.deepEqual(calibrationSupport(Float64Array.of(0,.25,1,0),Uint8Array.of(1,0,1,0)),Uint8Array.of(1,1,1,0));});
test('The grade record can report the actual positive scaled optical strength',()=>{const g:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustStrength:.012,dustTint:[1,1,1],stretch:0,saturation:1,score:0};assert.doesNotThrow(()=>validateGrade(g));assert.throws(()=>validateGrade({...g,dustStrength:0}));});
