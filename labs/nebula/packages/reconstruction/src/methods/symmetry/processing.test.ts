import assert from 'node:assert/strict';
import test from 'node:test';
import {applyIsophoteMasks,emissionInputChannels,emissionRasterPixels,createInferredEmissionSampler} from './processing.ts';
test('a mask inside a galaxy takes the median light of its isophote, and never adds light',()=>{
 // A 21 px round galaxy whose light falls off from the centre, with a bright neighbour at x = 15.
 const width=21,height=21,pixels=Buffer.alloc(width*height*3);
 const light=(x:number,y:number)=>Math.max(0,200-12*Math.round(Math.hypot(x-10,y-10)));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.fill(light(x,y)+(Math.hypot(x-15,y-10)<2?50:0),(y*width+x)*3,(y*width+x)*3+3);
 const before=Buffer.from(pixels);
 applyIsophoteMasks(pixels,width,height,[{x:15,y:10,radius:3}],{centre:[10,10],minorAxis:[1,0],axisRatio:1});
 assert.equal(pixels[(10*width+15)*3],light(15,10));
 assert.ok(pixels.every((value,index)=>value<=before[index]!));
 assert.equal(pixels[(10*width+5)*3],before[(10*width+5)*3]);
 assert.throws(()=>applyIsophoteMasks(pixels,width,height,[],{centre:[10,10],minorAxis:[0,0],axisRatio:1}),/Isophote masks/);
});
test('emission processing preserves channel order, black subtraction and voxel-centre normalization',()=>{
 const channels=emissionInputChannels(Uint8Array.from([255,128,0]),1,0);
 assert.deepEqual(Array.from(emissionRasterPixels(channels,1)),[255,128,0]);
 // A black level per channel: each channel loses its own sky.
 assert.deepEqual(Array.from(emissionRasterPixels(emissionInputChannels(Uint8Array.from([255,51,51]),1,[0,.2,.1]),1)),[255,0,28]);
 const sample=createInferredEmissionSampler([Float32Array.of(1),Float32Array.of(2),Float32Array.of(3)],{width:1,height:1,depth:1},{min:[-1,-1,-1],max:[1,1,1]},2);
 const out:[number,number,number]=[0,0,0];sample(0,0,0,out);assert.deepEqual(out,[.5,1,1.5]);sample(10,10,10,out);assert.deepEqual(out,[0,0,0]);
});
