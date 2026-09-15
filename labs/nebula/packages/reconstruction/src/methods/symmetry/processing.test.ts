import assert from 'node:assert/strict';
import test from 'node:test';
import {emissionInputChannels,emissionRasterPixels,createInferredEmissionSampler} from './processing.ts';
test('emission processing preserves channel order, black subtraction and voxel-centre normalization',()=>{
 const channels=emissionInputChannels(Uint8Array.from([255,128,0]),1,0);
 assert.deepEqual(Array.from(emissionRasterPixels(channels,1)),[255,128,0]);
 const sample=createInferredEmissionSampler([Float32Array.of(1),Float32Array.of(2),Float32Array.of(3)],{width:1,height:1,depth:1},{min:[-1,-1,-1],max:[1,1,1]},2);
 const out:[number,number,number]=[0,0,0];sample(0,0,0,out);assert.deepEqual(out,[.5,1,1.5]);sample(10,10,10,out);assert.deepEqual(out,[0,0,0]);
});
