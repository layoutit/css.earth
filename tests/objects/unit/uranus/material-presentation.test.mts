import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

test('the retained material resolves the observed oblate limb without expanding its top',async()=>{
 for(const[density,boundaryX]of[[1,28],[2,56]] as const){
  const filename=`uranus-fixed-material-normal${density===2?'@2x':''}.webp`;
  const{data,info}=await sharp(fileURLToPath(new URL(`../../../../public/scenes/uranus/${filename}`,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const centerX=256*density,centerY=256*density,boundaryY=29*density;
  assert.equal(data[(centerY*info.width+boundaryX-1)*4+3],0);
  assert.equal(data[(centerY*info.width+boundaryX)*4+3],255);
  assert.equal(data[((boundaryY-1)*info.width+centerX)*4+3],0);
  assert.ok(data[(boundaryY*info.width+centerX)*4+3]>=200);
 }
});
