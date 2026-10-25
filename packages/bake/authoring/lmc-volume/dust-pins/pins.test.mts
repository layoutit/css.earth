import test from 'node:test';import assert from 'node:assert/strict';
import {PINS,calibrationMask,excludedCore,measure,quantized} from './measure.mts';import {compare,applyDust,coefficients} from './model.mts';
import {makeRaster,type Sources} from '../inputs.mts';import type {CatalogueScene} from '../catalogue-scene.mts';import {volumeObject,planarBasis} from '../catalogue-volume.mts';import {projectCatalogue} from '../catalogue-render.mts';import {outsideCamera} from '../render.mts';
test('Exactly H5 and F4 carry weight on the owner Earth pixel grid; G5 and the core do not',()=>{
 const mask=calibrationMask();assert.equal(mask.reduce((a,b)=>a+b,0),338);assert.equal(mask[229*512+331],1);assert.equal(mask[184*512+226],1);assert.equal(PINS[1].calibrate,false);assert.ok(excludedCore(280,214));
 for(let y=0;y<384;y++)for(let x=0;x<512;x++)if(excludedCore(x,y))assert.equal(mask[y*512+x],0);
});
test('Changing excluded core pixels and G5 cannot change the default calibration objective',()=>{
 const rgb=new Float64Array(512*384*3).fill(.6),photo=rgb.slice();for(const p of [PINS[0],PINS[2]])for(let y=p.y-2;y<=p.y+2;y++)for(let x=p.x-2;x<=p.x+2;x++){rgb[(y*512+x)*3]=.65;rgb[(y*512+x)*3+2]=.5;}
 const before=compare(measure(rgb),measure(photo));for(let y=0;y<384;y++)for(let x=0;x<512;x++)if(excludedCore(x,y))for(let c=0;c<3;c++)photo[(y*512+x)*3+c]=c===1?.95:.1;
 assert.deepEqual(compare(measure(rgb),measure(photo)),before);assert.deepEqual(before.errors.map(v=>v.pin),['H5','F4']);assert.equal(compare(measure(rgb),measure(rgb)).score,0);assert.ok(before.score>0);assert.deepEqual(Array.from(quantized(Float64Array.of(.5))),[128/255]);
});
test('Local pin contrast uses the stated central sample and nearby annulus',()=>{
 const rgb=new Float64Array(512*384*3).fill(.8);for(const p of [PINS[0],PINS[2]])for(let y=p.y-2;y<=p.y+2;y++)for(let x=p.x-2;x<=p.x+2;x++){rgb[(y*512+x)*3]=.7;rgb[(y*512+x)*3+1]=.6;rgb[(y*512+x)*3+2]=.5;}
 for(const m of measure(rgb).filter(p=>p.calibrated)){assert.equal(m.lane.pixels,25);assert.equal(m.bar.pixels,144);assert.ok(Math.abs(m.lane.rg-7/6)<1e-12);assert.equal(m.lane.rb,1.4);assert.ok(m.contrast>.4&&m.colorContrast>1.3);}
});
function fixture():CatalogueScene{
 const zero=makeRaster(8,4),column=makeRaster(8,4);zero.mask.fill(1);column.mask.fill(1);column.values.fill(.15);const sources:Sources={warp:zero,dust:zero,gas:zero,young:[zero,zero,zero],youngCoverage:zero,youngFraction:0,oldColor:[1,1,1],metadata:{}};
 return{sources,objects:[volumeObject({id:'light',owner:'light',kind:'ball',component:3,center:[0,0,-.3],basis:planarBasis(0),axes:[.08,.08,.08],inner:0,color:[1,1,1],weight:1,source:'Finite light behind dust'})],dust:[],owners:[{id:'light',kind:'cluster',component:3,prior:1,maximum:1,measuredAge:false,logAge:null,aliases:[]}],colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,metadata:{},dustLayer:{column,strength:1.2,retainMolecular:false,clouds:[volumeObject({id:'dust',owner:'dust',kind:'dust-tent',component:0,center:[0,0,.2],basis:planarBasis(0),axes:[.2,.2,.2],inner:0,color:[1,1,1],weight:.02,source:'Fixed native finite dust'})]}};
}
test('Global reddening changes smooth and finite photons without changing dust geometry or its green opacity',()=>{
 const scene=fixture(),before=structuredClone(scene.dustLayer),camera=outsideCamera(0,24,2),original=projectCatalogue(scene,camera,.03);applyDust(scene,1,1);assert.deepEqual(projectCatalogue(scene,camera,.03),original);
 applyDust(scene,.6,1);const neutral=projectCatalogue(scene,camera,.03);applyDust(scene,.6,2);const red=projectCatalogue(scene,camera,.03),sum=(v:Float64Array,c:number)=>v.reduce((s,x,i)=>s+(i%3===c?x:0),0);
 for(const [a,b]of [[neutral.smooth.planes[0],red.smooth.planes[0]],[neutral.objects[0].rgb,red.objects[0].rgb]]){assert.equal(sum(a,1),sum(b,1));assert.ok(sum(b,0)>sum(a,0));assert.ok(sum(b,2)<sum(a,2));}
 assert.deepEqual(scene.dustLayer!.clouds,before!.clouds);assert.deepEqual(scene.dustLayer!.column,before!.column);assert.deepEqual(coefficients(2),[.5,1,1+2*(1.2932551319648093-1)]);assert.throws(()=>applyDust(scene,.01,2));assert.throws(()=>coefficients(4));
});
test('The reddening grade reaches native-cloud attenuation and the diffuse fallback separately',()=>{
 for(const kind of ['native','diffuse']){const scene=fixture();if(kind==='native')scene.dustLayer!.column.values.fill(0);else scene.dustLayer!.clouds=[];const camera=outsideCamera(0,24,2);applyDust(scene,.6,1);const a=projectCatalogue(scene,camera,.03);applyDust(scene,.6,2);const b=projectCatalogue(scene,camera,.03),sum=(v:Float64Array,c:number)=>v.reduce((s,x,i)=>s+(i%3===c?x:0),0);for(const [x,y]of [[a.smooth.planes[0],b.smooth.planes[0]],[a.objects[0].rgb,b.objects[0].rgb]]){assert.ok(sum(y,0)>sum(x,0),kind+' must redden its red photons');assert.ok(sum(y,2)<sum(x,2),kind+' must redden its blue photons');assert.equal(sum(y,1),sum(x,1));}}
});
