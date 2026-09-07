import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { extractExtendedSource } from './extraction.ts';

test('morphology support rejects isolated field points and retains connected extended emission',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nebula-extraction-')),input=join(root,'source.png'),width=72,height=64,rgb=Buffer.alloc(width*height*3,8);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const d=Math.hypot((x-36)/22,(y-33)/15),glow=Math.max(0,Math.round(95*(1-d)));for(let c=0;c<3;c++)rgb[3*(y*width+x)+c]=8+glow;}
  for(let y=25;y<36;y++)for(let x=39;x<50;x++){const i=3*(y*width+x);rgb[i]=150;rgb[i+1]=45;rgb[i+2]=55;}
  for(const [x,y] of [[3,3],[67,5],[4,59],[68,58]]){const i=3*(y*width+x);rgb[i]=rgb[i+1]=rgb[i+2]=255;}
  await sharp(rgb,{raw:{width,height,channels:3}}).png().toFile(input);
  const receipt=await extractExtendedSource({inputPath:input,outputDirectory:root,id:'fixture',maxPixels:72,medianSize:5,supportPixels:64,thresholdSigma:2.5,bridgeFraction:.025,softEdgeFraction:.02});
  const mask=await sharp(join(root,receipt.outputs.mask)).raw().toBuffer({resolveWithObject:true}),cutout=await sharp(join(root,receipt.outputs.cutout)).raw().ensureAlpha().toBuffer();
  const maskAt=(x:number,y:number)=>mask.data[mask.info.channels*(y*width+x)];
  assert(maskAt(36,33)>100,'main diffuse body is admitted');
  assert(maskAt(44,30)>100,'extended emission knot is retained');
  const center=4*(33*width+36),compositedGray=cutout[center]*cutout[center+3]/255;
  assert(Math.abs(compositedGray-95*maskAt(36,33)/255)<2,'straight RGB and alpha preserve gray-patch brightness on black');
  for(const [x,y] of [[3,3],[67,5],[4,59],[68,58]])assert(cutout[4*(y*width+x)+3]<8,'isolated point source outside morphology is rejected');
  const first=await readFile(join(root,receipt.outputs.mask)),again=await extractExtendedSource({inputPath:input,outputDirectory:root,id:'fixture',maxPixels:72,medianSize:5,supportPixels:64,thresholdSigma:2.5,bridgeFraction:.025,softEdgeFraction:.02});
  assert.deepEqual(await readFile(join(root,again.outputs.mask)),first,'extraction is deterministic');
});
