import {test} from 'node:test';import assert from 'node:assert/strict';import {patchAxisWeight,partitionAlpha,quantizedPatchAlpha} from './windows.mts';
import {cloudCells,cellBox,referenceProjection,derivePatchFromDensity} from './patches.mts';
test('overlapping smooth windows conserve endpoint transmission across the full image',()=>{
 for(const n of [2,3])for(let i=0;i<=400;i++){const weights=Array.from({length:n},(_,k)=>patchAxisWeight(i/400,k,n));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);for(const a of [0,.01,.4,.99,1]){const transmitted=weights.reduce((v,w)=>v*(1-partitionAlpha(a,w)),1);assert.ok(Math.abs(transmitted-(1-a))<1e-12);}}
 assert.equal(partitionAlpha(1,0),0);const h=1e-6;assert.ok(patchAxisWeight(1/6+h,1,3)/h<1e-4,'support enters with zero slope rather than a crop edge');
});
test('emitting-material centers follow the supplied spatial weights and keep their projected ray',()=>{
 const cell=cloudCells()[4]!,projection=referenceProjection(cell,[0,0,-18]),bounds={u0:1/3,v0:1/3,u1:2/3,v1:2/3},weighted=derivePatchFromDensity(()=>1,cellBox(cell),projection,bounds,{centerMode:'weighted',weightAtUv:u=>u>.5?1:0});assert.ok(weighted);assert.ok(weighted.sourceCenterUv[0]>.5);assert.equal(derivePatchFromDensity(()=>1,cellBox(cell),projection,bounds,{centerMode:'weighted',weightAtUv:()=>0}),null);
 const ray=projection.displayRay(...weighted.sourceCenterUv),delta=weighted.position.map((v,i)=>v-ray.eye[i]!);const norm=Math.hypot(...delta);assert.ok(delta.reduce((sum,v,i)=>sum+v/norm*ray.direction[i]!,0)>1-1e-12);
});

test('joint 8bit allocation preserves faint and opaque endpoint opacity',()=>{
 for(const n of [2,3])for(let k=0;k<=40;k++)for(const a of [0,1/255,5/255,.4,.99,1]){const u=k/40,v=(40-k)/40;let transmitted=1;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const b=quantizedPatchAlpha(a,u,v,x,y,n);assert.ok(Number.isInteger(b)&&b>=0&&b<=255);transmitted*=1-b/255;if(patchAxisWeight(u,x,n)*patchAxisWeight(v,y,n)===0)assert.equal(b,0);}assert.ok(Math.abs(1-transmitted-a)<=.5/255+1e-12);}
});
