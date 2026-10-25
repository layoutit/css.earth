import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUE_SMOOTHING_KPC,youngAssociation,blueBases,fitBlueStructure,applyBlueGains} from './blue-structure.mts';
import {densityFromMembers} from './gaia-density.mts';
import {loadParent} from './sequence-state.mts';
import {makeRaster,type Sources} from './inputs.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
import {gradedPrediction,type Grade} from './grade.mts';
import {catalogueBasis,type CatalogueProjection} from './catalogue-render.mts';
test('100 pc Gaia smoothing strengthens native spatial structure without changing the count budget',()=>{
 const map=makeRaster(4,20);map.mask.fill(1);const sources:Sources={warp:map,dust:map,gas:map,young:[map,map,map],youngCoverage:map,youngFraction:0,oldColor:[1,1,1],metadata:{}},[ra,dec]=skyOf(bodyToIcrs([1,1,0])),stars=[{ra,dec}],fine=densityFromMembers(stars,sources,512,10,undefined,BLUE_SMOOTHING_KPC),coarse=densityFromMembers(stars,sources,512,10,undefined,.2),cell=20/512;
 assert.ok(Math.abs(fine.values.reduce((a,b)=>a+b,0)*cell*cell-1)<1e-6);let f=0,c=0;for(let i=0;i<fine.values.length;i++){f=Math.max(f,fine.values[i]);c=Math.max(c,coarse.values[i]);}assert.ok(f/c>3.5&&f/c<4.1);assert.equal(BLUE_SMOOTHING_KPC,.1);
});
test('two blue gains preserve every shape, other population, age color and display setting',async()=>{
 const {scene}=await loadParent(15);scene.youngTint=[1.2,1.1,1];const owners=scene.owners,gaia=owners.findIndex(o=>o.id===scene.youngOwner),association=owners.findIndex(youngAssociation),other=owners.findIndex(o=>o.component===4);assert.ok(gaia>=0&&association>=0&&other>=0);const n=64*3,p:CatalogueProjection={smooth:{width:8,height:8,dustGain:1,planes:Array.from({length:5},()=>new Float64Array(n))},objects:[gaia,association,other].map((owner,k)=>({owner,indices:Int32Array.from({length:64},(_,i)=>i),rgb:Float64Array.from({length:n},(_,i)=>.03*(1+i%3)*(k===0?(Math.floor(i/3)%8<4?1:.1):k===1?(Math.floor(i/3)%8>=4?1:.1):.2))})),metadata:{}};
 const initial=new Float64Array(owners.length).fill(1),grade:Grade={coefficients:[[1,1,1],[1,1,1],[.8,1,1.3],[1.3,1,1]],stretch:2,saturation:1.4,dustStrength:1,dustTint:[1,1,1],score:0},savedGrade=structuredClone(grade),geometry=JSON.stringify([scene.objects,scene.dust,scene.colors]),truth=initial.slice(),truthScene={...scene,youngTint:[...scene.youngTint] as [number,number,number]};applyBlueGains(truthScene,truth,[1.3,1.6]);const target={data:gradedPrediction(catalogueBasis(p,truthScene,truth),grade),train:new Uint8Array(64).fill(1),holdout:new Uint8Array(64)},fit=fitBlueStructure(blueBases(p,scene,initial),grade,target);assert.ok(fit.diagnostics.after<fit.diagnostics.before*.01);assert.ok(Math.abs(fit.gains[0]-1.3)<.06);assert.ok(Math.abs(fit.gains[1]-1.6)<.06);
 applyBlueGains(scene,initial,fit.gains);const replay=gradedPrediction(catalogueBasis(p,scene,initial),grade);assert.ok(replay.every((v,i)=>Math.abs(v-fit.prediction[i])<1e-12));for(let i=0;i<owners.length;i++)assert.equal(initial[i],youngAssociation(owners[i])?fit.gains[1]:1);assert.equal(JSON.stringify([scene.objects,scene.dust,scene.colors]),geometry);assert.deepEqual(grade,savedGrade);assert.ok(owners.filter(youngAssociation).length>2000);
});
