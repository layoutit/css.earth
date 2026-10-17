import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test,{after} from 'node:test';
import {compileGalaxySliceVolume} from './galaxy-slice-compile.mts';
import {record} from './galaxy-slices.mts';
import {writeGalaxyGolden} from './galaxy-slice-golden.mts';
const directory=mkdtempSync(join(tmpdir(),'galaxy-compile-golden-'));
after(()=>rmSync(directory,{recursive:true,force:true}));
writeGalaxyGolden(directory);
const input:unknown=JSON.parse(readFileSync(directory+'/prototype.json','utf8'));
record(record(input).field).record='runs/b30-native-scatterFaceSide/fit-crisp.json';
const frame:unknown=JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way-volume/source/preparation/b30/frame.json',import.meta.url),'utf8'));
test('image-plane extension preserves accepted affine columns and the canonical CSS raster phase',()=>{
 const data=record(structuredClone(input)),dims=record(data.field).dims;
 assert.ok(Array.isArray(dims)&&Array.isArray(data.leaves));
 data.bakeControls={...record(data.bakeControls),inPlaneField:undefined};
 for(const value of data.leaves){const leaf=record(value),a='xyz'.indexOf(String(leaf.axis));leaf.width=dims[a===0?1:0];leaf.height=dims[a===2?1:2];leaf.imageBounds=undefined;leaf.canonicalCrop=undefined;}
 const base=compileGalaxySliceVolume(data,frame,directory,'milky-way-volume');
 data.bakeControls={...record(data.bakeControls),inPlaneField:'explicit-extended-input'};
 assert.ok(Array.isArray(data.leaves));
 for(const value of data.leaves){const leaf=record(value),a='xyz'.indexOf(String(leaf.axis)),h=a===0?1:0,v=a===2?1:2;
  const w=Number(leaf.width),height=Number(leaf.height),lo=base.frame.boundsUnits.min,hi=base.frame.boundsUnits.max;
  leaf.canonicalCrop=[4,6,w,height];leaf.width=w+8;leaf.height=height+12;
  leaf.imageBounds=[lo[h]!-(hi[h]!-lo[h]!)*4/w,hi[h]!+(hi[h]!-lo[h]!)*4/w,lo[v]!-(hi[v]!-lo[v]!)*6/height,hi[v]!+(hi[v]!-lo[v]!)*6/height];
 }
 const extended=compileGalaxySliceVolume(data,frame,directory,'milky-way-volume');
 assert.deepEqual(extended.frame,base.frame);
 for(const [i,stack]of extended.stacks.entries())for(const leaf of stack.leaves){
  const prior=base.stacks[i]!.leaves.find(l=>l.id===leaf.id)!;
  const before=prior.style.transform.slice(9,-1).split(',').map(Number),after=leaf.style.transform.slice(9,-1).split(',').map(Number);
  assert.deepEqual(before.slice(0,12),after.slice(0,12));assert.deepEqual(prior.centerUnits,leaf.centerUnits);
  for(let a=0;a<3;a++)assert.ok(Math.abs(after[12+a]!+after[a]!*2+after[4+a]!*3-before[12+a]!)<1e-6,'original pixel moved');
 }
 record(data.leaves[0]).canonicalCrop=[3,6,5,5];
 assert.throws(()=>compileGalaxySliceVolume(data,frame,directory,'milky-way-volume'),/raster phase/);
});
