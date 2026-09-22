import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {readFile}from'node:fs/promises';
import {writeMaterialAtlasTile}from'./materials.mts';
test('material row gutters copy the source frame edge exactly',()=>{
 const source=Buffer.from([1,2,3,255,4,5,6,128,7,8,9,64,10,11,12,0]),output=Buffer.alloc(4*4*4);
 writeMaterialAtlasTile({output,outputWidth:4,source,sourceSize:2,frameX:1,frameY:1,gutter:1});
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){const sourceX=Math.max(0,Math.min(1,x-1)),sourceY=Math.max(0,Math.min(1,y-1)),offset=(sourceY*2+sourceX)*4;assert.deepEqual(output.subarray((y*4+x)*4,(y*4+x)*4+4),source.subarray(offset,offset+4));}
});
