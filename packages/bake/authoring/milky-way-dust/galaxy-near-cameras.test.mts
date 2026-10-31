import test from 'node:test';import assert from 'node:assert/strict';
import {galaxyNearCamera,galaxyNearStations} from './galaxy-near-cameras.mts';
test('near stations preserve pixel rays and physical scale across galaxy sizes',()=>{for(const{camera:c}of galaxyNearStations(128,10)){assert.ok(c.pixelOf([0,0,0])!.every(v=>Math.abs(v-64)<1e-10));assert.ok(Math.abs(c.areaAt([0,0,0])-(10/128)**2)<1e-12);const r=c.ray(20.5,70.5),p=r.origin.map((v,i)=>v+r.direction[i]!*15);assert.ok(Math.abs(c.pixelOf([p[0]!,p[1]!,p[2]!])![0]-20.5)<1e-10);}assert.equal(galaxyNearCamera(0,0,128,16).distance,24);});
