import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {sampleJointDepth} from './joint-depth.ts';
import type { ObservationMapping } from '@cssearth/bake/volume';
test('joint depth keeps its fixed identifier quantile in a uniform neutral source',()=>{
 const distance=1e12;
 const mapping:ObservationMapping={distanceUnits:distance,boundsUnits:{min:[-1,-1],max:[1,1]},tangentAtUv:(x,y)=>[x,y],uvAtTangent:(x,y)=>[x,y],pointAtDepth:(x,y,z)=>[x*(1+z/distance),y*(1+z/distance),z],tangentAtPoint:(x,y)=>[x,y],rayPathPerDepth:()=>1};
 const model={mapping,supportBounds:{min:[-1,-1,0] as [number,number,number],max:[1,1,2] as [number,number,number]},densityAt:()=>1,sampleEmission(_x:number,_y:number,_z:number,out:[number,number,number]){out.fill(1);}};
 const id='catalogue-star',q=(createHash('sha256').update(`cssearth-joint-star-depth@1:${id}`).digest().readUInt32BE(0)+.5)/2**32;
 assert.ok(Math.abs(sampleJointDepth(model,0,0,id)-2*q)<1e-9);
 assert.throws(()=>sampleJointDepth({...model,densityAt:()=>0},0,0,id),/No joint stellar/);
});
