import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareOpaquePolarDiscs} from './opaque-polar-discs.mjs';
const scene={body:{assets:{poles:{width:8,height:8}},bands:[{latitudeIndex:15,leaves:[{
  leafWidth:8,leafHeight:8,sourceRect:{x:0,y:0,width:8,height:8},
  style:'transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-4,-4,5,1)',
}]}]}};
const encode=data=>sharp(data,{raw:{width:8,height:8,channels:4}}).png().toBuffer();
test('opaque support is derived deterministically from retained geometry and actual source alpha',async()=>{
  const data=Buffer.alloc(8*8*4,255),bytes=await encode(data);
  const a=await prepareOpaquePolarDiscs(scene,bytes),b=await prepareOpaquePolarDiscs(scene,bytes);
  assert.deepEqual(a,b);assert.deepEqual(a.discs,[{center:[0,0,5],normal:[0,0,1],radius:2}]);
  data[(3*8+3)*4+3]=0;
  const hole=await prepareOpaquePolarDiscs(scene,await encode(data));
  assert.deepEqual(hole.discs,[],'An unproven centre cannot occlude imagery');
  assert.notEqual(hole.receipt.sourceSha256,a.receipt.sourceSha256);
});

test('opaque support rejects non-affine or collapsed retained faces',async()=>{
  const bytes=await encode(Buffer.alloc(8*8*4,255));
  for(const style of ['matrix3d(1,0,0,0,0,1,0,0,0,0,1,1,-4,-4,5,1)',
    'matrix3d(0,0,0,0,0,0,0,0,0,0,1,0,-4,-4,5,1)']){
    const invalid=structuredClone(scene);invalid.body.bands[0].leaves[0].style=style;
    await assert.rejects(()=>prepareOpaquePolarDiscs(invalid,bytes),/Opaque polar support requires/);
  }
});
