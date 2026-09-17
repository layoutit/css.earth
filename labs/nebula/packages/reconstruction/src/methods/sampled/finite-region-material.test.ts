import {test} from 'node:test';import assert from 'node:assert/strict';
import {finiteRegionBasis,fitFiniteRegionMaterial} from './finite-region-material.ts';
test('compact XYZ regions preserve partition and distinguish overlapping near/far material; XY extrusion fails',()=>{
 const target=new Float32Array(42);for(let p=0;p<14;p++)target[3*p+(p<7?0:2)]=1;
 const fitted=fitFiniteRegionMaterial({width:14,height:1,target,covered:new Uint8Array(14).fill(1),origin:[0,0,0],spacing:[1,1,1],maximumRegions:32,iterations:50,regularization:.01,
 raySamples:p=>[{point:[p<7?-.25:.25,0,p<7?-2:2],contribution:.5}]});
 const check=(sample:typeof fitted.sampleMaterial)=>{const a:[number,number,number]=[0,0,0],b:[number,number,number]=[0,0,0];assert.ok(sample(0,0,-2,a));assert.ok(sample(0,0,2,b));assert.ok(a[0]>240&&a[2]<15);assert.ok(b[2]>240&&b[0]<15);};
 check(fitted.sampleMaterial);assert.throws(()=>check((_x,_y,_z,out)=>{out[0]=255;out[1]=out[2]=0;return true;}));
 for(let i=0;i<50;i++){const rgb:[number,number,number]=[0,0,0];fitted.sampleMaterial(i*.037-.5,.13,-2.2,rgb);assert.ok(rgb.every(v=>v>=0&&v<=255));}
 assert.equal(fitted.sampleMaterial(0,0,0,[0,0,0]),false);
 const basis=finiteRegionBasis([.2,.3,.4],[0,0,0],[1,1,1]);assert.ok(Math.abs(basis.reduce((s,b)=>s+b.weight,0)-1)<1e-12);assert.equal(basis.length,8);
 assert.ok(fitted.receipt.afterRmse<1e-7);assert.throws(()=>finiteRegionBasis([0,0,0],[0,0,0],[0,1,1]));
});
